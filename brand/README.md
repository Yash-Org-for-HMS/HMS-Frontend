# Brand source

`Dolphin_logo.ai` is the master artwork. It lives **here and not in `public/`**
because everything in `public/` is copied verbatim into `dist/` and served — a
1.5 MB Illustrator source was being shipped to every visitor and was publicly
downloadable. Nothing in the app referenced it.

Despite the extension it is a PDF (`%PDF-1.6`), so it opens without Illustrator
— any PDF reader, or `pdfjs-dist`, will render it.

## What is on each artboard

All three are 1920 × 1080 pt.

1. The app-icon tile (white glyph knocked out of a blue rounded square), and the
   loose blue glyph beside it.
2. The variant sheet — tile on white with a border, the `dolphin HMS` lockup,
   stacked logo-over-tile combinations, and the horizontal lockup.
3. The horizontal lockup on white and on brand blue.

## What the app actually uses, and where it came from

| Shipped file | Source |
|---|---|
| `public/dolphin-icon.png` | artboard 1's tile, re-rendered from the vector at 512 px |
| `public/Dolphin_logo_blue.png` | the horizontal lockup, supplied as PNG |

`BRAND.action` in `src/styles/accents.ts` is `#0C73B5` — the exact fill of the
tile on artboard 1, not an approximation.

## Not yet used

- `public/Dolphin_logo_white.png` — the knockout lockup for dark grounds. There
  is no dark mode, so it has no home yet.
- Artboard 2's variants (the bordered tile, the `dolphin HMS` lockup, the
  stacked combinations).

## Known defect in the artwork — partly fixed

The tagline originally read **"Hospital Managment System"**, missing the `e` in
*Management*. Baked into the vector, so it needed a re-export rather than a code
fix.

- `public/Dolphin_logo_blue.png` — **corrected** (replaced 17 Sep 2026). This is
  the one the app displays, so every visible surface is now right.
- `public/Dolphin_logo_white.png` — **still misspelled**. Unused today, but it
  will need the same re-export before any dark surface uses it.
- `Dolphin_logo.ai` — **still misspelled**, on every artboard that shows the
  tagline. Anything cut from this file in future inherits the typo. The app icon
  is unaffected: it is the glyph alone and carries no text.
