import { useCoworkStore } from './cowork.store';

export function GoalHeader() {
  const { goal, cwd, profile, planTasks } = useCoworkStore();
  const total = planTasks.length;
  const done = planTasks.filter((t) => t.status === 'done' || t.status === 'archived').length;

  if (!goal) return null;
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="text-[10px] uppercase tracking-wide text-dim">Goal</div>
      <div className="mt-1 text-base text-fg">{goal}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
        <span>📁 {cwd}</span>
        <span>·</span>
        <span>👤 {profile}</span>
        {total > 0 && (
          <>
            <span>·</span>
            <span className="text-success">● step {done + 1} of {total}</span>
          </>
        )}
      </div>
    </div>
  );
}
