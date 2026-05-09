import { useCoworkStore } from './cowork.store';

export function ApprovalCard({ approval }: { approval: { toolCallId: string; description: string } }) {
  const sessionId = useCoworkStore((s) => s.sessionId);

  const respond = async (allow: boolean) => {
    if (!sessionId) return;
    await window.hermes.acp.send({ kind: 'approve', sessionId, toolCallId: approval.toolCallId, allow });
    useCoworkStore.setState((s) => ({
      approvals: s.approvals.filter((a) => a.toolCallId !== approval.toolCallId),
    }));
  };

  return (
    <div className="my-3 rounded border border-warn/40 bg-warn/5 px-4 py-3">
      <div className="mb-2 text-xs font-semibold text-warn">⚠ Approval needed</div>
      <div className="mb-3 text-sm">{approval.description}</div>
      <div className="flex gap-2">
        <button
          onClick={() => { void respond(true); }}
          className="rounded bg-accent px-3 py-1 text-xs font-semibold text-bg"
        >
          Approve
        </button>
        <button
          onClick={() => { void respond(false); }}
          className="rounded bg-surface2 px-3 py-1 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
