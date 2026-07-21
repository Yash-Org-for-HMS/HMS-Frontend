import { Chip, type ChipProps } from "@mui/material";
import { NEUTRAL } from "@/styles/accents";

interface StatusChipProps extends Omit<ChipProps, "color" | "label"> {
  /** Human-readable status text (falls back to "—"). */
  label?: string | null;
  /** Accent colour (hex) — usually the server-provided `statusColor`. */
  color?: string | null;
}

const FALLBACK = NEUTRAL.muted;

/**
 * The soft-tinted status chip used across appointment/invoice/queue lists.
 * Replaces the ~10 hand-rolled `<Chip sx={{ bgcolor: `${statusColor}22`, … }}>`
 * copies so the status look is defined once.
 */
export default function StatusChip({ label, color, size = "small", sx, ...rest }: StatusChipProps) {
  const c = color || FALLBACK;
  return (
    <Chip
      label={label || "—"}
      size={size}
      sx={{
        bgcolor: `${c}22`,
        color: c,
        border: `1px solid ${c}55`,
        fontWeight: 600,
        fontSize: "0.75rem",
        ...sx,
      }}
      {...rest}
    />
  );
}
