// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import * as cp from 'node:child_process';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof cp>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

import { AcpSupervisor, type AcpEvent } from '@main/orchestrator/acp-supervisor';
import { encodeFrame } from '@main/orchestrator/jsonrpc';

class MockProc extends EventEmitter {
  pid = 1234;
  stdin = new Writable({ write(_c, _e, cb) { cb(); } });
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  kill(): void { this.emit('exit', 0); }
}

describe('AcpSupervisor', () => {
  beforeEach(() => vi.mocked(cp.spawn).mockReset());

  it('emits message events when child writes JSON-RPC frames', async () => {
    const proc = new MockProc();
    vi.mocked(cp.spawn).mockReturnValue(proc as unknown as cp.ChildProcess);

    const sup = new AcpSupervisor();
    const events: AcpEvent[] = [];
    sup.on('event', (e: AcpEvent) => events.push(e));

    sup.spawn({
      id: 's1',
      profile: 'default',
      cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes',
      hermesHome: '/Users/x/.hermes',
    });

    proc.stdout!.push(encodeFrame({ jsonrpc: '2.0', method: 'hello' }));
    await new Promise((r) => setImmediate(r));

    expect(events).toEqual([
      { kind: 'message', sessionId: 's1', msg: { jsonrpc: '2.0', method: 'hello' } },
    ]);
  });

  it('emits exit event when child exits', async () => {
    const proc = new MockProc();
    vi.mocked(cp.spawn).mockReturnValue(proc as unknown as cp.ChildProcess);

    const sup = new AcpSupervisor();
    const events: AcpEvent[] = [];
    sup.on('event', (e: AcpEvent) => events.push(e));

    sup.spawn({
      id: 's1', profile: 'default', cwd: '/tmp',
      binaryPath: '/usr/local/bin/hermes', hermesHome: '/Users/x/.hermes',
    });

    proc.emit('exit', 0);
    await new Promise((r) => setImmediate(r));
    expect(events).toContainEqual({ kind: 'exit', sessionId: 's1', code: 0 });
  });
});
