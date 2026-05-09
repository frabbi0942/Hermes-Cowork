// apps/desktop/src/renderer/features/chat/chat.store.ts
import { create } from 'zustand';
import type { AcpServerMessage } from '@shared/types';

type Message = {
  role: 'user' | 'assistant';
  text: string;
  toolCalls: Array<{ id: string; name: string; args: unknown; result?: unknown }>;
};

type ChatStore = {
  sessionId: string | null;
  messages: Message[];
  pendingApprovals: Array<{ toolCallId: string; description: string }>;
  startSession: (sessionId: string) => void;
  ingest: (msg: AcpServerMessage) => void;
  reset: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: null,
  messages: [],
  pendingApprovals: [],

  startSession: (sessionId) =>
    set({ sessionId, messages: [], pendingApprovals: [] }),

  reset: () => set({ sessionId: null, messages: [], pendingApprovals: [] }),

  ingest: (msg) =>
    set((s) => {
      switch (msg.kind) {
        case 'token': {
          const last = s.messages[s.messages.length - 1];
          if (last && last.role === 'assistant') {
            return {
              messages: [
                ...s.messages.slice(0, -1),
                { ...last, text: last.text + msg.text },
              ],
            };
          }
          return {
            messages: [...s.messages, { role: 'assistant', text: msg.text, toolCalls: [] }],
          };
        }
        case 'tool-call': {
          const last = s.messages[s.messages.length - 1];
          if (!last || last.role !== 'assistant') return s;
          return {
            messages: [
              ...s.messages.slice(0, -1),
              { ...last, toolCalls: [...last.toolCalls, { id: msg.toolCallId, name: msg.name, args: msg.args }] },
            ],
          };
        }
        case 'tool-result': {
          const last = s.messages[s.messages.length - 1];
          if (!last || last.role !== 'assistant') return s;
          return {
            messages: [
              ...s.messages.slice(0, -1),
              {
                ...last,
                toolCalls: last.toolCalls.map((t) =>
                  t.id === msg.toolCallId ? { ...t, result: msg.result } : t,
                ),
              },
            ],
          };
        }
        case 'approval-request':
          return {
            pendingApprovals: [
              ...s.pendingApprovals,
              { toolCallId: msg.toolCallId, description: msg.description },
            ],
          };
        case 'done':
          return s;
        default:
          // Unknown kind: never replace state with undefined — that nukes the
          // entire store because zustand's setState replaces (not merges) when
          // the next state is non-object. See acp-translator on the main side.
          return s;
      }
    }),
}));
