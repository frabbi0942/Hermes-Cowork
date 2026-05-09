import { useChatStore } from './chat.store';
import { ToolCallCard } from './ToolCallCard';

export function MessageStream() {
  const messages = useChatStore((s) => s.messages);
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {messages.length === 0 && (
        <div className="mt-12 text-center text-sm text-muted">
          Send a message to begin.
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className="mb-6">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-dim">
            {m.role === 'user' ? 'You' : 'Hermes'}
          </div>
          <div className="whitespace-pre-wrap text-sm text-fg">{m.text}</div>
          {m.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} name={tc.name} args={tc.args} result={tc.result} />
          ))}
        </div>
      ))}
    </div>
  );
}
