import { useLocation } from 'wouter';

type Item = { icon: string; label: string; href: string };

const COWORK_ITEMS: Item[] = [
  { icon: '+', label: 'New task', href: '/cowork/new' },
  { icon: '⏵', label: 'Active tasks', href: '/cowork' },
  { icon: '⏰', label: 'Scheduled', href: '/cowork/scheduled' },
  { icon: '📁', label: 'Projects', href: '/cowork/projects' },
];

const HERMES_ITEMS: Item[] = [
  { icon: '📋', label: 'Kanban', href: '/kanban' },
  { icon: '🧠', label: 'Memory', href: '/memory' },
  { icon: '🪛', label: 'Skills', href: '/skills' },
  { icon: '⏰', label: 'Cron', href: '/cron' },
  { icon: '📊', label: 'Insights', href: '/insights' },
];

export function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="flex w-[200px] flex-col gap-4 border-r border-border bg-surface px-3 py-3 text-sm">
      <Section title="Cowork" items={COWORK_ITEMS} active={location} />
      <Section title="Hermes" items={HERMES_ITEMS} active={location} />
    </aside>
  );
}

function Section({ title, items, active }: { title: string; items: Item[]; active: string }) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-dim">{title}</div>
      {items.map((it) => {
        const isActive = active === it.href;
        return (
          <a
            key={it.href}
            href={it.href}
            className={
              'flex items-center gap-2 rounded px-2 py-1.5 ' +
              (isActive ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')
            }
          >
            <span className="w-4 text-center">{it.icon}</span>
            <span>{it.label}</span>
          </a>
        );
      })}
    </div>
  );
}
