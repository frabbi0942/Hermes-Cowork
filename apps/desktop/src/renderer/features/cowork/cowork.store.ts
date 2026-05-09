// apps/desktop/src/renderer/features/cowork/cowork.store.ts
import { create } from 'zustand';
import type { AcpServerMessage } from '@shared/types';
import type { KanbanTask } from '../../api/schemas';

type Approval = { toolCallId: string; description: string };

type CoworkStore = {
  sessionId: string | null;
  goal: string;
  cwd: string;
  profile: string;
  approvalMode: 'ask' | 'auto';
  transcript: Array<{ role: 'agent' | 'user'; text: string }>;
  approvals: Approval[];
  parentTaskId: number | null;
  planTasks: KanbanTask[];
  artifacts: Array<{ path: string; bytes?: number; addedAt: string }>;

  startTask: (input: { sessionId: string; goal: string; cwd: string; profile: string }) => void;
  setApprovalMode: (m: 'ask' | 'auto') => void;
  ingestAcp: (msg: AcpServerMessage) => void;
  upsertPlanTask: (task: KanbanTask) => void;
  setParent: (id: number) => void;
  reset: () => void;
};

export const useCoworkStore = create<CoworkStore>((set) => ({
  sessionId: null,
  goal: '',
  cwd: '',
  profile: 'default',
  approvalMode: 'ask',
  transcript: [],
  approvals: [],
  parentTaskId: null,
  planTasks: [],
  artifacts: [],

  startTask: ({ sessionId, goal, cwd, profile }) =>
    set({ sessionId, goal, cwd, profile, transcript: [], approvals: [], parentTaskId: null, planTasks: [], artifacts: [] }),

  setApprovalMode: (approvalMode) => set({ approvalMode }),
  setParent: (parentTaskId) => set({ parentTaskId }),

  upsertPlanTask: (task) =>
    set((s) => {
      const existing = s.planTasks.find((t) => t.id === task.id);
      const list = existing
        ? s.planTasks.map((t) => (t.id === task.id ? task : t))
        : [...s.planTasks, task];
      return { planTasks: list };
    }),

  reset: () => set({
    sessionId: null, goal: '', cwd: '', profile: 'default',
    transcript: [], approvals: [], parentTaskId: null, planTasks: [], artifacts: [],
  }),

  ingestAcp: (msg) =>
    set((s) => {
      switch (msg.kind) {
        case 'token': {
          const last = s.transcript[s.transcript.length - 1];
          if (last && last.role === 'agent') {
            return { transcript: [...s.transcript.slice(0, -1), { role: 'agent', text: last.text + msg.text }] };
          }
          return { transcript: [...s.transcript, { role: 'agent', text: msg.text }] };
        }
        case 'tool-call': {
          // Track artifact-creating tools
          if (msg.name === 'write_file' || msg.name === 'patch') {
            const args = msg.args as { path?: string };
            if (args.path) {
              return { artifacts: [...s.artifacts, { path: args.path, addedAt: new Date().toISOString() }] };
            }
          }
          return s;
        }
        case 'approval-request':
          return { approvals: [...s.approvals, { toolCallId: msg.toolCallId, description: msg.description }] };
        case 'tool-result':
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
