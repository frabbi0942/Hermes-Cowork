// apps/desktop/tests/unit/cowork-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCoworkStore } from '@renderer/features/cowork/cowork.store';

beforeEach(() => useCoworkStore.getState().reset());

describe('cowork store', () => {
  it('appends agent tokens', () => {
    const { ingestAcp } = useCoworkStore.getState();
    ingestAcp({ kind: 'token', sessionId: 's', text: 'Plan: ' });
    ingestAcp({ kind: 'token', sessionId: 's', text: '7 steps.' });
    expect(useCoworkStore.getState().transcript[0]?.text).toBe('Plan: 7 steps.');
  });

  it('records artifacts on write_file tool calls', () => {
    useCoworkStore.getState().ingestAcp({
      kind: 'tool-call', sessionId: 's', toolCallId: 't1',
      name: 'write_file', args: { path: '/tmp/draft.md' },
    });
    expect(useCoworkStore.getState().artifacts[0]?.path).toBe('/tmp/draft.md');
  });

  it('queues approvals', () => {
    useCoworkStore.getState().ingestAcp({
      kind: 'approval-request', sessionId: 's', toolCallId: 't1', description: 'drop production table?',
    });
    expect(useCoworkStore.getState().approvals).toEqual([
      { toolCallId: 't1', description: 'drop production table?' },
    ]);
  });
});
