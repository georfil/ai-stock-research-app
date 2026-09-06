import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TickerSearch } from '../../components/TickerSearch';
import { AuthControl } from '../../components/AuthControl';
import { useAuth } from '../../hooks/useAuth';
import { WatchlistSection } from './WatchlistSection';
import { SignInPrompt } from './SignInPrompt';
import { AmbientLight } from './AmbientLight';
import { YuriLockup } from '../../ui/Brand';

// The one column definition for the hero content, so nothing computes its
// own width independently. min() rather than clamp(): a clamp floor is a
// *minimum* width, which on a phone forces the column wider than the
// viewport (and `overflow-x: hidden` on <main> then clips it rather than
// scrolling). This tracks the viewport down to any width while still
// capping at 840px on a desktop.
const HERO_COLUMN_WIDTH = 'min(840px, calc(100% - 2 * var(--page-padding)))';

export function HomePage() {
  const auth = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchParams] = useSearchParams();

  // Temporary: lets the three type-pairing candidates be compared via
  // ?type=serif|newsreader|geist while one is being chosen. Remove once
  // a direction is picked and bake it into the token sheet directly.
  useEffect(() => {
    const typeface = searchParams.get('type');
    if (typeface) document.documentElement.dataset.typeface = typeface;
    else delete document.documentElement.dataset.typeface;
  }, [searchParams]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const active = document.activeElement;
      const isTyping = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <AmbientLight boosted={searchFocused} />

      {/* Pinned to the actual page corners, not the (much narrower, centred)
          hero column — that column's own side margins were what read as
          "pushed toward the middle" at wide viewports. */}
      <div style={{ position: 'absolute', top: 24, left: 'var(--page-padding)', zIndex: 2 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', borderRadius: 'var(--radius-sm)' }}>
          <YuriLockup height="clamp(38px, 8vw, 60px)" />
        </Link>
      </div>

      {auth.status === 'authed' && (
        <div style={{ position: 'absolute', top: 24, right: 'var(--page-padding)', zIndex: 2 }}>
          <AuthControl size="md" />
        </div>
      )}

      {/* Two flex spacers around the hero column, weighted 3:4 rather than
          even, put the block's optical centre at ~43% of the viewport height
          — slightly above true centre — instead of pinned to the top or
          dead-centred. Self-adjusting to content height (watchlist rows,
          loading state) since neither spacer is a fixed size. */}
      <div style={{ position: 'relative', zIndex: 1, flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* minHeight reserves room for the absolutely-positioned logo above,
            which is out of flow — without it the hero rides up underneath
            the mark on a short viewport. Only binds when the proportional
            space runs out, so it doesn't affect the 3:4 centring elsewhere. */}
        <div style={{ flexGrow: 3, minHeight: 'clamp(76px, 14vh, 108px)' }} />

        <div
          style={{
            width: HERO_COLUMN_WIDTH,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(24px, 3.5vw, 40px)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-hero)',
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {auth.status === 'authed'
              ? `Hello, ${auth.username}`
              : 'Start your investing research here'}
          </h1>

          <TickerSearch variant="hero" ref={inputRef} onFocusChange={setSearchFocused} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {auth.status === 'authed' && (
              <h2 style={{ fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', margin: '0 0 2px 0' }}>
                Your watchlist
              </h2>
            )}
            {auth.status === 'authed' ? (
              <WatchlistSection onAddFirst={() => inputRef.current?.focus()} />
            ) : (
              <SignInPrompt />
            )}
          </div>
        </div>

        <div style={{ flexGrow: 4, minHeight: 32 }} />
      </div>
    </main>
  );
}
