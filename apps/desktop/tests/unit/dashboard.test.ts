// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probeDashboard } from '@main/orchestrator/dashboard';
import { ensureDashboard } from '@main/orchestrator/dashboard';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof childProcess>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

describe('probeDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true for a valid /api/status response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ version: '0.13.4' }), { status: 200 }),
    );
    expect(await probeDashboard(9119)).toBe(true);
  });

  it('returns false for non-Hermes response shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    expect(await probeDashboard(9119)).toBe(false);
  });

  it('returns false on connection error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await probeDashboard(9119)).toBe(false);
  });
});

describe('ensureDashboard', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset?.();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(childProcess.spawn).mockReset();
  });

  it('skips spawn when probe succeeds (existing dashboard)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ version: '0.13.4' }), { status: 200 }),
    );
    const result = await ensureDashboard({
      binaryPath: '/Users/x/.local/bin/hermes',
      hermesHome: '/Users/x/.hermes',
    });
    expect(result.kind).toBe('ready');
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });
});
