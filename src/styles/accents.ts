/**
 * Product colour tokens — the single source of truth for accent & semantic
 * colours across every panel.
 *
 * TWO layers (see the color-system plan):
 *
 *  1. Panel accents (`ACCENTS`) — each realm has its own brand colour so staff
 *     can tell at a glance which area of the app they're in (reception = cyan,
 *     doctor = blue, nursing = violet, super-admin = indigo, …). This is the
 *     intentional colour-coding; previously every accent was re-declared as a
 *     magic hex in ~25 files.
 *
 *  2. Semantic colours (`SEMANTIC`) — meaning-based, identical in every panel:
 *     success/money = emerald, danger = red, warning/pending = amber,
 *     info = blue. These mirror the MUI theme palette so `color="success"`
 *     etc. and these tokens stay in lockstep.
 *
 * `NEUTRAL` collects the handful of grey/line values that pages hardcode for
 * muted text and borders, kept in sync with the theme's text palette.
 *
 * Nothing here changes the base theme (white surfaces, text colours, tables);
 * it only names the accent/semantic vocabulary so the scattered hex literals
 * can converge on one definition (and stop drifting on case/shade).
 */

// ── Layer 1: per-panel accents ────────────────────────────────────────────
// SUPERSEDED for theming. Every panel now themes from BRAND below, so buttons,
// sidebars and chrome are identical app-wide; a panel is identified by its
// title and logo ("Pharmacy Portal"), not by colour.
//
// Why: maintaining seven accents across ~700 colour literals drifted badly in
// practice — Hospital Admin shipped an EMERALD sidebar beside an indigo button,
// Lab was emerald too, Pharmacy's sidebar was indigo, and three panels painted
// buttons in another panel's colour entirely. One accent removes that whole
// class of bug.
//
// Kept because non-layout code still imports these, and because restoring
// per-panel branding only means passing them back to createPanelTheme.
// NOTE: the first seven values (doctor…admin) must keep their exact values —
// existing imports depend on them.
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
 * The disabled state for any contained button carrying a gradient.
 *
 * A gradient is a background-IMAGE. MUI's disabled rule only sets
 * background-COLOR, so without this the gradient paints over it and a disabled
 * button keeps its full brand colour — it reads as clickable, the user clicks,
 * nothing happens. The inherited label colour (rgba(0,0,0,.26)) only works on
 * MUI's grey; on the indigo gradient it measured 1.6:1.
 *
 * `background` rather than `backgroundColor` so the shorthand clears the image.
 * Applied by the theme's containedPrimary/containedSecondary, and again by
 * ActionButton, whose `sx` gradient outranks the theme override.
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
