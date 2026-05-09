// apps/desktop/src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { IpcChannel } from './channels';
import { AcpSupervisor, type AcpEvent } from '../orchestrator/acp-supervisor';
import type { ProfileSummary, StatusSnapshot, AcpClientMessage } from '../../shared/types';

type Context = {
  hermesBinary: string;
  dashboardPort: number;
  defaultHermesHome: string;
  activeHermesHome: string;
  win: () => BrowserWindow | null;
};

export function registerIpcHandlers(ctx: Context, sup: AcpSupervisor): void {
  // ── runtime ──
  ipcMain.handle(IpcChannel.RuntimeStatus, async (): Promise<StatusSnapshot> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/status`);
    const body = (await r.json()) as { version: string; gateway?: { running?: boolean; platforms?: string[] } };
    return {
      hermesVersion: body.version,
      dashboardPort: ctx.dashboardPort,
      gateway: { running: body.gateway?.running ?? false, platforms: body.gateway?.platforms ?? [] },
    };
  });

  // ── profiles ──
  ipcMain.handle(IpcChannel.ProfileList, async (): Promise<ProfileSummary[]> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/profiles`);
    if (!r.ok) throw new Error(`profiles fetch failed: ${r.status}`);
    return (await r.json()) as ProfileSummary[];
  });

  ipcMain.handle(IpcChannel.ProfileSwitch, async (_e, name: string): Promise<void> => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}/api/profiles/use`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`profile switch failed: ${r.status}`);
    sup.shutdownAll();
  });

  // ── ACP ──
  sup.on('event', (event: AcpEvent) => {
    ctx.win()?.webContents.send(IpcChannel.AcpEvent, event);
  });

  ipcMain.handle(IpcChannel.AcpStart, async (_e, opts: { profile: string; cwd: string }) => {
    const sessionId = randomUUID();
    sup.spawn({
      id: sessionId,
      profile: opts.profile,
      cwd: opts.cwd,
      binaryPath: ctx.hermesBinary,
      hermesHome: opts.profile === 'default'
        ? ctx.defaultHermesHome
        : `${ctx.defaultHermesHome}/profiles/${opts.profile}`,
    });
    return { sessionId };
  });

  ipcMain.handle(IpcChannel.AcpSend, async (_e, msg: AcpClientMessage) => {
    if (msg.kind === 'prompt') {
      sup.send(msg.sessionId, {
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'prompt',
        params: { text: msg.text },
      });
    } else {
      sup.send(msg.sessionId, {
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'tool/respond',
        params: { tool_call_id: msg.toolCallId, allow: msg.allow },
      });
    }
  });

  ipcMain.handle(IpcChannel.AcpStop, async (_e, sessionId: string) => {
    sup.shutdown(sessionId);
  });

  // ── REST proxy ──
  ipcMain.handle(IpcChannel.RestGet, async (_e, path: string) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`);
    if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
    return r.json();
  });

  ipcMain.handle(IpcChannel.RestPost, async (_e, path: string, body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${path}: ${r.status}`);
    return r.json().catch(() => null);
  });

  ipcMain.handle(IpcChannel.RestPatch, async (_e, path: string, body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${ctx.dashboardPort}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path}: ${r.status}`);
    return r.json().catch(() => null);
  });

  // ── kanban WS ──
  ipcMain.handle(IpcChannel.KanbanWsSubscribe, (_e, _boardSlug: string | null) => undefined);

  // ── dialog ──
  ipcMain.handle(IpcChannel.ShowFolderPicker, async () => {
    const w = ctx.win();
    if (!w) return null;
    const result = await dialog.showOpenDialog(w, { properties: ['openDirectory'] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}
