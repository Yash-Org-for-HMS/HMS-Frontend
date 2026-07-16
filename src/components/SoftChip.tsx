import { Chip, type SxProps, type Theme } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

interface SoftChipProps {
  /** Chip text. */
  label: ReactNode;
  /** Optional small leading icon element (e.g. <CheckCircleRounded sx={{ fontSize: 14 }} />). */
  icon?: ReactElement;
  /** Soft background tint, e.g. "rgba(16,185,129,0.12)". */
  bg: string;
  /** Text / icon colour (hex). */
  color: string;
  sx?: SxProps<Theme>;
}

/**
 * A small soft-tinted status pill with an optional leading icon — the
 * `<Chip icon label size="small" sx={{ bgcolor, color, fontWeight: 700 }} />`
 * that the IPD lab / radiology / medicine dialogs each rendered from a local
 * status map. Distinct from StatusChip (which derives its tint from a single
 * colour and carries no icon). Callers keep their own `{ label, icon, bg, color }`
 * map and spread it in: `<SoftChip {...statusMap[status]} />`.
 */
export default function SoftChip({ label, icon, bg, color, sx }: SoftChipProps) {
  return (
    <Chip
      icon={icon}
      label={label}
      size="small"
      sx={{ bgcolor: bg, color, fontWeight: 700, ...sx }}
    />
  );
}
