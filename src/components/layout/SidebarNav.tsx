import type { ReactNode } from "react";
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Badge,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { LockRounded } from "@mui/icons-material";
import { SEMANTIC, NEUTRAL, alpha, BRAND } from "@/styles/accents";
import { isNavItemActive } from "./navActive";

export interface SidebarNavItem {
  text: string;
  icon: ReactNode;
  path: string;
  /** Group heading this entry sits under. */
  section: string;
  /** Count shown on the icon; 0 or absent renders nothing. */
  badge?: number;
  /** Module this entry belongs to — locked when the tenant lacks it. */
  module?: string;
}

/**
 * The panel sidebar's navigation list: section headings, active state, module
 * locks and badges.
 *
 * This block was maintained as five copies (doctor, nurse, lab, pharmacy,
 * hospital-admin) and the cost was not hypothetical — the same one-line edit
 * had to be pasted into all five twice in a single sitting, first to stop a
 * section heading printing twice and then to fix the active-path rule. They had
 * also drifted apart while nobody was looking: the active row's tint was
 * alpha 0.08 in three of them and 0.12 in the other two, and the resting label
 * colour was NEUTRAL.muted in three and "text.secondary" in two. Both are
 * settled here on the majority spelling, so all five panels finally agree.
 *
 * The reception and platform sidebars keep their own rendering — reception
 * draws a selection indicator this one has no concept of, and the platform
 * console reads a different auth context. Both use the shared active-path rule.
 */
export default function SidebarNav({
  items,
  currentPath,
  onNavigate,
  isLocked,
  sx,
}: {
  items: SidebarNavItem[];
  /** Usually `location.pathname`. */
  currentPath: string;
  onNavigate: (path: string) => void;
  /** Whether this entry's module is unavailable to the tenant. */
  isLocked?: (item: SidebarNavItem) => boolean;
  /** Extra styling for the <List> — panels differ only in padding. */
  sx?: SxProps<Theme>;
}) {
  return (
    <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto", ...sx }}>
      {items.map((item, idx, arr) => {
        const isActive = isNavItemActive(currentPath, item.path);
        const locked = isLocked?.(item) ?? false;
        // First row of its section, not merely a change from the previous row —
        // so an entry listed away from its group cannot print the heading twice.
        const startsSection = arr.findIndex((m) => m.section === item.section) === idx;
        return (
          <Box key={item.text}>
            {startsSection && (
              <Typography
                variant="caption"
                sx={{
                  display: "block", color: "text.secondary", fontWeight: 700, letterSpacing: 0.8,
                  textTransform: "uppercase", fontSize: "0.75rem", px: 1.5, pt: idx === 0 ? 0 : 1.75, pb: 0.5,
                }}
              >
                {item.section}
              </Typography>
            )}
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => onNavigate(item.path)}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? alpha(BRAND.action, 0.08) : "transparent",
                  "&:hover": { bgcolor: "action.hover" },
                  transition: "background-color 0.15s ease",
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isActive ? BRAND.action : NEUTRAL.muted, opacity: locked ? 0.55 : 1 }}>
                  {/* Badge only where a panel supplies one; a zero renders nothing. */}
                  {item.badge ? (
                    <Badge badgeContent={locked ? 0 : item.badge} color="error" max={99} overlap="circular">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? BRAND.action : NEUTRAL.muted,
                    sx: { opacity: locked ? 0.6 : 1 },
                  }}
                />
                {locked && <LockRounded sx={{ fontSize: 15, color: SEMANTIC.warning, ml: 1, flexShrink: 0 }} />}
              </ListItemButton>
            </ListItem>
          </Box>
        );
      })}
    </List>
  );
}
