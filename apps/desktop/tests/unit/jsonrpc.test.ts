// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encodeFrame, FrameDecoder } from '@main/orchestrator/jsonrpc';

describe('encodeFrame', () => {
  it('produces Content-Length-prefixed JSON', () => {
    const frame = encodeFrame({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const expectedJson = '{"jsonrpc":"2.0","id":1,"method":"ping"}';
    expect(frame.toString('utf8')).toBe(
      `Content-Length: ${Buffer.byteLength(expectedJson, 'utf8')}\r\n\r\n${expectedJson}`,
    );
  });
});

describe('FrameDecoder', () => {
  it('decodes a single full frame', () => {
    const dec = new FrameDecoder();
    const json = '{"jsonrpc":"2.0","id":1,"result":"pong"}';
    const buf = Buffer.from(`Content-Length: ${json.length}\r\n\r\n${json}`);
    const messages = dec.push(buf);
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, result: 'pong' }]);
  });

  it('handles split frames across pushes', () => {
    const dec = new FrameDecoder();
    const json = '{"jsonrpc":"2.0","id":1,"result":"pong"}';
    const full = `Content-Length: ${json.length}\r\n\r\n${json}`;
    expect(dec.push(Buffer.from(full.slice(0, 10)))).toEqual([]);
    expect(dec.push(Buffer.from(full.slice(10)))).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'pong' },
    ]);
  });

  it('decodes multiple frames in one push', () => {
    const dec = new FrameDecoder();
    const j1 = '{"id":1}';
    const j2 = '{"id":2}';
    const buf = Buffer.from(
      `Content-Length: ${j1.length}\r\n\r\n${j1}` +
      `Content-Length: ${j2.length}\r\n\r\n${j2}`,
    );
    expect(dec.push(buf)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
