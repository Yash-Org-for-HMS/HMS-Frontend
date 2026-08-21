import { Box, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";
import HospitalLogo from "@/components/HospitalLogo";

interface SidebarHeaderProps {
  /** Stored logo path. Falls back to the default mark if absent or broken. */
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
      {/* HospitalLogo decides: the uploaded logo if it loads, the default mark if
          there is none OR the file has gone (the host's filesystem is ephemeral,
          so logoUrl can outlive the file it points at). */}
      {!fallbackIcon ? (
        <HospitalLogo src={logoUrl} size={40} title={title} />
      ) : (
        <Box
          sx={{
            width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            boxShadow: "0 4px 14px rgba(79, 70, 229, 0.35)",
          }}
        >
          {fallbackIcon}
        </Box>
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
