import type { SxProps, Theme } from "@mui/material";

/**
 * Shared text scale. One small ladder instead of the ~270 ad-hoc `fontSize`
 * values scattered across panels (which spanned a dozen near-duplicate sizes
 * between 0.6–0.95rem). Spread a token into an sx prop:
 *
 *   <Typography sx={typeScale.sectionLabel}>Vitals</Typography>
 *   <Box sx={{ ...typeScale.caption, color: "error.main" }}>…</Box>
 *
 * Piloted on the Doctor panel; rolled to the rest once approved.
 */
/**
 * The ladder every size in the product now sits on.
 *
 * There were 31 distinct rem values across 118 files — nine different spellings
 * of "small" alone (0.58 through 0.70). Near-duplicate sizes for the same job
 * are what make a UI feel unconsidered, and they drift further with every
 * screen added. All 313 were snapped to the nearest rung below; 150 moved.
 *
 * Two rungs sit only 1px apart at the bottom, deliberately: 10px is for micro
 * pills living inside 17-18px chips, where 11px starts to crowd the pill, and
 * 11px is for dense labels that stand on their own.
 *
 * Use a token from typeScale where one fits. Where a raw size is unavoidable,
 * use a value FROM THIS LIST — anything between rungs re-opens the drift.
 */
export const FONT_SIZES = {
  chip: "0.625rem",    // 10px — micro pills inside 17-18px chips
  micro: "0.6875rem",  // 11px — dense standalone labels
  caption: "0.75rem",  // 12px — captions, section labels, table headers
  body: "0.875rem",    // 14px — default copy, table cells, buttons
  title: "1rem",       // 16px — card and panel headings
  large: "1.25rem",    // 20px — section headings
  page: "1.5rem",      // 24px — page titles
  hero: "2rem",        // 32px — the one number a screen is about
} as const;

export const typeScale = {
  /** Page-level screen title (where a shared PageHeader isn't used). */
  pageTitle: { fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
  /** Card / panel heading. */
  cardTitle: { fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em" },
  /** Small all-caps eyebrow above a group of fields/section. */
  sectionLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "text.secondary",
  },
  /** Default body copy inside cards/lists. */
  body: { fontSize: "0.875rem", fontWeight: 500 },
  /** Emphasised body (values, names). */
  bodyStrong: { fontSize: "0.875rem", fontWeight: 700 },
  /** Secondary / helper text, field labels, timestamps. */
  caption: { fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" },
  /** Chip / badge text. */
  chip: { fontSize: "0.75rem", fontWeight: 600 },
} satisfies Record<string, SxProps<Theme>>;
