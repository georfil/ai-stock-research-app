import wordmarkDarkSvg from '../brand/yuri-wordmark-dark.svg?raw';
import wordmarkPng from '../brand/png/yuri-wordmark-dark-trimmed.png';
import lockupPng from '../brand/png/yuri-lockup-dark.png';

// The wordmark renders its own SVG markup inline (not <img src="...svg">) —
// an <img>-embedded SVG is rendered without access to the page's loaded
// fonts, so the live Familjen Grotesk text falls back to a default face with
// different metrics and the accent tittle drifts off the dotless i. Inlined
// into the DOM, it resolves against the Familjen Grotesk link already in
// index.html like any other text on the page. The app is dark-ground only,
// so there's no light variant to wire up here.

const WORDMARK_VIEWBOX_RATIO = 183.37 / 135;

interface BrandMarkProps {
  /** Any CSS length — a number is px, a string can be a clamp() so the mark
   *  scales with the viewport. Width always follows from the aspect ratio. */
  height?: number | string;
}

/** Wordmark alone — for contexts where the name is already understood, like the nav. */
export function YuriWordmark({ height = 20 }: BrandMarkProps) {
  // The inline SVG needs real numbers on its own width/height attributes, so
  // this one keeps a numeric height; the rasters below take any CSS length.
  const px = typeof height === 'number' ? height : parseFloat(height);
  const width = px * WORDMARK_VIEWBOX_RATIO;
  const markup = wordmarkDarkSvg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${px}"`);
  return <span style={{ display: 'block', width, height: px }} dangerouslySetInnerHTML={{ __html: markup }} />;
}

/** Wordmark alone, raster — same mark as YuriWordmark, as a plain <img> instead of inline SVG. */
export function YuriWordmarkPng({ height = 20 }: BrandMarkProps) {
  return <img src={wordmarkPng} alt="yuRi" style={{ display: 'block', height, width: 'auto' }} />;
}

/** Wordmark + RESEARCH subline — for first impressions: splash, login, footer, share cards. */
export function YuriLockup({ height = 44 }: BrandMarkProps) {
  return <img src={lockupPng} alt="yuRi Research" style={{ display: 'block', height, width: 'auto' }} />;
}
