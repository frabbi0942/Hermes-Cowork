import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('hermes', {
  ping: () => 'pong',
});
