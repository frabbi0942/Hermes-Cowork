// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encodeFrame, FrameDecoder } from '@main/orchestrator/jsonrpc';

describe('encodeFrame', () => {
  it('produces newline-terminated JSON (NDJSON)', () => {
    const frame = encodeFrame({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(frame.toString('utf8')).toBe('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
  });
});

describe('FrameDecoder', () => {
  it('decodes a single full line', () => {
    const dec = new FrameDecoder();
    expect(dec.push(Buffer.from('{"jsonrpc":"2.0","id":1,"result":"pong"}\n'))).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'pong' },
    ]);
  });

  it('handles split lines across pushes', () => {
    const dec = new FrameDecoder();
    expect(dec.push(Buffer.from('{"jsonrpc":"2.0",'))).toEqual([]);
    expect(dec.push(Buffer.from('"id":1,"result":"pong"}\n'))).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'pong' },
    ]);
  });

  it('decodes multiple lines in one push', () => {
    const dec = new FrameDecoder();
    expect(dec.push(Buffer.from('{"id":1}\n{"id":2}\n'))).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('skips blank lines and malformed lines without breaking the stream', () => {
    const dec = new FrameDecoder();
    expect(dec.push(Buffer.from('\nnot json\n{"id":3}\n'))).toEqual([{ id: 3 }]);
  });

  it('buffers a partial trailing line until newline arrives', () => {
    const dec = new FrameDecoder();
    expect(dec.push(Buffer.from('{"id":4}'))).toEqual([]);
    expect(dec.push(Buffer.from('\n'))).toEqual([{ id: 4 }]);
  });
});
