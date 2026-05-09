// apps/desktop/src/main/orchestrator/acp-supervisor.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { FrameDecoder, encodeFrame, type JsonRpcMessage } from './jsonrpc';

export type AcpSession = {
  id: string;
  profile: string;
  cwd: string;
};

export type AcpSpawnOptions = AcpSession & {
  binaryPath: string;
  hermesHome: string;
};

export type AcpEvent =
  | { kind: 'message'; sessionId: string; msg: JsonRpcMessage }
  | { kind: 'exit'; sessionId: string; code: number | null }
  | { kind: 'error'; sessionId: string; error: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

class AcpChild {
  readonly decoder = new FrameDecoder();
  readonly pending = new Map<string | number, PendingRequest>();
  constructor(public readonly proc: ChildProcess, public readonly session: AcpSession) {}
}

export class AcpSupervisor extends EventEmitter {
  private children = new Map<string, AcpChild>();

  spawn(opts: AcpSpawnOptions): void {
    const proc = spawn(opts.binaryPath, ['acp'], {
      cwd: opts.cwd,
      env: { ...process.env, HERMES_HOME: opts.hermesHome },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const child = new AcpChild(proc, { id: opts.id, profile: opts.profile, cwd: opts.cwd });
    this.children.set(opts.id, child);

    proc.stdout?.on('data', (chunk: Buffer) => {
      for (const msg of child.decoder.push(chunk)) {
        this.routeIncoming(child, opts.id, msg);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Hermes ACP logs to stderr; surface for debugging.
      console.error(`[acp ${opts.id}]`, chunk.toString('utf8').trimEnd());
    });

    proc.on('error', (err) => {
      this.rejectAllPending(child, err);
      this.emit('event', { kind: 'error', sessionId: opts.id, error: err.message } satisfies AcpEvent);
    });

    proc.on('exit', (code) => {
      this.rejectAllPending(child, new Error(`ACP child exited (code=${code ?? 'null'})`));
      this.emit('event', { kind: 'exit', sessionId: opts.id, code } satisfies AcpEvent);
      this.children.delete(opts.id);
    });
  }

  /**
   * Send a tracked JSON-RPC request and resolve when the matching response
   * arrives. Rejects if the child exits or errors before a response arrives.
   */
  request(sessionId: string, method: string, params?: unknown): Promise<unknown> {
    const child = this.children.get(sessionId);
    if (!child || !child.proc.stdin) {
      return Promise.reject(new Error(`no ACP child for session ${sessionId}`));
    }
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      child.pending.set(id, { resolve, reject });
      child.proc.stdin!.write(encodeFrame({ jsonrpc: '2.0', id, method, params: params as JsonRpcMessage }));
    });
  }

  /** Send a raw JSON-RPC message (notification or response). Fire-and-forget. */
  send(sessionId: string, msg: JsonRpcMessage): void {
    const child = this.children.get(sessionId);
    if (!child || !child.proc.stdin) {
      throw new Error(`no ACP child for session ${sessionId}`);
    }
    child.proc.stdin.write(encodeFrame(msg));
  }

  shutdown(sessionId: string): void {
    const child = this.children.get(sessionId);
    if (!child) return;
    try {
      child.proc.stdin?.end();
    } catch {
      // ignore
    }
    const proc = child.proc;
    setTimeout(() => proc.kill('SIGTERM'), 1000);
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }

  shutdownAll(): void {
    for (const id of this.children.keys()) this.shutdown(id);
  }

  list(): AcpSession[] {
    return Array.from(this.children.values()).map((c) => c.session);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: split incoming JSON-RPC traffic into request/response handling.
  //  - Responses (id present, no method) resolve any pending request().
  //  - Everything else is forwarded as 'message' for the bridge to translate.
  // ─────────────────────────────────────────────────────────────────────────
  private routeIncoming(child: AcpChild, handle: string, msg: JsonRpcMessage): void {
    const hasMethod = typeof msg['method'] === 'string';
    const id = msg['id'];
    const isResponse = !hasMethod && (typeof id === 'string' || typeof id === 'number');

    if (isResponse) {
      const pending = child.pending.get(id as string | number);
      if (pending) {
        child.pending.delete(id as string | number);
        if ('error' in msg && msg['error']) {
          const err = msg['error'] as { code?: number; message?: string };
          pending.reject(new Error(`ACP error ${err.code ?? '?'}: ${err.message ?? 'unknown'}`));
        } else {
          pending.resolve(msg['result']);
        }
        return; // responses to our own requests aren't broadcast
      }
    }

    this.emit('event', { kind: 'message', sessionId: handle, msg } satisfies AcpEvent);
  }

  private rejectAllPending(child: AcpChild, err: Error): void {
    for (const p of child.pending.values()) p.reject(err);
    child.pending.clear();
  }
}
