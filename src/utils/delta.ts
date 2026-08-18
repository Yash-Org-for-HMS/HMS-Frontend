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
  /** Absolute change (current − previous), for baselines too small for a %. */
  abs: number | null;
  /**
   * How this should be shown. A percentage off a tiny baseline is misleading —
   * two orders growing to twelve is "+500%", which reads like a surge rather
   * than ten orders. Below MIN_PCT_BASELINE the absolute change is the honest
   * figure.
   */
  mode: "pct" | "abs" | "none";
  dir: "up" | "down" | "flat";
  color: string;
}

/**
 * Smallest previous-period value for which a percentage is worth showing.
 * Money baselines are virtually always above this, so currency metrics keep
 * their percentages; low-count metrics switch to "+10" instead of "+500%".
 */
export const MIN_PCT_BASELINE = 10;

/**
 * Percentage change of `current` vs `previous`, plus the direction and whether
 * that direction is "good" (given whether higher is better for this metric).
 * Returns a null pct when there's no comparable baseline — callers should show
 * nothing rather than a meaningless "0%" or "∞".
 */
export function computeDelta(
  current: number | string,
  previous: number | string | null | undefined,
  higherIsBetter = true,
): Delta {
  // Money reaches the UI as a decimal STRING (Prisma Decimal), and
  // `Number.isFinite("120.50")` is false — so a string baseline used to fall
  // through the guard below and return mode "none", silently dropping the delta
  // chip rather than failing. Every call site happens to wrap in Number() today;
  // coercing here means the next one that forgets still works.
  const cur = Number(current);
  const prev = previous == null ? null : Number(previous);
  if (prev == null || prev === 0 || !Number.isFinite(prev) || !Number.isFinite(cur)) {
    return { pct: null, abs: null, mode: "none", dir: "flat", color: DELTA_FLAT };
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const abs = cur - prev;
  const mode = Math.abs(prev) >= MIN_PCT_BASELINE ? "pct" : "abs";
  const dir = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  if (dir === "flat") return { pct, abs, mode, dir, color: DELTA_FLAT };
  const good = dir === "up" ? higherIsBetter : !higherIsBetter;
  return { pct, abs, mode, dir, color: good ? DELTA_GOOD : DELTA_BAD };
}
