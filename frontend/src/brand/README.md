# yuRi Research — brand assets

## Files

| File | Use |
| --- | --- |
| `yuri-lockup-dark.svg` | Primary lockup (wordmark + RESEARCH) on dark grounds — splash, login, footer, share cards |
| `yuri-lockup-light.svg` | Same, for light grounds |
| `yuri-wordmark-dark.svg` | Wordmark alone — the nav, anywhere the name is already understood |
| `yuri-wordmark-light.svg` | Same, for light grounds |
| `favicon.svg` | Browser tab, PWA, app icon — `y` with the accent tittle on the tile ground |
| `favicon-light.svg` | Same on the page ground, for light-tile contexts |
| `png/` | Raster exports at fixed sizes (see below) |

## Colours

| Role | Hex |
| --- | --- |
| Accent — the tittle, the dot | `#9184D9` |
| Ink — wordmark | `#E9E9ED` |
| Ink on light ground | `#161826` |
| Favicon tile | `#0F1119` |
| Subline (dark ground) | `#9397AB` |
| Subline (light ground) | `#5F6376` |

## Typeface

Familjen Grotesk, weight 500, tracking −0.035em for the wordmark. The subline is Inter 500, uppercase, tracking 0.34em.

The SVGs keep the text **live**, so the family must be available wherever they are used inline:

```html
<link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500&display=swap" rel="stylesheet">
```

For anywhere the font cannot load — an `<img src="logo.svg">`, email, print, a third-party service — use the PNGs, or open an SVG in Figma or Illustrator and convert the text to outlines once.

## Construction

The wordmark is set from a **dotless i** (U+0131) with the tittle drawn as a separate accent circle. That is the whole idea of the mark: the accent appears exactly once, and it is part of the letterform rather than an ornament beside it. Do not substitute a normal `i`.

The capital **R** is Research, so the word already carries the idea — the subline is for audiences meeting the name cold, not a permanent fixture.

## Rules

- Clear space: one `y` x-height on every side. The SVGs already carry 8px of padding at their native scale.
- Minimum sizes: lockup 120px wide, wordmark 64px wide, favicon 16px.
- Never bolden past weight 500, never add a gradient to the type, never re-colour the tittle to anything but the accent.
- On photographs, place the lockup on a solid or heavily darkened area — no outline, no drop shadow.

## Favicon wiring

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/png/favicon-32.png" sizes="32x32">
<link rel="icon" href="/brand/png/favicon-16.png" sizes="16x16">
<link rel="apple-touch-icon" href="/brand/png/apple-touch-icon-180.png">
```
