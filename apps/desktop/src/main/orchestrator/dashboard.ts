// apps/desktop/src/main/orchestrator/dashboard.ts
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export type DashboardState =
  | { kind: 'unknown' }
  | { kind: 'starting'; pid: number }
  | { kind: 'ready'; port: number; pid: number | null }
  | { kind: 'crashed'; lastError: string };

export type DashboardOptions = {
  binaryPath: string;
  hermesHome: string;
  port?: number;
};

const DEFAULT_PORT = 9119;

export async function fetchDashboardToken(port: number): Promise<string | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/window\.__HERMES_SESSION_TOKEN__="([^"]+)"/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function probeDashboard(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 750);
    const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    const body = (await r.json()) as { version?: string };
    return typeof body.version === 'string';
  } catch {
    return false;
  }
}

export async function ensureDashboard(opts: DashboardOptions): Promise<DashboardState> {
  const port = opts.port ?? DEFAULT_PORT;

  if (await probeDashboard(port)) {
    return { kind: 'ready', port, pid: null };
  }

  const child = spawn(
    opts.binaryPath,
    ['dashboard', '--no-open', '--port', String(port), '--host', '127.0.0.1'],
    {
      env: { ...process.env, HERMES_HOME: opts.hermesHome },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.on('error', (err) => {
    console.error('[dashboard] spawn error', err);
  });

  // Wait until /api/status responds, with a 20s ceiling.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await probeDashboard(port)) {
      return { kind: 'ready', port, pid: child.pid ?? null };
    }
    await sleep(400);
  }

  child.kill('SIGTERM');
  return { kind: 'crashed', lastError: 'dashboard did not become ready in 20s' };
}
