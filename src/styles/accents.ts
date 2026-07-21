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
// NOTE: the first seven values (doctor…admin) are unchanged from the original
// module and must keep their exact values — existing imports depend on them.
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

export type AccentKey = keyof typeof ACCENTS;
export type SemanticKey = keyof typeof SEMANTIC;

/**
 * Tint helper for the icon-tile / chip background pattern used across the
 * dashboards (`alpha(color, 0.12)`). Re-exported from here so callers can pull
 * the colour and its tint from one place.
 */
export { alpha } from "@mui/material/styles";
