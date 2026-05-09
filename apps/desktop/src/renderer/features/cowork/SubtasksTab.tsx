import { useCoworkStore } from './cowork.store';

export function SubtasksTab() {
  const planTasks = useCoworkStore((s) => s.planTasks);
  const subtasks = planTasks.filter((t) => t.assignee && t.assignee !== useCoworkStore.getState().profile);
  if (subtasks.length === 0) {
    return <div className="p-4 text-xs text-muted">Spawned subagents (other profiles) will list here.</div>;
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-3 text-xs">
      {subtasks.map((t) => (
        <div key={t.id} className="rounded border border-border bg-surface px-2 py-2">
          <div className="text-fg">{t.title}</div>
          <div className="mt-1 flex justify-between text-[10px] text-dim">
            <span>👤 {t.assignee}</span>
            <span>{t.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
