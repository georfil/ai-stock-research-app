import { useEffect, useState } from 'react';

/** The viewport width below which the app switches to its narrow layout.
 *
 *  Deliberately the same threshold the two-column grid uses in index.css
 *  (`min-width: 1160px`): the stock page is either the two-column desktop
 *  layout or the narrow one, never an in-between where the grid has
 *  collapsed to a single column but the narrow layout hasn't taken over.
 *  Kept in sync by hand — one is CSS and the other JS, so they can't share
 *  a value. The .98 closes the fractional-width gap against that min-width.
 *
 *  Note this is *not* the phone-tuning breakpoint, which stays at 720px in
 *  index.css: between the two, the narrow layout runs on the fluid type and
 *  spacing clamps rather than phone-sized fixed values. */
export const MOBILE_QUERY = '(max-width: 1159.98px)';

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
