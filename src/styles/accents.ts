/**
 * Colour tokens — the single source of truth for accent and semantic colours.
 *
 * `SEMANTIC` is meaning-based and identical in every panel (success = emerald,
 * danger = red, warning = amber, info = blue), mirroring the MUI palette so the
 * two stay in lockstep. `NEUTRAL` holds the greys pages would otherwise
 * hardcode. Naming them here is what stops ~700 hex literals drifting on shade.
 */

// ── Per-panel accents ─────────────────────────────────────────────────────
// SUPERSEDED for theming: every panel themes from BRAND below, so chrome is
// identical app-wide and a panel is identified by title and logo, not colour.
// Seven accents across ~700 literals drifted badly — panels shipped each
// other's colours. Kept because non-layout code still imports these; the first
// seven values must not change.
export const ACCENTS = {
  doctor: "#3b82f6",
  doctorDark: "#2563eb",
  nurse: "#a78bfa",
  nurseDark: "#7c3aed",
  reception: "#0891b2",
  receptionDark: "#0e7490",
  admin: "#6366f1",

  // ── Added in the color-system centralization ─────────────────────────────
  adminDark: "#4f46e5",
  // Hospital-admin shell shares the indigo admin family.
  hospital: "#6366f1",
  hospitalDark: "#4f46e5",

  // Provisional — final values for pharmacy / lab / ipd are confirmed before
  // those panels are migrated (color-system Phase 3). Nothing references them
  // yet, so these are inert placeholders and change nothing on screen.
  pharmacy: "#0d9488",
  pharmacyDark: "#0f766e",
  lab: "#06b6d4",
  labDark: "#0891b2",
  ipd: "#7c3aed",
  ipdDark: "#6d28d9",
} as const;

/**
 * The one action colour. Every button in every panel is painted with this, so
 * "save" looks like "save" whether you're in Pharmacy or Reception — a primary
 * action shouldn't change colour just because of which screen you're on.
 *
 * Panel accents above still brand each area (sidebar, icons, headings), so you
 * can tell where you are; only the ACTIONS are unified. Indigo is deliberate:
 * it sits mid-way along the cool range the panel accents span (teal → cyan →
 * blue → indigo → violet), so it sits harmoniously against every one of them
 * rather than clashing with the teal and violet ends.
 */
export const BRAND = {
  action: "#6366f1",
  actionDark: "#4f46e5",
} as const;

// ── Layer 2: semantic colours (mirror the MUI theme palette) ────────────────
export const SEMANTIC = {
  success: "#10b981",
  successLight: "#34d399",
  successDark: "#059669",
  danger: "#ef4444",
  dangerLight: "#f87171",
  dangerDark: "#dc2626",
  warning: "#f59e0b",
  warningLight: "#fbbf24",
  warningDark: "#d97706",
  info: "#3b82f6",
  infoLight: "#60a5fa",
  infoDark: "#2563eb",
} as const;

// ── Neutrals (kept in sync with theme text/divider) ─────────────────────────
export const NEUTRAL = {
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  muted: "#64748b",
  line: "#e2e8f0",
  subtle: "#f1f5f9",
  surface: "#f9fafb",
} as const;

/**
 * Disabled state for contained buttons carrying a gradient.
 *
 * A gradient is a background-IMAGE and MUI's disabled rule sets only
 * background-COLOR, so without this a disabled button keeps its brand colour
 * and reads as clickable. `background` (not `backgroundColor`) clears the
 * image. Repeated in ActionButton, whose `sx` outranks the theme override.
 */
export const DISABLED_CONTAINED = {
  background: "rgba(15, 23, 42, 0.08)",
  // 3.8:1 on that ground — muted enough to read as inert, dark enough to read.
  color: "rgba(15, 23, 42, 0.55)",
  boxShadow: "none",
} as const;

export type AccentKey = keyof typeof ACCENTS;
export type SemanticKey = keyof typeof SEMANTIC;

/**
 * Tint helper for the icon-tile / chip background pattern used across the
 * dashboards (`alpha(color, 0.12)`). Re-exported from here so callers can pull
 * the colour and its tint from one place.
 */
export { alpha } from "@mui/material/styles";
