import { useEffect, useState } from 'react';
import { api } from '../api/rest-client';
import type { ProfileSummary } from '../api/schemas';

export function ProfileDropdown() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);

  const active = profiles.find((p) => p.active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md bg-surface2 px-3 py-1 text-xs"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <strong>{active?.name ?? 'default'}</strong>
        <span className="text-dim">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-lg">
          {profiles.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                void (async () => {
                  await window.hermes.profile.switch(p.name);
                  setOpen(false);
                  location.reload();
                })();
              }}
              className={
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ' +
                (p.active ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')
              }
            >
              <span className={p.active ? 'text-accent' : 'text-dim'}>●</span>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
