import { Box, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { assetUrl } from "@/utils/assetUrl";
import HospitalLogo from "@/components/HospitalLogo";

interface SidebarHeaderProps {
  /** Raw hospital logo path (passed through assetUrl). Falls back to an icon tile. */
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  /** Glyph for a sidebar that is not a hospital — the platform console. */
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
      {/* A hospital that has uploaded a logo gets a rounded tile for it; one that
          has not gets the default mark, which is round and carries its own
          shape. The old fallback was a flat indigo square with a generic glyph
          in it — square tiles read as a broken image rather than as a brand. */}
      {logoUrl ? (
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <img src={assetUrl(logoUrl)} alt={`${title} logo`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Box>
      ) : fallbackIcon ? (
        <Box
          sx={{
            width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            boxShadow: "0 4px 14px rgba(79, 70, 229, 0.35)",
          }}
        >
          {fallbackIcon}
        </Box>
      ) : (
        <HospitalLogo size={40} title={title} />
      )}
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
