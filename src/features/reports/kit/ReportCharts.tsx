import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar, BarChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";
import { CHART_INK, seriesColor, xAxisProps, yAxisProps } from "./chartTheme";

/** Framed chart surface with a title (and optional right-aligned action). */
export function ChartCard({ title, subtitle, action, height = 280, children }: {
  title: string; subtitle?: string; action?: ReactNode; height?: number; children: ReactNode;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" sx={{ color: "text.secondary" }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

const tooltipStyle = { borderRadius: 10, border: `1px solid ${CHART_INK.grid}`, fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" };

export interface Series { key: string; label: string; type?: "area" | "line" | "bar"; }

/**
 * Time-trend chart (single x-axis only — never dual-axis). Renders each series
 * as area/line/bar in fixed categorical order. Legend shown for >= 2 series.
 */
export function TrendChart({ data, xKey, series, valueFormatter, height = 280, title, subtitle, action }: {
  data: any[]; xKey: string; series: Series[]; valueFormatter?: (n: number) => string;
  height?: number; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} action={action} height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(i)} stopOpacity={0.28} />
              <stop offset="100%" stopColor={seriesColor(i)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey={xKey} {...xAxisProps} />
        <YAxis {...yAxisProps} tickFormatter={valueFormatter as any} />
        <RTooltip contentStyle={tooltipStyle} formatter={valueFormatter as any} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => s.type === "bar" ? (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={seriesColor(i)} radius={[4, 4, 0, 0]} maxBarSize={38} />
        ) : s.type === "line" ? (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={seriesColor(i)} strokeWidth={2} dot={false} />
        ) : (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={seriesColor(i)} strokeWidth={2} fill={`url(#grad-${s.key})`} />
        ))}
      </ComposedChart>
    </ChartCard>
  );
}

/** Category comparison (magnitude). Horizontal by default for readable labels. */
export function BreakdownBar({ data, categoryKey, valueKey, valueName, colorIndex = 0, horizontal = true, valueFormatter, height = 280, title, subtitle, action }: {
  data: any[]; categoryKey: string; valueKey: string; valueName?: string; colorIndex?: number;
  horizontal?: boolean; valueFormatter?: (n: number) => string; height?: number; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} action={action} height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 16, left: horizontal ? 8 : -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...xAxisProps} tickFormatter={valueFormatter as any} />
            <YAxis type="category" dataKey={categoryKey} {...yAxisProps} width={120} />
          </>
        ) : (
          <>
            <XAxis type="category" dataKey={categoryKey} {...xAxisProps} />
            <YAxis type="number" {...yAxisProps} tickFormatter={valueFormatter as any} />
          </>
        )}
        <RTooltip contentStyle={tooltipStyle} formatter={valueFormatter as any} />
        <Bar dataKey={valueKey} name={valueName || valueKey} fill={seriesColor(colorIndex)} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ChartCard>
  );
}

/** Part-to-whole breakdown as a donut. Slices coloured in fixed series order. */
export function DonutChart({ data, nameKey = "name", valueKey = "value", valueFormatter, height = 280, title, subtitle, action }: {
  data: any[]; nameKey?: string; valueKey?: string; valueFormatter?: (n: number) => string;
  height?: number; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} action={action} height={height}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="#fff" strokeWidth={2}>
          {data.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
        </Pie>
        <RTooltip contentStyle={tooltipStyle} formatter={valueFormatter as any} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ChartCard>
  );
}
