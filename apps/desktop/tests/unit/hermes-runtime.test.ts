// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findHermesBinary, compareSemver } from '@main/orchestrator/hermes-runtime';
import * as fs from 'node:fs';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return { ...actual, existsSync: vi.fn() };
});

describe('findHermesBinary', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
  });

  it('returns first hit from common install paths', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p) === '/Users/x/.local/bin/hermes',
    );

    const result = findHermesBinary({
      home: '/Users/x',
      pathDirs: [],
    });

    expect(result.kind).toBe('found');
    if (result.kind === 'found') expect(result.path).toBe('/Users/x/.local/bin/hermes');
  });

  it('returns not-found with searched list', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = findHermesBinary({ home: '/Users/x', pathDirs: ['/usr/bin'] });
    expect(result.kind).toBe('not-found');
    if (result.kind === 'not-found') expect(result.searched.length).toBeGreaterThan(0);
  });
});

describe('compareSemver', () => {
  it('returns 1 when a > b', () => {
    expect(compareSemver('0.14.0', '0.13.0')).toBe(1);
  });
  it('returns 0 when equal', () => {
    expect(compareSemver('0.13.0', '0.13.0')).toBe(0);
  });
  it('returns -1 when a < b', () => {
    expect(compareSemver('0.12.5', '0.13.0')).toBe(-1);
  });
  it('handles patch differences', () => {
    expect(compareSemver('0.13.1', '0.13.0')).toBe(1);
  });
});
