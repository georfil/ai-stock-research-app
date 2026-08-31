import { forwardRef, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useTickerSearch } from '../hooks/useTickerSearch';
import { CompanyLogo } from '../ui/CompanyLogo';

interface TickerSearchProps {
  variant?: 'nav' | 'hero';
  onFocusChange?: (focused: boolean) => void;
}

export const TickerSearch = forwardRef<HTMLInputElement, TickerSearchProps>(function TickerSearch(
  { variant = 'nav', onFocusChange },
  forwardedRef,
) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { results } = useTickerSearch(query);
  const navigate = useNavigate();
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showResults = isFocused && results.length > 0;
  const isHero = variant === 'hero';

  function pick(ticker: string) {
    setQuery('');
    setActiveIndex(-1);
    setIsFocused(false);
    navigate(`/stocks/${ticker}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeIndex] ?? results[0];
      if (chosen) pick(chosen.ticker);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      e.currentTarget.blur();
    }
  }

  return (
    <div style={{ position: 'relative', width: isHero ? '100%' : 340 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isHero ? 16 : 8,
          padding: isHero ? '0 26px' : '0 12px',
          minHeight: isHero ? 72 : 40,
          background: 'var(--color-surface)',
          borderStyle: 'solid',
          borderWidth: 1,
          // The top edge catches marginally more light than the other three —
          // a hairline, not a shadow, is what reads as "sitting above the page".
          borderTopColor: isFocused
            ? 'color-mix(in srgb, var(--color-accent) 55%, transparent)'
            : `color-mix(in srgb, var(--color-text) ${isHero ? 28 : 20}%, transparent)`,
          borderRightColor: isFocused ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)' : 'var(--color-divider)',
          borderBottomColor: isFocused ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)' : 'var(--color-divider)',
          borderLeftColor: isFocused ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)' : 'var(--color-divider)',
          borderRadius: isHero ? 14 : 8,
          boxShadow: isHero ? 'var(--shadow-md)' : 'none',
          transition: 'border-color 160ms ease',
        }}
      >
        <MagnifyingGlass size={isHero ? 26 : 15} style={{ flex: 'none', opacity: 0.55 }} />
        <input
          ref={forwardedRef}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            // Defer so a click on a result registers before the list unmounts.
            blurTimer.current = setTimeout(() => {
              setIsFocused(false);
              onFocusChange?.(false);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search ticker or company"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'var(--color-text)',
            font: `400 ${isHero ? 20 : 15}px var(--font-body)`,
            padding: isHero ? '20px 0' : '9px 0',
          }}
        />
        {isHero && !isFocused && !query && (
          <span
            style={{
              flex: 'none',
              font: '400 14px var(--font-mono-data)',
              padding: '5px 10px',
              borderRadius: 6,
              color: 'var(--color-neutral-500)',
              background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
            }}
          >
            /
          </span>
        )}
      </div>

      {showResults && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: isHero ? 80 : 44,
            left: 0,
            right: 0,
            zIndex: 40,
            margin: 0,
            padding: 5,
            listStyle: 'none',
            borderRadius: 8,
            background: 'var(--color-neutral-800)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => (
            <li
              key={r.ticker}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => pick(r.ticker)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 9px',
                borderRadius: 6,
                cursor: 'pointer',
                background:
                  i === activeIndex ? 'color-mix(in srgb, var(--color-text) 7%, transparent)' : 'transparent',
              }}
            >
              <CompanyLogo key={r.ticker} src={r.img} alt="" size={22} />
              <span style={{ width: 52, flex: 'none', font: '500 13px var(--font-mono-data)', color: 'var(--color-accent-400)' }}>
                {r.ticker}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name ?? r.ticker}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
