import { ProfileDropdown } from './ProfileDropdown';

export function TitleBar() {
  return (
    <div
      className="flex items-center gap-3 border-b border-border bg-bg px-3"
      style={{ height: 38, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="ml-16">
        <ProfileDropdown />
      </div>
      <div className="ml-auto" />
    </div>
  );
}
