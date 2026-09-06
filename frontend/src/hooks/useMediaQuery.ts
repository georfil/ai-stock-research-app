import { useEffect, useState } from 'react';

/** The viewport width below which the app switches to its narrow layout.
 *  Kept in sync with the `max-width` block in index.css by hand — the two
 *  can't share a value, since one is CSS and the other is JS. */
export const MOBILE_QUERY = '(max-width: 720px)';

/** Subscribes to a media query. For layouts that differ in *structure*, not
 *  just style — a CSS query can restyle a nav, but it can't swap a search
 *  field for a button that opens an overlay. Style-only differences should
 *  stay in the stylesheet rather than come through here. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
