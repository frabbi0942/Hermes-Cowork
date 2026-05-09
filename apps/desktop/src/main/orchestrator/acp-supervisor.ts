// apps/desktop/src/main/orchestrator/acp-supervisor.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
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

class AcpChild {
  readonly decoder = new FrameDecoder();
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
        const event: AcpEvent = { kind: 'message', sessionId: opts.id, msg };
        this.emit('event', event);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Hermes ACP logs to stderr; surface for debugging.
      console.error(`[acp ${opts.id}]`, chunk.toString('utf8').trimEnd());
    });

    proc.on('error', (err) => {
      this.emit('event', { kind: 'error', sessionId: opts.id, error: err.message } satisfies AcpEvent);
    });

    proc.on('exit', (code) => {
      this.emit('event', { kind: 'exit', sessionId: opts.id, code } satisfies AcpEvent);
      this.children.delete(opts.id);
    });
  }

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
}
