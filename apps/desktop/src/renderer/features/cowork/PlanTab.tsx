import { useEffect } from 'react';
import { useCoworkStore } from './cowork.store';
import { KanbanEventSchema, KanbanTaskSchema } from '../../api/schemas';

export function PlanTab() {
  const planTasks = useCoworkStore((s) => s.planTasks);
  const upsert = useCoworkStore((s) => s.upsertPlanTask);
  const parentId = useCoworkStore((s) => s.parentTaskId);

  useEffect(() => {
    const off = window.hermes.kanbanWs.onEvent((raw) => {
      const ev = KanbanEventSchema.safeParse(raw);
      if (!ev.success) return;
      // Only ingest events for the active task tree (parent + its children).
      // For M1: parent id arrives via a separate kanban_create observation;
      // until that lands, ingest all running tasks for the active profile.
      const payloadTask = (ev.data.payload as { task?: unknown }).task;
      if (!payloadTask) return;
      const parsed = KanbanTaskSchema.safeParse(payloadTask);
      if (!parsed.success) return;
      const t = parsed.data;
      if (parentId !== null && t.id !== parentId && !t.parents.includes(parentId)) return;
      upsert(t);
    });
    return () => { off(); };
  }, [parentId, upsert]);

  if (planTasks.length === 0) {
    return <div className="p-4 text-xs text-muted">Plan will appear here once Hermes proposes one.</div>;
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-3 text-xs">
      {planTasks.map((t) => (
        <PlanRow key={t.id} task={t} />
      ))}
    </div>
  );
}

function PlanRow({ task }: { task: import('../../api/schemas').KanbanTask }) {
  const icon = task.status === 'done' || task.status === 'archived' ? '✓'
    : task.status === 'running' ? '▸'
    : '○';
  const color = task.status === 'done' || task.status === 'archived' ? 'text-success'
    : task.status === 'running' ? 'text-accent'
    : 'text-dim';
  const muted = task.status === 'done' || task.status === 'archived' ? 'text-muted line-through' : 'text-fg';
  return (
    <div className={'flex items-start gap-2 rounded px-2 py-1 ' + (task.status === 'running' ? 'bg-surface2' : '')}>
      <span className={color}>{icon}</span>
      <span className={muted}>{task.title}</span>
    </div>
  );
}
