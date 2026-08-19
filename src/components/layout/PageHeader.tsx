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
 * button(s) pinned top-right. Used across the panels so the title and primary
 * action always sit in the same place.
 *
 * The row is top-aligned, not bottom-aligned. Bottom-aligning made the title's
 * position depend on which was taller — the title block or the buttons — so a
 * page with no subtitle rendered its title 5px lower than its neighbours
 * (measured: Lab Orders Queue at y=29 against y=24 everywhere else). The title
 * is the thing the eye tracks between pages, so its top is what must not move.
 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mb: 4,
      }}
    >
      {/* minWidth:0 lets a long title wrap instead of widening the header. */}
      <Box sx={{ minWidth: 0 }}>
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
      {/* flexShrink:0 keeps the buttons full-size beside the title on desktop;
          once the row wraps on a phone they must be free to stack, or a pair of
          buttons is wider than the screen and the whole page scrolls sideways. */}
      {actions && <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0, flexWrap: "wrap", maxWidth: "100%" }}>{actions}</Box>}
    </Box>
  );
}
