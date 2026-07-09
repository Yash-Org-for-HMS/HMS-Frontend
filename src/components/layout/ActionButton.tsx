import { Button, type ButtonProps } from "@mui/material";

interface ActionButtonProps extends ButtonProps {
  /** Gradient start color — the module's accent. */
  accentFrom?: string;
  /** Gradient end color — the module's accent. */
  accentTo?: string;
}

/**
 * Primary action button with a fixed size, shape and position behaviour, but a
 * per-module accent color. This keeps every "Add / New …" button visually
 * consistent in layout while preserving each module's color identity.
 */
export default function ActionButton({
  accentFrom = "#6366f1",
  accentTo = "#8b5cf6",
  sx,
  ...rest
}: ActionButtonProps) {
  const gradient = `linear-gradient(135deg, ${accentFrom} 0%, ${accentTo} 100%)`;
  return (
    <Button
      variant="contained"
      sx={{
        textTransform: "none",
        fontWeight: 600,
        borderRadius: 2,
        px: 2.5,
        py: 1,
        whiteSpace: "nowrap",
        background: gradient,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        "&:hover": { background: gradient, filter: "brightness(0.95)" },
        ...sx,
      }}
      {...rest}
    />
  );
}
