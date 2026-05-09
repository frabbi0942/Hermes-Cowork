import { describe, it, expect } from 'vitest';
import { ProfileSummarySchema, KanbanTaskSchema } from '@renderer/api/schemas';

describe('ProfileSummarySchema', () => {
  it('parses valid input', () => {
    const out = ProfileSummarySchema.parse({
      name: 'research',
      active: true,
      hermesHome: '/Users/x/.hermes/profiles/research',
    });
    expect(out.name).toBe('research');
  });
  it('rejects missing fields', () => {
    expect(() => ProfileSummarySchema.parse({ name: 'x' })).toThrow();
  });
});

describe('KanbanTaskSchema', () => {
  it('rejects unknown status', () => {
    expect(() =>
      KanbanTaskSchema.parse({
        id: 1,
        title: 't',
        body: null,
        status: 'wat',
        assignee: null,
        createdAt: '2026-05-08T00:00:00Z',
      }),
    ).toThrow();
  });
});
