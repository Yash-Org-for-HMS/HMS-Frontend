import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot for the primary action button(s). */
  actions?: ReactNode;
}

/**
 * Consistent page header: title (+ optional subtitle) on the left, action
 * button(s) pinned top-right. Used by every Super Admin page so the title and
 * primary action always sit in the same place.
 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mb: 4,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: "text.primary" }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
