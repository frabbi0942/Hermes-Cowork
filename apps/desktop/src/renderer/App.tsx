import { useEffect, useState } from 'react';
import { TitleBar } from './shell/TitleBar';
import { ModeTabs } from './shell/ModeTabs';
import { Sidebar } from './shell/Sidebar';
import { StatusBar } from './shell/StatusBar';
import { Routes } from './routes';
import { RuntimeError } from './shell/RuntimeError';

type Probe = Awaited<ReturnType<typeof window.hermes.runtime.probe>>;

export function App() {
  const [probe, setProbe] = useState<Probe | null>(null);
  useEffect(() => {
    void window.hermes.runtime.probe().then(setProbe);
  }, []);

  if (probe === null) {
    return <main className="flex h-screen items-center justify-center text-muted">Connecting to Hermes…</main>;
  }
  if (probe.kind !== 'ok') {
    return <RuntimeError error={probe} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <ModeTabs />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-bg">
          <Routes />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
