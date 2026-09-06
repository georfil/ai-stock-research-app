import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { TickerSearch } from './TickerSearch';
import { AuthControl } from './AuthControl';
import { SearchOverlay } from './SearchOverlay';
import { YuriWordmarkPng } from '../ui/Brand';
import { useIsMobile } from '../hooks/useMediaQuery';

export function NavBar() {
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header
      style={{
        flex: 'none',
        background: 'linear-gradient(color-mix(in srgb, var(--color-surface) 50%, var(--color-bg)), var(--color-bg))',
        boxShadow: '0 1px 0 color-mix(in srgb, var(--color-text) 10%, transparent)',
      }}
    >
      {/* Same max-width + page-padding shell the stock-page grid centers
          itself with, so the brand starts on the exact same vertical axis
          as the content column below it rather than floating at a fixed
          viewport inset.
          One row that never wraps: on mobile the search field is replaced by
          a single icon button (the field crushed to a sliver and pushed the
          account control onto a second line), so the row is only ever logo,
          trigger, account. */}
      <div
        style={{
          maxWidth: 'var(--page-max-width)',
          margin: '0 auto',
          padding: '11px var(--page-padding)',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 'clamp(10px, 1.6vw, 22px)',
        }}
      >
        <div style={{ marginRight: isMobile ? 0 : 6, display: 'flex', alignItems: 'center', flex: 'none' }}>
          <YuriWordmarkPng height="clamp(24px, 3.4vw, 30px)" />
        </div>

        {!isMobile && <TickerSearch />}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {isMobile && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSearchOpen(true)}
              title="Search"
              aria-label="Search"
              style={{
                width: 'var(--tap-min)',
                height: 'var(--tap-min)',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-neutral-300)',
              }}
            >
              <MagnifyingGlass size={20} />
            </button>
          )}
          <AuthControl />
        </div>
      </div>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
