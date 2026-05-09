export function ToolCallCard(props: { name: string; args: unknown; result?: unknown }) {
  return (
    <div className="my-2 border-l-2 border-accent bg-surface px-3 py-2 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-accent">⚙ tool · {props.name}</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted">
        {JSON.stringify(props.args, null, 2)}
      </pre>
      {props.result !== undefined && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-success">
          {typeof props.result === 'string' ? props.result : JSON.stringify(props.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
