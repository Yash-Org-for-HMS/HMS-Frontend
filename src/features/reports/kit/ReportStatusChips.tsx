import { Box, Chip } from "@mui/material";
import { BRAND } from "@/styles/accents";
import { useReportParam } from "./useReportParam";

export interface StatusFilterOption {
  /** Value written to the URL. The `all` option should use the fallback value. */
  key: string;
  label: string;
  /** Shown beside the label, so the reader sees the split before choosing. */
  count?: number;
}

/**
 * The status filter row above a register, held in the URL.
 *
 * Registers previously either had no filter at all — so a link meaning "the
 * four pending ones" could only land on the whole table — or carried their own
 * copy of this chip row. One implementation keeps them consistent and makes
 * every register linkable to a subset.
 */
export default function ReportStatusChips({
  options, param = "status", fallback = "all", accent = BRAND.action, children,
}: {
  options: StatusFilterOption[];
  /** URL parameter to hold the selection. */
  param?: string;
  /** The "no filter" value; kept out of the URL. */
  fallback?: string;
  accent?: string;
  /** Extra controls (e.g. a "needs attention" toggle) placed after a divider. */
  children?: React.ReactNode;
}) {
  const [value, setValue] = useReportParam(param, fallback);

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <Chip
            key={o.key}
            size="small"
            label={o.count == null ? o.label : `${o.label} (${o.count})`}
            onClick={() => setValue(o.key)}
            variant={selected ? "filled" : "outlined"}
            sx={selected ? { bgcolor: accent, color: "#fff", fontWeight: 700 } : { fontWeight: 600 }}
          />
        );
      })}
      {children && <Box sx={{ width: 1, height: 20, bgcolor: "divider", mx: 0.5 }} />}
      {children}
    </Box>
  );
}
