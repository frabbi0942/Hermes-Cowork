import { useEffect, useState } from 'react';
import { api } from '../../api/rest-client';
import type { SessionSummary } from '../../api/schemas';

export function SessionList({ onPick }: { onPick: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  useEffect(() => {
    api.sessions(50).then(setSessions).catch(() => setSessions([]));
  }, []);

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-border bg-surface">
      <div className="px-3 py-3 text-[11px] uppercase tracking-wide text-dim">Sessions</div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted">No sessions yet.</div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="block w-full border-b border-border/50 px-3 py-2 text-left text-xs hover:bg-surface2"
          >
            <div className="text-fg">{s.title ?? s.id.slice(0, 8)}</div>
            <div className="mt-0.5 flex justify-between text-[10px] text-dim">
              <span>{s.source ?? 'local'}</span>
              <span>{s.model ?? '—'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
