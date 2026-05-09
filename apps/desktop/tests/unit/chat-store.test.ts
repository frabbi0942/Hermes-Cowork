// apps/desktop/tests/unit/chat-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@renderer/features/chat/chat.store';

describe('chat store', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('appends tokens to the assistant message', () => {
    const { ingest } = useChatStore.getState();
    ingest({ kind: 'token', sessionId: 's1', text: 'Hel' });
    ingest({ kind: 'token', sessionId: 's1', text: 'lo' });
    expect(useChatStore.getState().messages[0]?.text).toBe('Hello');
  });

  it('records tool calls under the current assistant message', () => {
    const { ingest } = useChatStore.getState();
    ingest({ kind: 'token', sessionId: 's1', text: 'reading...' });
    ingest({ kind: 'tool-call', sessionId: 's1', toolCallId: 't1', name: 'read_file', args: { path: 'a.md' } });
    expect(useChatStore.getState().messages[0]?.toolCalls).toEqual([
      { id: 't1', name: 'read_file', args: { path: 'a.md' } },
    ]);
  });

  it('queues approval requests', () => {
    useChatStore.getState().ingest({
      kind: 'approval-request', sessionId: 's1', toolCallId: 't1', description: 'rm -rf?',
    });
    expect(useChatStore.getState().pendingApprovals).toEqual([
      { toolCallId: 't1', description: 'rm -rf?' },
    ]);
  });
});
