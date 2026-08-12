import { SEMANTIC, NEUTRAL } from "@/styles/accents";

/**
 * Period-over-period comparison, shared by the reports KPI tile and the
 * dashboard stat card.
 *
 * This used to live in `features/reports/kit/chartTheme`, which meant a shared
 * component in `src/components` could not use it without importing from a
 * feature — so the dashboards showed bare counts with no baseline while the
 * reports right next door showed deltas. It lives here now; chartTheme
 * re-exports it, so existing imports are unaffected.
 */

/** Delta direction cues (always paired with an arrow, never colour alone). */
export const DELTA_GOOD = SEMANTIC.success;
export const DELTA_BAD = SEMANTIC.danger;
export const DELTA_FLAT = NEUTRAL.muted;

export interface Delta {
  /** Percentage change, or null when there is no comparable baseline. */
  pct: number | null;
  dir: "up" | "down" | "flat";
  color: string;
}

/**
 * Percentage change of `current` vs `previous`, plus the direction and whether
 * that direction is "good" (given whether higher is better for this metric).
 * Returns a null pct when there's no comparable baseline — callers should show
 * nothing rather than a meaningless "0%" or "∞".
 */
export function computeDelta(
  current: number,
  previous: number | null | undefined,
  higherIsBetter = true,
): Delta {
  if (previous == null || previous === 0 || !Number.isFinite(previous)) {
    return { pct: null, dir: "flat", color: DELTA_FLAT };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const dir = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  if (dir === "flat") return { pct, dir, color: DELTA_FLAT };
  const good = dir === "up" ? higherIsBetter : !higherIsBetter;
  return { pct, dir, color: good ? DELTA_GOOD : DELTA_BAD };
}
