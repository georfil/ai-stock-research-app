import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickerSearch } from '../hooks/useTickerSearch';

export function TickerSearch() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { results } = useTickerSearch(query);
  const navigate = useNavigate();
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showResults = isFocused && results.length > 0;

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
    <div style={{ position: 'relative', width: 340 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          minHeight: 34,
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--color-text) 16%, transparent)',
          borderRadius: 8,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" style={{ flex: 'none', opacity: 0.5 }}>
          <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
        </svg>
        <input
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Defer so a click on a result registers before the list unmounts.
            blurTimer.current = setTimeout(() => setIsFocused(false), 120);
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
            font: '400 14px var(--font-body)',
            padding: '7px 0',
          }}
        />
      </div>

      {showResults && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            zIndex: 40,
            margin: 0,
            padding: 5,
            listStyle: 'none',
            borderRadius: 8,
            background: 'var(--color-surface)',
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
              <span style={{ width: 52, flex: 'none', font: '500 13px ui-monospace, Menlo, monospace', color: 'var(--color-accent-400)' }}>
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
}
