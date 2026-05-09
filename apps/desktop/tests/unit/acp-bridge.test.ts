// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import * as cp from 'node:child_process';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof cp>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

import { AcpSupervisor } from '@main/orchestrator/acp-supervisor';
import { AcpBridge } from '@main/orchestrator/acp-bridge';
import { encodeFrame } from '@main/orchestrator/jsonrpc';
import type { AcpServerMessage } from '@shared/types';

class MockProc extends EventEmitter {
  pid = 1234;
  written: Record<string, unknown>[] = [];
  stdin = new Writable({
    write: (c: Buffer, _e, cb) => {
      // Each frame is one NDJSON line; multiple may arrive together.
      for (const line of c.toString('utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed) this.written.push(JSON.parse(trimmed));
      }
      cb();
    },
  });
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  kill(): void { this.emit('exit', 0); }

  /** Find the most recent message we wrote whose method matches. */
  findOutgoing(method: string): Record<string, unknown> | undefined {
    return [...this.written].reverse().find((m) => m['method'] === method);
  }
}

async function flush(): Promise<void> {
  await new Promise((r) => setImmediate(r));
}

function makeBridge() {
  const proc = new MockProc();
  vi.mocked(cp.spawn).mockReturnValue(proc as unknown as cp.ChildProcess);
  const sup = new AcpSupervisor();
  const bridge = new AcpBridge(sup);
  const semanticEvents: AcpServerMessage[] = [];
  bridge.on('event', (e: AcpServerMessage) => semanticEvents.push(e));
  return { sup, bridge, proc, semanticEvents };
}

describe('AcpBridge.startSession', () => {
  beforeEach(() => vi.mocked(cp.spawn).mockReset());

  it('completes the initialize → session/new handshake and returns the real sessionId', async () => {
    const { bridge, proc } = makeBridge();

    const startPromise = bridge.startSession({
      profile: 'default', cwd: '/Users/x/code',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });

    // Reply to initialize.
    await flush();
    const initReq = proc.findOutgoing('initialize')!;
    expect(initReq['params']).toMatchObject({ protocolVersion: 1 });
    proc.stdout!.push(
      encodeFrame({ jsonrpc: '2.0', id: initReq['id'] as string, result: { agentCapabilities: {} } }),
    );

    // Reply to session/new.
    await flush();
    const newReq = proc.findOutgoing('session/new')!;
    expect(newReq['params']).toEqual({ cwd: '/Users/x/code', mcpServers: [] });
    proc.stdout!.push(
      encodeFrame({ jsonrpc: '2.0', id: newReq['id'] as string, result: { sessionId: 'sess-real-123' } }),
    );

    await expect(startPromise).resolves.toEqual({ sessionId: 'sess-real-123' });
  });

  it('shuts the orphan child down if the handshake fails', async () => {
    const { bridge, proc } = makeBridge();
    const startPromise = bridge.startSession({
      profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });
    await flush();
    const initReq = proc.findOutgoing('initialize')!;
    proc.stdout!.push(
      encodeFrame({ jsonrpc: '2.0', id: initReq['id'] as string, error: { code: -32600, message: 'bad protocol' } }),
    );
    await expect(startPromise).rejects.toThrow(/bad protocol/);
  });
});

describe('AcpBridge.sendPrompt', () => {
  beforeEach(() => vi.mocked(cp.spawn).mockReset());

  it('sends session/prompt with the correct shape and emits done when complete', async () => {
    const { bridge, proc, semanticEvents } = makeBridge();

    // Bring the session online.
    const startPromise = bridge.startSession({
      profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });
    await flush();
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0', id: proc.findOutgoing('initialize')!['id'] as string, result: {},
    }));
    await flush();
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0', id: proc.findOutgoing('session/new')!['id'] as string, result: { sessionId: 'sess-1' },
    }));
    await startPromise;

    // Send a prompt.
    const promptDone = bridge.sendPrompt('sess-1', 'hello world');
    await flush();
    const promptReq = proc.findOutgoing('session/prompt')!;
    expect(promptReq['params']).toEqual({
      sessionId: 'sess-1',
      prompt: [{ type: 'text', text: 'hello world' }],
    });

    // Reply with a stop reason — turn ends.
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0', id: promptReq['id'] as string, result: { stopReason: 'end_turn' },
    }));
    await promptDone;

    expect(semanticEvents).toContainEqual({ kind: 'done', sessionId: 'sess-1' });
  });
});

describe('AcpBridge.respondToPermission', () => {
  beforeEach(() => vi.mocked(cp.spawn).mockReset());

  it('replies to a stored session/request_permission with the chosen option', async () => {
    const { bridge, proc, semanticEvents } = makeBridge();

    // Bring session online (abbreviated).
    const startPromise = bridge.startSession({
      profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });
    await flush();
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0', id: proc.findOutgoing('initialize')!['id'] as string, result: {},
    }));
    await flush();
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0', id: proc.findOutgoing('session/new')!['id'] as string, result: { sessionId: 'sess-1' },
    }));
    await startPromise;

    // Hermes asks for permission to run a tool.
    proc.stdout!.push(encodeFrame({
      jsonrpc: '2.0',
      id: 'perm-req-7',
      method: 'session/request_permission',
      params: {
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-abc', title: 'rm -rf /' },
        options: [
          { optionId: 'o-allow-once', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'o-allow-always', name: 'Always allow', kind: 'allow_always' },
          { optionId: 'o-deny', name: 'Deny', kind: 'reject_once' },
        ],
      },
    }));
    await flush();

    // The translator surfaced an approval-request to the renderer.
    expect(semanticEvents).toContainEqual({
      kind: 'approval-request',
      sessionId: 'sess-1',
      toolCallId: 'tc-abc',
      description: 'rm -rf /',
    });

    // User clicks "allow" — bridge picks allow_once and responds with that optionId.
    proc.written.length = 0; // clear pre-existing handshake messages from inspection
    bridge.respondToPermission('tc-abc', true);
    expect(proc.written).toHaveLength(1);
    expect(proc.written[0]).toEqual({
      jsonrpc: '2.0',
      id: 'perm-req-7',
      result: { outcome: { outcome: 'selected', optionId: 'o-allow-once' } },
    });
  });

  it('sends cancelled outcome on deny (no optionId required)', async () => {
    const { bridge, proc } = makeBridge();
    bridge['pendingPermissions'].set('tc-x', {
      handle: 'h-1', requestId: 99,
      options: [{ optionId: 'o', name: 'allow', kind: 'allow_once' }],
    });
    bridge['acpToHandle'].set('sess-1', 'h-1');
    // Need a child for sup.send to find.
    bridge['sup'].spawn({
      id: 'h-1', profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });

    bridge.respondToPermission('tc-x', false);

    expect(proc.written.at(-1)).toEqual({
      jsonrpc: '2.0',
      id: 99,
      result: { outcome: { outcome: 'cancelled' } },
    });
  });

  it('silently no-ops when responding to a toolCallId that is not pending', () => {
    const { bridge, proc } = makeBridge();
    bridge.respondToPermission('does-not-exist', true);
    expect(proc.written).toEqual([]);
  });
});
