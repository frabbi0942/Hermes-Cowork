// apps/desktop/src/main/orchestrator/dashboard.ts

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
