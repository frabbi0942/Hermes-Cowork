// apps/desktop/src/renderer/routes.tsx
import { Switch, Route, Redirect } from 'wouter';
import { ChatPage } from './features/chat/ChatPage';

export function Routes() {
  return (
    <Switch>
      <Route path="/chat"><ChatPage /></Route>
      <Route path="/cowork"><div className="p-6">Cowork (next phase)</div></Route>
      <Route path="/cowork/new"><div className="p-6">New task</div></Route>
      <Route path="/code"><div className="p-6">Code</div></Route>
      <Route path="/kanban"><div className="p-6">Kanban</div></Route>
      <Route path="/"><Redirect to="/chat" /></Route>
      <Route><div className="p-6 text-muted">Not found</div></Route>
    </Switch>
  );
}
