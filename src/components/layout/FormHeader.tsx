import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBackRounded } from "@mui/icons-material";
import type { ReactNode } from "react";

interface FormHeaderProps {
  title: string;
  subtitle?: string;
  /** Called when the back button is pressed. */
  onBack: () => void;
  /** Optional right-aligned action(s). */
  actions?: ReactNode;
}

/**
 * Page header for create/edit form screens: a back button vertically centered
 * with the title (+ optional subtitle), and an optional actions slot. Replaces
 * the ad-hoc "IconButton + <PageHeader/>" rows that left the back button and
 * title misaligned (PageHeader carries its own margin and a large h4).
 */
export default function FormHeader({ title, subtitle, onBack, actions }: FormHeaderProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
      <IconButton
        onClick={onBack}
        aria-label="Go back"
        sx={{
          flexShrink: 0,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          color: "text.primary",
          "&:hover": { bgcolor: "action.hover", borderColor: "text.disabled" },
        }}
      >
        <ArrowBackRounded />
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: "text.primary", lineHeight: 1.2 }}
          noWrap
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
