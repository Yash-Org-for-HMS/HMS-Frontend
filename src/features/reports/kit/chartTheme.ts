import { NEUTRAL } from "@/styles/accents";

/**
 * Report visualisation tokens (see the dataviz method).
 *
 * CHART_SERIES is a fixed-order categorical palette, validated on a white
 * (#ffffff) chart surface: it clears the lightness band, chroma floor, adjacent
 * CVD ΔE (worst 9.1) and normal-vision floor (worst 19.6). Three hues sit below
 * 3:1 contrast, so charts always ship with a legend/direct labels or a table —
 * which every report does. Assign by fixed order, never cycle a 9th hue: fold
 * the tail into "Other".
 */
export const CHART_SERIES = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const seriesColor = (i: number) => CHART_SERIES[((i % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];

/** Recessive chart chrome. */
export const CHART_INK = {
  grid: "#e1e0d9",
  axis: "#898781",
  text: NEUTRAL.textSecondary,
};

/**
 * Delta cues and maths now live in `@/utils/delta` so shared components outside
 * this feature (the dashboard stat card) can use them too. Re-exported here so
 * every existing import keeps working.
 */
export { DELTA_GOOD, DELTA_BAD, DELTA_FLAT, computeDelta, type Delta } from "@/utils/delta";

/** Shared recharts axis styling. */
export const xAxisProps = {
  tick: { fill: CHART_INK.axis, fontSize: 12 },
  axisLine: { stroke: CHART_INK.grid },
  tickLine: false,
} as const;
export const yAxisProps = {
  tick: { fill: CHART_INK.axis, fontSize: 12 },
  axisLine: false,
  tickLine: false,
  width: 44,
} as const;

