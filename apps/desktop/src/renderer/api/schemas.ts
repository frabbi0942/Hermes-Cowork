import { z } from 'zod';

export const ProfileSummarySchema = z.object({
  name: z.string(),
  active: z.boolean(),
  hermesHome: z.string(),
});
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;

export const StatusSchema = z.object({
  hermesVersion: z.string(),
  dashboardPort: z.number(),
  gateway: z.object({
    running: z.boolean(),
    platforms: z.array(z.string()),
  }),
});
export type Status = z.infer<typeof StatusSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  source: z.string().nullable(), // local, telegram, discord, …
  model: z.string().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const KanbanTaskSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  status: z.enum(['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived']),
  assignee: z.string().nullable(),
  parents: z.array(z.number().int()).default([]),
  createdAt: z.string(),
});
export type KanbanTask = z.infer<typeof KanbanTaskSchema>;

export const KanbanEventSchema = z.object({
  id: z.number().int(),
  taskId: z.number().int(),
  kind: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  ts: z.string(),
});
export type KanbanEvent = z.infer<typeof KanbanEventSchema>;
