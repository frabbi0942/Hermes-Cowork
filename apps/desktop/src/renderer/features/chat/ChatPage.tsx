import { useEffect } from 'react';
import { SessionList } from './SessionList';
import { MessageStream } from './MessageStream';
import { Composer } from './Composer';
import { useChatStore } from './chat.store';

export function ChatPage() {
  const startSession = useChatStore((s) => s.startSession);
  const ingest = useChatStore((s) => s.ingest);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { sessionId } = await window.hermes.acp.start({
        profile: 'default',
        // cwd: '/' is a placeholder — Task 26 adds a folder picker
        cwd: '/',
      });
      if (cancelled) return;
      startSession(sessionId);
    };
    void init();

    const off = window.hermes.acp.onEvent((evt) => ingest(evt));

    return () => {
      cancelled = true;
      off();
    };
  }, [startSession, ingest]);

  return (
    <div className="flex h-full flex-1">
      <SessionList onPick={(_id) => { /* M1: load existing session — placeholder */ }} />
      <div className="flex flex-1 flex-col">
        <MessageStream />
        <Composer />
      </div>
    </div>
  );
}
