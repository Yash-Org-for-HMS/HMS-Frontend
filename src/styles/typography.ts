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
export const typeScale = {
  /** Page-level screen title (where a shared PageHeader isn't used). */
  pageTitle: { fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
  /** Card / panel heading. */
  cardTitle: { fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em" },
  /** Small all-caps eyebrow above a group of fields/section. */
  sectionLabel: {
    fontSize: "0.72rem",
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
