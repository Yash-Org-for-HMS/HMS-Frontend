import { ACCENTS } from "../styles/accents";
import { Box, Paper, Typography, Skeleton } from "@mui/material";
import { alpha } from "@mui/material/styles";
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
}

const DEFAULT_ACCENT = ACCENTS.doctor;

/**
 * The single stat/KPI card used across every dashboard. Replaces the ~8
 * near-identical local `StatCard`/`StatTile` implementations that had drifted
 * apart on padding, radius and icon styling. Callers pass their module accent
 * via `color`; everything else is standardised here.
 */
export default function StatCard({
  icon, label, value, color = DEFAULT_ACCENT, sub, loading = false, onClick, layout = "vertical",
}: StatCardProps) {
  const clickable = Boolean(onClick);
  const horizontal = layout === "horizontal";
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;
  const tileSize = horizontal ? 44 : 48;

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
        p: horizontal ? 2 : 3,
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
        justifyContent: "space-between",
        minHeight: horizontal ? 0 : 160,
        "&:hover": clickable || !horizontal
          ? { boxShadow: "0 8px 30px rgba(0,0,0,0.06)", transform: "translateY(-2px)" }
          : undefined,
      }}
    >
      {horizontal ? IconTile : (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          {IconTile}
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        {loading ? (
          <Skeleton width={80} height={40} />
        ) : (
          <Typography
            variant={horizontal ? "h6" : "h4"}
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
    </Paper>
  );
}
