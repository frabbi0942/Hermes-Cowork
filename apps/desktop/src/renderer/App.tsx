import { TitleBar } from './shell/TitleBar';
import { ModeTabs } from './shell/ModeTabs';
import { Sidebar } from './shell/Sidebar';
import { StatusBar } from './shell/StatusBar';
import { Routes } from './routes';

export function App() {
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
