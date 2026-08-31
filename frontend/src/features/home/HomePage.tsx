import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TickerSearch } from '../../components/TickerSearch';
import { AuthControl } from '../../components/AuthControl';
import { useAuth } from '../../hooks/useAuth';
import { WatchlistSection } from './WatchlistSection';
import { SignInPrompt } from './SignInPrompt';
import { AmbientLight } from './AmbientLight';

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
    <main style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <AmbientLight boosted={searchFocused} />

      <div style={{ position: 'absolute', top: 24, right: 34, zIndex: 2 }}>
        <AuthControl />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'clamp(760px, 55vw, 840px)',
          margin: '0 auto',
          padding: '15vh 0 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 44,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 44,
            fontWeight: 500,
            margin: 0,
            letterSpacing: '-0.01em',
            textAlign: 'center',
          }}
        >
          {auth.status === 'authed'
            ? `Hello, ${auth.username}`
            : 'Start your investing research here'}
        </h1>

        <TickerSearch variant="hero" ref={inputRef} onFocusChange={setSearchFocused} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {auth.status === 'authed' && (
            <h2 style={{ fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', margin: '0 0 2px 4px' }}>
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
    </main>
  );
}
