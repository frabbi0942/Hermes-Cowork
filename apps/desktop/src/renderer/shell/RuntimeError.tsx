type RuntimeProbeError =
  | { kind: 'not-found'; searched: string[] }
  | { kind: 'too-old'; version: string; min: string }
  | { kind: 'version-failed'; stderr: string };

export function RuntimeError({ error }: { error: RuntimeProbeError }) {
  return (
    <div className="flex h-full items-center justify-center bg-bg p-8">
      <div className="max-w-xl rounded-lg border border-border bg-surface p-6 text-sm">
        <h1 className="mb-3 text-lg font-semibold text-warn">Hermes runtime unavailable</h1>

        {error.kind === 'not-found' && (
          <>
            <p className="mb-3">Hermes Cowork couldn&apos;t find the <code>hermes</code> binary on your system.</p>
            <p className="mb-2">Install it with:</p>
            <pre className="mb-3 rounded bg-bg p-3 text-xs">curl -fsSL https://hermes-agent.nousresearch.com/install.sh | sh</pre>
            <details className="text-xs text-muted">
              <summary>Searched paths</summary>
              <ul className="mt-2 list-disc pl-5">
                {error.searched.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </details>
          </>
        )}

        {error.kind === 'too-old' && (
          <p>Hermes {error.version} is installed, but Cowork needs at least {error.min}. Run <code>hermes update</code>.</p>
        )}

        {error.kind === 'version-failed' && (
          <>
            <p className="mb-2">Hermes is installed but failed to report a version.</p>
            <pre className="rounded bg-bg p-3 text-xs">{error.stderr}</pre>
          </>
        )}

        <button
          onClick={() => location.reload()}
          className="mt-4 rounded bg-accent px-4 py-2 text-xs font-semibold text-bg"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
