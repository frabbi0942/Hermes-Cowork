export type JsonRpcMessage = Record<string, unknown>;

export function encodeFrame(msg: JsonRpcMessage): Buffer {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json, 'utf8');
  return Buffer.from(`Content-Length: ${len}\r\n\r\n${json}`, 'utf8');
}

export class FrameDecoder {
  private buf = Buffer.alloc(0);

  push(chunk: Buffer): JsonRpcMessage[] {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out: JsonRpcMessage[] = [];

    // eslint-disable-next-line no-constant-condition
    for (;;) {
      const sep = this.buf.indexOf('\r\n\r\n');
      if (sep === -1) break;
      const header = this.buf.subarray(0, sep).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        // header doesn't contain Content-Length — drop and resync
        this.buf = this.buf.subarray(sep + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = sep + 4;
      if (this.buf.length < start + len) break;
      const json = this.buf.subarray(start, start + len).toString('utf8');
      try {
        out.push(JSON.parse(json) as JsonRpcMessage);
      } catch {
        // skip malformed frame
      }
      this.buf = this.buf.subarray(start + len);
    }
    return out;
  }
}
