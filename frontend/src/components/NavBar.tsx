import { TickerSearch } from './TickerSearch';
import { AuthControl } from './AuthControl';

export function NavBar() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: '11px 34px',
        flex: 'none',
        background: 'linear-gradient(color-mix(in srgb, var(--color-surface) 50%, var(--color-bg)), var(--color-bg))',
        boxShadow: '0 1px 0 color-mix(in srgb, var(--color-text) 10%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginRight: 6 }}>
        <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em' }}>Meridian</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
          research
        </span>
      </div>

      <TickerSearch />

      <div style={{ marginLeft: 'auto' }}>
        <AuthControl />
      </div>
    </header>
  );
}
