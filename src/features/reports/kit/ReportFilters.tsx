import type { ReactNode } from "react";
import { Box, Chip, TextField } from "@mui/material";
import dayjs from "dayjs";

export interface DateRange { from: string; to: string; }

const iso = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");

/** Preset ranges, computed relative to today. */
export const RANGE_PRESETS: { key: string; label: string; range: () => DateRange }[] = [
  { key: "today", label: "Today", range: () => ({ from: iso(dayjs()), to: iso(dayjs()) }) },
  { key: "7d", label: "Last 7 days", range: () => ({ from: iso(dayjs().subtract(6, "day")), to: iso(dayjs()) }) },
  { key: "30d", label: "Last 30 days", range: () => ({ from: iso(dayjs().subtract(29, "day")), to: iso(dayjs()) }) },
  { key: "90d", label: "Last 90 days", range: () => ({ from: iso(dayjs().subtract(89, "day")), to: iso(dayjs()) }) },
  { key: "mtd", label: "Month to date", range: () => ({ from: iso(dayjs().startOf("month")), to: iso(dayjs()) }) },
];

/**
 * Unified report filter bar: date-range presets + custom from/to, plus any
 * extra dimension controls (doctor, department, ward, payer…) passed as
 * children so every report drills down the same way, in one row.
 */
export default function ReportFilters({ value, onChange, presets = true, children }: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: boolean;
  children?: ReactNode;
}) {
  const activePreset = presets
    ? RANGE_PRESETS.find((p) => { const r = p.range(); return r.from === value.from && r.to === value.to; })?.key
    : undefined;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 2.5 }}>
      {presets && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {RANGE_PRESETS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              color={activePreset === p.key ? "primary" : "default"}
              variant={activePreset === p.key ? "filled" : "outlined"}
              onClick={() => onChange(p.range())}
            />
          ))}
        </Box>
      )}
      <TextField
        type="date" size="small" label="From" InputLabelProps={{ shrink: true }}
        value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })}
        sx={{ width: 160 }}
      />
      <TextField
        type="date" size="small" label="To" InputLabelProps={{ shrink: true }}
        value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })}
        sx={{ width: 160 }}
      />
      {children}
    </Box>
  );
}
