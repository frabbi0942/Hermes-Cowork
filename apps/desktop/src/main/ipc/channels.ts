export const IpcChannel = {
  // status / runtime
  RuntimeStatus: 'runtime:status',
  RuntimeRescan: 'runtime:rescan',

  // profiles
  ProfileList: 'profile:list',
  ProfileSwitch: 'profile:switch',

  // ACP
  AcpStart: 'acp:start',
  AcpSend: 'acp:send',
  AcpStop: 'acp:stop',
  AcpEvent: 'acp:event',  // main → renderer push

  // dashboard REST proxy (so renderer never touches network)
  RestGet: 'rest:get',
  RestPost: 'rest:post',
  RestPatch: 'rest:patch',

  // kanban WebSocket pump
  KanbanWsSubscribe: 'kanban-ws:subscribe',
  KanbanWsEvent: 'kanban-ws:event',
} as const;

export type IpcChannelKey = (typeof IpcChannel)[keyof typeof IpcChannel];
