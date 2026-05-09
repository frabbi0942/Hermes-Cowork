import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCoworkStore } from './cowork.store';

const COWORK_SYSTEM_PROMPT = `You are running in Hermes Cowork mode.

Before doing any work, propose a plan using kanban_create — one subtask per concrete step, linked under a parent task whose title is the user's goal.

Use kanban_heartbeat regularly during long-running steps.
Mark subtasks complete with kanban_complete as you finish them.
Spawn additional profiles via kanban_create with --assignee for parallelizable subtasks.
For destructive operations (deleting files, dropping tables, irreversible API calls), always request approval inline regardless of mode.`.trim();

export function NewTaskDialog() {
  const [goal, setGoal] = useState('');
  const [cwd, setCwd] = useState('');
  const [profile, setProfile] = useState('default');
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();
  const startTask = useCoworkStore((s) => s.startTask);

  const pickFolder = async () => {
    // Renderer can't open native dialog directly under contextIsolation;
    // M1 placeholder: paste an absolute path. Native dialog wired in Task 26.
  };

  const submit = async () => {
    if (!goal.trim() || !cwd.trim()) return;
    setBusy(true);
    try {
      const { sessionId } = await window.hermes.acp.start({ profile, cwd });
      startTask({ sessionId, goal, cwd, profile });
      // Send the kickoff: system + goal as a single prompt.
      await window.hermes.acp.send({
        kind: 'prompt',
        sessionId,
        text: `${COWORK_SYSTEM_PROMPT}\n\nGoal: ${goal}\nWorking directory: ${cwd}\n\nPropose a plan now.`,
      });
      navigate('/cowork');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold">New Cowork task</h2>

      <label className="mb-1 block text-xs text-muted">Goal</label>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="e.g. Pull Q2 metrics from Mixpanel and draft the weekly report"
        className="mb-4 w-full rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      <label className="mb-1 block text-xs text-muted">Working folder (absolute path)</label>
      <div className="mb-4 flex gap-2">
        <input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="/Users/x/work/q2-report"
          className="flex-1 rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button onClick={() => { void pickFolder(); }} className="rounded bg-surface2 px-3 py-2 text-xs hover:bg-border">
          Pick…
        </button>
      </div>

      <label className="mb-1 block text-xs text-muted">Profile</label>
      <input
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        className="mb-6 w-full rounded border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate('/cowork')} className="rounded px-3 py-2 text-sm text-muted hover:text-fg">
          Cancel
        </button>
        <button
          onClick={() => { void submit(); }}
          disabled={busy || !goal.trim() || !cwd.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Start task'}
        </button>
      </div>
    </div>
  );
}
