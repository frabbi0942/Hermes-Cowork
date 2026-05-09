import { Link, useLocation } from 'wouter';

const TABS = [
  { id: 'chat', label: 'Chat', href: '/chat' },
  { id: 'cowork', label: 'Cowork', href: '/cowork' },
  { id: 'code', label: 'Code', href: '/code' },
] as const;

export function ModeTabs() {
  const [location] = useLocation();
  return (
    <div className="flex gap-1 border-b border-border bg-surface px-3 py-2">
      {TABS.map((t) => {
        const active = location.startsWith(t.href);
        return (
          <Link
            key={t.id}
            href={t.href}
            className={
              'rounded-md px-3 py-1 text-sm transition-colors ' +
              (active
                ? 'bg-accent text-bg font-semibold'
                : 'text-muted hover:bg-surface2')
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
