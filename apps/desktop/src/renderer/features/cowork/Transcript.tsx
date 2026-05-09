import { useCoworkStore } from './cowork.store';
import { ApprovalCard } from './ApprovalCard';

export function Transcript() {
  const { transcript, approvals } = useCoworkStore();

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 text-sm">
      {transcript.length === 0 && (
        <div className="mt-12 text-center text-muted">Hermes will propose a plan shortly…</div>
      )}
      {transcript.map((m, i) => (
        <div key={i} className="mb-4 whitespace-pre-wrap">
          {m.text}
        </div>
      ))}
      {approvals.map((a) => (
        <ApprovalCard key={a.toolCallId} approval={a} />
      ))}
    </div>
  );
}
