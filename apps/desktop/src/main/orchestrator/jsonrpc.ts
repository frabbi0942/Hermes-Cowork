// apps/desktop/src/main/orchestrator/jsonrpc.ts
//
// Newline-delimited JSON (NDJSON) framing for ACP stdio. Each message is one
// line of JSON terminated by '\n'. ACP's reference Python client reads with
// readline(); see acp/connection.py.

export type JsonRpcMessage = Record<string, unknown>;

export function encodeFrame(msg: JsonRpcMessage): Buffer {
  return Buffer.from(JSON.stringify(msg) + '\n', 'utf8');
}

export class FrameDecoder {
  private buf = '';

  push(chunk: Buffer): JsonRpcMessage[] {
    this.buf += chunk.toString('utf8');
    const out: JsonRpcMessage[] = [];

    let nl = this.buf.indexOf('\n');
    while (nl !== -1) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (line) {
        try {
          out.push(JSON.parse(line) as JsonRpcMessage);
        } catch {
          // Skip malformed lines. ACP agents may emit non-JSON banners on
          // stdout during startup — surviving them keeps the connection alive.
        }
      }
      nl = this.buf.indexOf('\n');
    }
    return out;
  }
}
