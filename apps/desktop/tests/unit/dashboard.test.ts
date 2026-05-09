// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probeDashboard } from '@main/orchestrator/dashboard';

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
