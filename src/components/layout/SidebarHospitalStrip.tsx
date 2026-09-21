import { Box, Typography } from "@mui/material";
import HospitalLogo from "@/components/HospitalLogo";
import { badgeFor } from "./SidebarUserCard";

interface SidebarHospitalStripProps {
  /** Stored logo path. Falls back to the default mark if absent or broken. */
  logoUrl?: string | null;
  name: string;
  /** Role code and name. Shown after the hospital, where there is room. */
  roleCode?: string | null;
  role?: string;
}

/**
 * Which hospital you are looking at, shown at the foot of the sidebar once the
 * product mark has taken the top.
 *
 * Set as a label, not a second name row. A 24px hospital mark beside a 26px
 * avatar read as two of the same thing stacked, and a reader had to work out
 * which line was the person — so this one is smaller, uppercase and muted,
 * which is how a caption looks and an identity does not. Anyone who works
 * across two tenants still needs it visible without opening a menu, so it stays
 * pinned rather than living in the header they scrolled past.
 */
export default function SidebarHospitalStrip({ logoUrl, name, roleCode, role }: SidebarHospitalStripProps) {
  return (
    <Box sx={{ px: 1.5, pt: 1, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, minWidth: 0 }}>
      <HospitalLogo src={logoUrl} size={16} title={name} radius={0.5} />
      <Typography
        noWrap
        sx={{
          minWidth: 0, color: "text.secondary", fontWeight: 700,
          fontSize: "0.625rem", letterSpacing: "0.7px", textTransform: "uppercase",
        }}
      >
        {/* Where you are, then what you are — one caption, because they answer
            the same question and the row above needs its width for the name. */}
        {role ? `${name} · ${badgeFor(roleCode, role)}` : name}
      </Typography>
    </Box>
  );
}
