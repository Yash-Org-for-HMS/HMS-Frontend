import { Box, Avatar, Typography, IconButton, Tooltip } from "@mui/material";
import { LogoutRounded, CampaignRounded } from "@mui/icons-material";
import Badge from "@mui/material/Badge";
import { SEMANTIC } from "@/styles/accents";

interface SidebarUserCardProps {
  name: string;
  role: string;
  onLogout: () => void;
  /** Letter shown in the avatar (defaults to the first char of name). */
  avatarText?: string;
  /** When provided, the user area is clickable (e.g. open profile settings). */
  onProfile?: () => void;
  /**
   * "compact" puts the name and a role badge on one line and drops the card
   * chrome and the copyright, reclaiming roughly a third of the footer. The
   * product mark lives in the sidebar header in this arrangement, not here.
   * Default keeps the original two-line card, so a panel opts in rather than
   * being changed underneath it.
   */
  variant?: "default" | "compact";
  /** Role code, used for the compact badge. Falls back to the role name. */
  roleCode?: string | null;
  /**
   * Announcements, as a bell rather than a menu row.
   *
   * It used to be the last entry in the nav list, which on a 768px laptop was
   * below the fold in EVERY panel — so the unread badge existed to draw
   * attention to something nobody could see without scrolling past everything
   * else. There is no desktop topbar to move it to (every AppBar is
   * md:none), so it lives here, in the one band that is always pinned.
   */
  announcements?: { count: number; onOpen: () => void };
  /**
   * Set when nothing follows this row. The compact paddings are tuned for a
   * hospital caption sitting underneath and carrying the bottom space; the
   * platform console has no caption, so without this the row ends 6px from
   * the edge of the drawer.
   */
  standalone?: boolean;
}

/**
 * Short badge text per role.
 *
 * The full role names do not fit beside a name in a 260px sidebar - measured
 * against real users, "Dr. Sunita Kulkarni · Doctor" is 28 characters against a
 * slot that holds about 25, and it is the ROLE that gets cut, which is the half
 * worth keeping. A fixed-width badge never truncates; only the name ellipses.
 */
const ROLE_BADGE: Record<string, string> = {
  H_ADMIN: "ADMIN",
  HOSPITAL_ADMIN: "ADMIN",
  B_ADMIN: "BRANCH",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
  RECEPTIONIST: "RECEPTION",
  RECEPTION: "RECEPTION",
  PHARMACIST: "PHARMACY",
  PHARMACY: "PHARMACY",
  LAB_TECH: "LAB",
  LAB_ADMIN: "LAB",
  LAB: "LAB",
  // The platform console has no hospital role. "PLATFORM" rather than
  // "SUPER ADMIN": eleven characters left only ~70px for the name, which cut
  // "Rajesh Sharma" in half, and it also separates this person from a
  // hospital ADMIN instead of reading as a longer version of the same thing.
  SUPER_ADMIN: "PLATFORM",
};

export function badgeFor(roleCode: string | null | undefined, roleName: string): string {
  const mapped = roleCode ? ROLE_BADGE[roleCode.toUpperCase()] : undefined;
  if (mapped) return mapped;
  // An unmapped or custom role still needs something short and honest.
  return (roleName || "USER").split(" ")[0]!.slice(0, 9).toUpperCase();
}

/**
 * The shared bottom-of-sidebar profile block — avatar, who you are, and a way
 * out — used by every panel layout. Theme-tokened so all panels match.
 *
 * It is pinned below a scrolling nav, so every pixel here is one permanently
 * removed from the menu.
 */
export default function SidebarUserCard({
  name, role, onLogout, avatarText, onProfile, variant = "default", roleCode, standalone = false,
  announcements,
}: SidebarUserCardProps) {
  const initial = (avatarText || name?.trim()?.charAt(0) || "U").toUpperCase();

  if (variant === "compact") {
    return (
      <Box sx={{ px: 1.5, pt: standalone ? 2 : 1.25, pb: standalone ? 2 : 0.75 }}>
        {/* Centred as one group: the row is short enough that pinning sign-out
            to the far right would leave a gap in the middle of it. */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <Box
            onClick={onProfile}
            sx={{
              display: "flex", alignItems: "center", gap: 1, minWidth: 0,
              cursor: onProfile ? "pointer" : "default",
            }}
          >
            <Avatar sx={{ width: 26, height: 26, bgcolor: "primary.main", fontSize: "0.6875rem", fontWeight: 700 }}>
              {initial}
            </Avatar>
            <Typography
              variant="caption" noWrap
              sx={{ color: "text.primary", fontWeight: 650, minWidth: 0, fontSize: "0.75rem" }}
            >
              {name}
            </Typography>
            {/* Only where nothing follows this row — which is the platform
                console, the one panel with no hospital line beneath and no
                bell beside. Everywhere else the role sits on the hospital
                line: with a bell added, four controls plus a badge left 52px
                for a name needing 74px, and "Lisa Manobal" rendered as
                "Lisa M…". Tightening the gaps would have fitted that one name
                and broken on the next longer one. */}
            {standalone && (
            <Tooltip title={role}>
              <Box
                component="span"
                sx={{
                  flexShrink: 0, fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.6px",
                  px: 0.75, py: "2px", borderRadius: "5px",
                  bgcolor: "action.hover", color: "text.secondary", whiteSpace: "nowrap",
                }}
              >
                {badgeFor(roleCode, role)}
              </Box>
            </Tooltip>
            )}
          </Box>
          {announcements && (
            <Tooltip title={announcements.count ? `${announcements.count} unread announcement${announcements.count === 1 ? "" : "s"}` : "Announcements"}>
              <IconButton
                size="small" onClick={announcements.onOpen}
                sx={{ p: 0.5, color: "text.secondary", flexShrink: 0, "&:hover": { color: "primary.main" } }}
              >
                <Badge badgeContent={announcements.count} color="error" max={99}>
                  <CampaignRounded sx={{ fontSize: 18 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Sign out">
            <IconButton
              size="small" onClick={onLogout}
              sx={{ p: 0.5, color: "text.secondary", flexShrink: 0, "&:hover": { color: SEMANTIC.danger } }}
            >
              <LogoutRounded sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          bgcolor: "background.default",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          onClick={onProfile}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            cursor: onProfile ? "pointer" : "default",
          }}
        >
          <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: "0.875rem", fontWeight: 700 }}>
            {initial}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ color: "text.primary", fontWeight: 600, display: "block" }}>
              {name}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: "text.secondary", fontSize: "0.6875rem", display: "block" }}>
              {role}
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            size="small"
            onClick={onLogout}
            sx={{ color: "text.secondary", flexShrink: 0, "&:hover": { color: SEMANTIC.danger } }}
          >
            <LogoutRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="caption" sx={{ color: "#334155", display: "block", textAlign: "center", mt: 1 }}>
        © {new Date().getFullYear()} Dolphin
      </Typography>
    </Box>
  );
}
