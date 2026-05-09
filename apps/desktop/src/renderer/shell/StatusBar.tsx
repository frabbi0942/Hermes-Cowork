import { useEffect, useState } from 'react';
import { api } from '../api/rest-client';
import type { Status } from '../api/schemas';

export function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.status();
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus(null);
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="flex items-center gap-3 border-t border-border bg-bg px-3 py-1.5 text-[11px] text-muted">
      <GatewayDot status={status} />
      <span className="ml-auto">
        {status ? `hermes ${status.hermesVersion}` : 'connecting…'}
      </span>
    </div>
  );
}

function GatewayDot({ status }: { status: Status | null }) {
  if (!status) {
    return <span className="text-dim">● gateway: —</span>;
  }
  const { running, platforms } = status.gateway;
  if (!running) {
    return <span className="flex items-center gap-1"><span className="text-danger">●</span> gateway: stopped</span>;
  }
  return (
    <span className="flex items-center gap-1">
      <span className="text-success">●</span>
      gateway: {platforms.join(', ') || 'idle'}
    </span>
  );
}
