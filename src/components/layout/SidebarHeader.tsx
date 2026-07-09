import { Box, Toolbar, Typography } from "@mui/material";
import { LocalHospitalRounded } from "@mui/icons-material";
import type { ReactNode } from "react";
import { assetUrl } from "../../utils/assetUrl";

interface SidebarHeaderProps {
  /** Raw hospital logo path (passed through assetUrl). Falls back to an icon tile. */
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  /** Glyph shown in the tile when there's no logo image. */
  fallbackIcon?: ReactNode;
}

/**
 * The shared sidebar brand header (logo tile + hospital/portal name + subtitle),
 * used by every panel layout so they stay visually identical. All colours come
 * from the theme so there's no per-panel drift.
 */
export default function SidebarHeader({ logoUrl, title, subtitle, fallbackIcon }: SidebarHeaderProps) {
  return (
    <Toolbar
      sx={{
        px: 2.5,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        minHeight: "70px !important",
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          bgcolor: logoUrl ? "transparent" : "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: logoUrl ? "none" : "0 4px 14px rgba(79, 70, 229, 0.35)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {logoUrl ? (
          <img src={assetUrl(logoUrl)} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          fallbackIcon ?? <LocalHospitalRounded fontSize="medium" sx={{ color: "#fff" }} />
        )}
      </Box>
      <Box sx={{ overflow: "hidden", minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: 170, color: "text.primary" }}>
          {title}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: "block", color: "text.secondary", fontWeight: 600 }}>
          {subtitle}
        </Typography>
      </Box>
    </Toolbar>
  );
}
