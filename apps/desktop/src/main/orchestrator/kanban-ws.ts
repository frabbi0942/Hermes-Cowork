// apps/desktop/src/main/orchestrator/kanban-ws.ts
import type { BrowserWindow } from 'electron';
import { IpcChannel } from '../ipc/channels';

// Lazy WebSocket import (avoid bundling cost if unused)
type WsModule = typeof import('ws');

export class KanbanWsPump {
  private ws: import('ws').WebSocket | null = null;
  private retry = 0;
  private url: string;
  private win: () => BrowserWindow | null;

  constructor(opts: { port: number; win: () => BrowserWindow | null }) {
    this.url = `ws://127.0.0.1:${opts.port}/api/plugins/kanban/events`;
    this.win = opts.win;
  }

  async start(): Promise<void> {
    const { WebSocket } = (await import('ws')) as WsModule;
    const connect = () => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => { this.retry = 0; });
      this.ws.on('message', (data: import('ws').RawData) => {
        try {
          const event: unknown = JSON.parse(data.toString());
          this.win()?.webContents.send(IpcChannel.KanbanWsEvent, event);
        } catch { /* drop malformed */ }
      });
      this.ws.on('close', () => {
        const delay = Math.min(30_000, 500 * 2 ** this.retry++);
        setTimeout(connect, delay);
      });
      this.ws.on('error', () => { /* close handler retries */ });
    };
    connect();
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
  }
}
