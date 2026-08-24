import type { ReactNode } from "react";
import { Box, Paper, Typography, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ArrowUpwardRounded, ArrowDownwardRounded, RemoveRounded } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { computeDelta, seriesColor } from "./chartTheme";

export interface KpiCardProps {
  label: string;
  /** Preformatted display value (e.g. "₹84,200", "142", "63%"). */
  value: ReactNode;
  /** Raw current value — needed to compute the delta vs `previous`. */
  current?: number;
  /** Raw previous-period value; when present a ▲/▼ delta chip is shown. */
  previous?: number | null;
  /** Whether a higher value is good (drives delta colour). Default true. */
  higherIsBetter?: boolean;
  icon?: ReactNode;
  /** Accent for the icon tile (panel accent by default via caller). */
  accent?: string;
  /** Extra caption under the value (e.g. "of 210 total"). */
  sub?: ReactNode;
  /**
   * Where this figure's records live. Set it and the tile becomes a link to the
   * register behind the number, so a reader who wants to know which records
   * make it up can go and see them instead of hunting for the right report.
   */
  href?: string;
}

/**
 * The single KPI tile for reports: a headline number that also answers "which
 * way is it moving?" via a delta vs the previous period — so a metric reads as
 * insight, not a bare figure.
 */
export default function KpiCard({
  label, value, current, previous, higherIsBetter = true, icon, accent = seriesColor(0), sub, href,
}: KpiCardProps) {
  const delta = current != null ? computeDelta(current, previous, higherIsBetter) : null;
  const showDelta = delta != null && delta.mode !== "none";
  // A percentage off a tiny baseline overstates the change (2 orders becoming
  // 12 is "+500%"), so below MIN_PCT_BASELINE show the plain difference.
  //
  // Magnitude only, in BOTH modes — the arrow beside it already carries the
  // direction. Signing the absolute value made a drop of one render as "↓ -1",
  // reading as a double negative, while the percentage mode next to it showed a
  // bare "96.6%"; the same chip disagreed with itself about whether the sign
  // belonged in the text.
  const deltaText = delta == null ? ""
    : delta.mode === "abs"
      ? String(Math.abs(Math.round(delta.abs!)))
      : `${Math.abs(delta.pct!).toFixed(1)}%`;
  const DeltaIcon = delta?.dir === "up" ? ArrowUpwardRounded : delta?.dir === "down" ? ArrowDownwardRounded : RemoveRounded;

  return (
    <Paper
      elevation={0}
      {...(href ? { component: RouterLink, to: href } : {})}
      sx={{
        p: 2.5, borderRadius: 3, height: "100%", bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 1,
        ...(href ? {
          textDecoration: "none", cursor: "pointer",
          transition: "border-color 120ms, box-shadow 120ms",
          "&:hover": { borderColor: accent, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" },
          "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2 },
        } : {}),
      }}
    >
      {/* The label gets the full row beside the icon. It used to share that row
          with the delta chip, which left roughly half the width for a caption
          like "AVG TIME TO RESULT" — it wrapped onto three lines and pushed the
          value down, so cards in the same grid disagreed on where the number
          sat. The chip now rides with the value, which is short. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        {icon && (
          <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(accent, 0.12), color: accent }}>
            {icon}
          </Box>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.2 }}>
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mt: "auto" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1, wordBreak: "break-word", minWidth: 0 }}>
          {value}
        </Typography>
        {showDelta && (
          <Tooltip title={delta!.mode === "abs" ? "Change vs previous period (baseline too small for a meaningful %)" : "vs previous period"}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1.5, bgcolor: alpha(delta!.color, 0.12), color: delta!.color, flexShrink: 0 }}>
              <DeltaIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {deltaText}
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>

      {sub && <Typography variant="caption" sx={{ color: "text.secondary" }}>{sub}</Typography>}
    </Paper>
  );
}
