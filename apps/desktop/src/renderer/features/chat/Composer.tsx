import { useState } from 'react';
import { useChatStore } from './chat.store';

export function Composer() {
  const sessionId = useChatStore((s) => s.sessionId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim() || !sessionId) return;
    setBusy(true);
    try {
      // user message echoed locally
      useChatStore.setState((s) => ({
        messages: [...s.messages, { role: 'user', text, toolCalls: [] }],
      }));
      await window.hermes.acp.send({ kind: 'prompt', sessionId, text });
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border px-6 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
        }}
        placeholder="Message Hermes... ⌘↵ to send"
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        disabled={busy}
      />
    </div>
  );
}
