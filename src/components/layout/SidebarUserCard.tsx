import { Box, Avatar, Typography, IconButton, Tooltip } from "@mui/material";
import { LogoutRounded } from "@mui/icons-material";

interface SidebarUserCardProps {
  name: string;
  role: string;
  onLogout: () => void;
  /** Letter shown in the avatar (defaults to the first char of name). */
  avatarText?: string;
  /** When provided, the user area is clickable (e.g. open profile settings). */
  onProfile?: () => void;
}

/**
 * The shared bottom-of-sidebar profile card — avatar + name + role + a sign-out
 * button — used by every panel layout. Theme-tokened so all panels match.
 */
export default function SidebarUserCard({ name, role, onLogout, avatarText, onProfile }: SidebarUserCardProps) {
  const initial = (avatarText || name?.trim()?.charAt(0) || "U").toUpperCase();
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
          <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: "0.85rem", fontWeight: 700 }}>
            {initial}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ color: "text.primary", fontWeight: 600, display: "block" }}>
              {name}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: "text.secondary", fontSize: "0.7rem", display: "block" }}>
              {role}
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            size="small"
            onClick={onLogout}
            sx={{ color: "text.secondary", flexShrink: 0, "&:hover": { color: "#ef4444" } }}
          >
            <LogoutRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="caption" sx={{ color: "#334155", display: "block", textAlign: "center", mt: 1 }}>
        © {new Date().getFullYear()} HMS SaaS
      </Typography>
    </Box>
  );
}
