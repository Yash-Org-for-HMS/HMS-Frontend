import type { ReactNode } from "react";
import { Box, Paper, Typography, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ArrowUpwardRounded, ArrowDownwardRounded, RemoveRounded } from "@mui/icons-material";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
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
  /** Optional sparkline series (current-period trend). */
  spark?: number[];
  icon?: ReactNode;
  /** Accent for the icon tile (panel accent by default via caller). */
  accent?: string;
  /** Extra caption under the value (e.g. "of 210 total"). */
  sub?: ReactNode;
}

/**
 * The single KPI tile for reports: a headline number that also answers "which
 * way is it moving?" via a delta vs the previous period and an optional
 * sparkline — so a metric reads as insight, not a bare figure.
 */
export default function KpiCard({
  label, value, current, previous, higherIsBetter = true, spark, icon, accent = seriesColor(0), sub,
}: KpiCardProps) {
  const delta = current != null ? computeDelta(current, previous, higherIsBetter) : null;
  const showDelta = delta != null && delta.pct != null;
  const DeltaIcon = delta?.dir === "up" ? ArrowUpwardRounded : delta?.dir === "down" ? ArrowDownwardRounded : RemoveRounded;

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, height: "100%", bgcolor: "background.paper", border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
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
        {showDelta && (
          <Tooltip title="vs previous period">
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1.5, bgcolor: alpha(delta!.color, 0.12), color: delta!.color, flexShrink: 0 }}>
              <DeltaIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {Math.abs(delta!.pct!).toFixed(1)}%
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1, wordBreak: "break-word" }}>
        {value}
      </Typography>

      {sub && <Typography variant="caption" sx={{ color: "text.secondary" }}>{sub}</Typography>}

      {spark && spark.length > 1 && (
        <Box sx={{ height: 34, mt: "auto" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill={`url(#spark-${label.replace(/\W/g, "")})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
