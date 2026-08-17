import { ACCENTS, BRAND } from "@/styles/accents";
import { Box, Paper, Typography, Skeleton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ArrowUpwardRounded, ArrowDownwardRounded, RemoveRounded } from "@mui/icons-material";
import { computeDelta } from "@/utils/delta";
import type { ReactNode } from "react";

export interface StatCardProps {
  icon: ReactNode;
  /** Label shown under (vertical) or beside (horizontal) the value. */
  label: string;
  value: ReactNode;
  /** Accent colour (hex) for the icon tile — and the value in the horizontal layout. */
  color?: string;
  /** Optional secondary line under the value. */
  sub?: ReactNode;
  loading?: boolean;
  /** When set, the whole card becomes clickable. */
  onClick?: () => void;
  /** "vertical" (icon top, big value below — default) or "horizontal" (icon left). */
  layout?: "vertical" | "horizontal";
  /**
   * Raw current value. Pass with `previous` to show a ▲/▼ chip — the same
   * comparison the reports KPI tile uses. A count with no baseline can't tell
   * anyone whether the day is going well, which is why every dashboard tile
   * should carry one where a sensible baseline exists.
   */
  current?: number;
  /** Raw comparable value from the prior period. */
  previous?: number | null;
  /** Whether a higher value is good — drives the delta colour. Default true. */
  higherIsBetter?: boolean;
  /** What the comparison is against, shown on hover. Default "vs previous period". */
  deltaLabel?: string;
}

const DEFAULT_ACCENT = BRAND.action;

/**
 * The single stat/KPI card used across every dashboard. Replaces the ~8
 * near-identical local `StatCard`/`StatTile` implementations that had drifted
 * apart on padding, radius and icon styling. Callers pass their module accent
 * via `color`; everything else is standardised here.
 */
export default function StatCard({
  icon, label, value, color = DEFAULT_ACCENT, sub, loading = false, onClick, layout = "vertical",
  current, previous, higherIsBetter = true, deltaLabel = "vs previous period",
}: StatCardProps) {
  const clickable = Boolean(onClick);
  const horizontal = layout === "horizontal";
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  const tileSize = horizontal ? 44 : 40;

  // No baseline (no previous, or a previous of zero) means no honest percentage
  // to show, so the chip is simply absent rather than reading "0%" or "∞".
  const delta = current != null ? computeDelta(current, previous, higherIsBetter) : null;
  const showDelta = !loading && delta != null && delta.mode !== "none";
  // Below MIN_PCT_BASELINE a percentage overstates the move, so show the plain
  // difference instead — same rule as the reports KPI tile.
  const deltaText = delta == null ? ""
    : delta.mode === "abs"
      ? `${delta.abs! > 0 ? "+" : ""}${Math.round(delta.abs!)}`
      : `${Math.abs(delta.pct!).toFixed(1)}%`;
  const DeltaIcon = delta?.dir === "up" ? ArrowUpwardRounded : delta?.dir === "down" ? ArrowDownwardRounded : RemoveRounded;

  const DeltaChip = showDelta ? (
    <Tooltip title={deltaLabel}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1.5, bgcolor: alpha(delta!.color, 0.12), color: delta!.color, flexShrink: 0 }}>
        <DeltaIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {deltaText}
        </Typography>
      </Box>
    </Tooltip>
  ) : null;

  const IconTile = (
    <Box
      sx={{
        width: tileSize,
        height: tileSize,
        borderRadius: horizontal ? 2.5 : 3,
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: alpha(color, 0.12),
        color,
      }}
    >
      {icon}
    </Box>
  );

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: horizontal ? 2 : 2.5,
        borderRadius: horizontal ? 3 : 4,
        height: "100%",
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        transition: "all 0.2s ease-in-out",
        cursor: clickable ? "pointer" : "default",
        display: "flex",
        gap: horizontal ? 2 : 0,
        alignItems: horizontal ? "center" : "stretch",
        flexDirection: horizontal ? "row" : "column",
        // Vertical cards pack from the TOP (icon, then value) so the number sits
        // at the same height in every card of a row regardless of whether that
        // card has a `sub` line — "space-between" was bottom-anchoring the value
        // block, so a taller block (icon+value+label+sub) pushed its number up
        // while a shorter one (icon+value+label) let its number sit lower,
        // reading as an uneven row. Horizontal cards keep space-between (icon
        // and value sit side by side, not stacked, so this doesn't apply there).
        justifyContent: horizontal ? "space-between" : "flex-start",
        // Was 160 — a fixed floor much taller than the actual content (icon +
        // number + label, ~130px with the tightened padding/icon below), which
        // left a visible dead zone under cards that don't have a `sub` line.
        // 128 fits the common case snugly; a card WITH a sub line still grows
        // past it naturally (minHeight is a floor, not a cap), and Grid's
        // row-stretch keeps every card in a row equal to the tallest one.
        minHeight: horizontal ? 0 : 128,
        "&:hover": clickable || !horizontal
          ? { boxShadow: "0 8px 30px rgba(0,0,0,0.06)", transform: "translateY(-2px)" }
          : undefined,
      }}
    >
      {horizontal ? IconTile : (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          {IconTile}
          {DeltaChip}
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        {loading ? (
          <Skeleton width={80} height={40} />
        ) : (
          <Typography
            // h4 wrapped long currency values (e.g. "₹1,20,000.00") onto a
            // second line at typical card widths, which re-introduced the same
            // "numbers don't line up" look this component just fixed — h5 gives
            // the row enough margin to stay on one line while still reading as
            // the card's headline number.
            variant={horizontal ? "h6" : "h5"}
            noWrap={horizontal}
            sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1, wordBreak: horizontal ? undefined : "break-word" }}
          >
            {displayValue}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", mt: 0.5 }}
        >
          {label}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
            {sub}
          </Typography>
        )}
      </Box>

      {/* Horizontal cards have no icon row to hang the chip off, so it sits at
          the far end of the row instead. */}
      {horizontal && DeltaChip}
    </Paper>
  );
}
