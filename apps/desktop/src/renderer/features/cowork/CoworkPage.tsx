import { useEffect } from 'react';
import { GoalHeader } from './GoalHeader';
import { Transcript } from './Transcript';
import { Composer as ChatComposer } from '../chat/Composer';  // reuse for steering
import { useCoworkStore } from './cowork.store';

// KNOWN M1 LIMITATION: ChatComposer reads sessionId from useChatStore (the chat store),
// NOT from useCoworkStore. In Cowork mode the active sessionId lives in cowork.store.
// Messages typed here will be sent to chat store's sessionId (null in cowork mode),
// making the composer a no-op for steering. The primary interaction is the auto-flow
// from the kickoff prompt in NewTaskDialog. This will be addressed in a future milestone.

export function CoworkPage() {
  const ingestAcp = useCoworkStore((s) => s.ingestAcp);

  useEffect(() => {
    const off = window.hermes.acp.onEvent((evt) => ingestAcp(evt));
    return () => { off(); };
  }, [ingestAcp]);

  return (
    <div className="flex h-full flex-1">
      <div className="flex flex-1 flex-col overflow-hidden">
        <GoalHeader />
        <Transcript />
        <ChatComposer />
      </div>
      {/* RightPane added in Task 29 */}
    </div>
  );
}
