import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { TickerSearch } from './TickerSearch';

interface SearchOverlayProps {
  onClose: () => void;
}

/** The mobile stand-in for the nav's inline search field: a full-screen
 *  sheet, so the field and its results get the whole width instead of the
 *  sliver left over beside the logo and account control. */
export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 'calc(14px + env(safe-area-inset-top, 0px)) var(--page-padding) var(--page-padding)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Hero variant: it's the only thing on screen here, so it gets the
              same presence it has on the home page. */}
          <TickerSearch variant="hero" ref={inputRef} />
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title="Close search"
          aria-label="Close search"
          style={{
            flex: 'none',
            width: 'var(--tap-min)',
            height: 'var(--tap-min)',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-neutral-400)',
          }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
