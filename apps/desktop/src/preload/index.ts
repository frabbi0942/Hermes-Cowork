// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../main/ipc/channels';
import type { ProfileSummary, StatusSnapshot, AcpClientMessage, AcpServerMessage } from '../shared/types';

const api = {
  runtime: {
    status: (): Promise<StatusSnapshot> => ipcRenderer.invoke(IpcChannel.RuntimeStatus),
    rescan: (): Promise<StatusSnapshot> => ipcRenderer.invoke(IpcChannel.RuntimeRescan),
    probe: () => ipcRenderer.invoke(IpcChannel.RuntimeProbe),
  },
  profile: {
    list: (): Promise<ProfileSummary[]> => ipcRenderer.invoke(IpcChannel.ProfileList),
    switch: (name: string): Promise<void> => ipcRenderer.invoke(IpcChannel.ProfileSwitch, name),
  },
  acp: {
    start: (opts: { profile: string; cwd: string }): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke(IpcChannel.AcpStart, opts),
    send: (msg: AcpClientMessage): Promise<void> => ipcRenderer.invoke(IpcChannel.AcpSend, msg),
    stop: (sessionId: string): Promise<void> => ipcRenderer.invoke(IpcChannel.AcpStop, sessionId),
    onEvent: (cb: (msg: AcpServerMessage) => void) => {
      const listener = (_e: unknown, msg: AcpServerMessage) => cb(msg);
      ipcRenderer.on(IpcChannel.AcpEvent, listener);
      return () => ipcRenderer.removeListener(IpcChannel.AcpEvent, listener);
    },
  },
  rest: {
    get: <T>(path: string): Promise<T> => ipcRenderer.invoke(IpcChannel.RestGet, path),
    post: <T>(path: string, body: unknown): Promise<T> => ipcRenderer.invoke(IpcChannel.RestPost, path, body),
    patch: <T>(path: string, body: unknown): Promise<T> => ipcRenderer.invoke(IpcChannel.RestPatch, path, body),
  },
  kanbanWs: {
    subscribe: (boardSlug: string | null): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.KanbanWsSubscribe, boardSlug),
    onEvent: (cb: (event: unknown) => void) => {
      const listener = (_e: unknown, ev: unknown) => cb(ev);
      ipcRenderer.on(IpcChannel.KanbanWsEvent, listener);
      return () => ipcRenderer.removeListener(IpcChannel.KanbanWsEvent, listener);
    },
  },
  dialog: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.ShowFolderPicker),
  },
};

contextBridge.exposeInMainWorld('hermes', api);
export type HermesApi = typeof api;
