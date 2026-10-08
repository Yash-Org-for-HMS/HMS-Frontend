import { useState } from "react";
import {
  AppBar, Toolbar, Box, Typography, IconButton, Avatar, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Tooltip, Badge, Chip, ButtonBase,
} from "@mui/material";
import {
  Menu as MenuIcon, SearchRounded, CampaignRounded, LogoutRounded, SwapHorizRounded, ExpandMoreRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import HospitalLogo from "@/components/HospitalLogo";
import BranchSwitcher from "@/components/BranchSwitcher";
import { PANEL_LABEL, panelHomeForUser, panelsForUser, type Panel } from "@/constants/roles";
import { SEARCH_SHORTCUT } from "@/utils/shortcut";
import { SEMANTIC } from "@/styles/accents";
import { TOP_BAR_HEIGHT, FLOAT_GAP, CARD_RADIUS, CARD_SHADOW } from "./floatingShell";

/** Room under the fixed bar, at the top of a panel's content. */
export function TopBarSpacer() {
  return <Box aria-hidden sx={{ height: { xs: TOP_BAR_HEIGHT, md: TOP_BAR_HEIGHT + FLOAT_GAP }, flexShrink: 0 }} />;
}

interface TopBarProps {
  /** The sidebar's width; the bar starts to its right on a desktop. */
  drawerWidth: number;
  /** Opens the sidebar on a phone. */
  onMenu: () => void;
  announcements: { count: number; onOpen: () => void };
}

/**
 * The bar across the top of every hospital panel: which hospital and which
 * branch, then who is signed in and as what. The three facts that matter on a
 * shared desk computer were the smallest things on the screen — the hospital a
 * cut-off caption at the foot of the sidebar, the role not shown at all, the
 * branch picker scrolling out of sight — so they sit here, always in view.
 * Search, announcements, switching panel and signing out moved up with them;
 * the sidebar is navigation only.
 */
export default function TopBar({ drawerWidth, onMenu, announcements }: TopBarProps) {
  const { user, hospital, logout } = useHospitalAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Signed in";
  const role = user?.roleName || "";
  const here = (pathname.split("/").filter(Boolean)[0] ?? "") as Panel;
  // Only for someone with more than one panel (a nurse who is also a desk
  // role); with one, there is nowhere to switch to.
  const panels = panelsForUser(user);
  const otherPanels = panels.length > 1 ? panels.filter((p) => p !== here) : [];
  const search = () => window.dispatchEvent(new Event("open-command-palette"));
  const close = () => setAnchor(null);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="inherit"
      sx={{
        bgcolor: "background.paper",
        color: "text.primary",
        // A phone: flat, edge to edge, where every pixel of width counts.
        // Width, style and colour set apart: a `border` shorthand inside a
        // breakpoint resets the colour to the text colour.
        borderStyle: "solid",
        borderColor: "divider",
        borderWidth: { xs: "0 0 1px 0", md: "1px" },
        // A desktop: a rounded card floating over the page, lined up with the
        // content's own edges (its 24px padding) and as soft as the sidebar.
        top: { md: FLOAT_GAP },
        left: { md: drawerWidth + 24 },
        right: { md: 24 },
        width: { md: "auto" },
        borderRadius: { md: CARD_RADIUS },
        boxShadow: { md: CARD_SHADOW },
      }}
    >
      <Toolbar sx={{ minHeight: `${TOP_BAR_HEIGHT}px !important`, gap: { xs: 1, md: 1.5 }, px: { xs: 1.5, md: 3 } }}>
        <IconButton edge="start" onClick={onMenu} aria-label="Open the menu" sx={{ display: { md: "none" } }}>
          <MenuIcon />
        </IconButton>

        {/* Where: the hospital, then the branch. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flexShrink: 1 }}>
          <HospitalLogo src={hospital?.logoUrl} size={30} title={hospital?.name || "Hospital"} radius={1} />
          <Typography
            noWrap
            title={hospital?.name}
            sx={{ fontWeight: 700, fontSize: "0.9375rem", minWidth: 0, display: { xs: "none", sm: "block" }, maxWidth: { sm: 220, lg: 360 } }}
          >
            {hospital?.name}
          </Typography>
        </Box>
        <BranchSwitcher variant="bar" />

        <Box sx={{ flex: 1 }} />

        {/* Search: the command palette (also Ctrl/⌘ K). */}
        <Box
          role="button"
          tabIndex={0}
          aria-label="Open search (Ctrl+K)"
          onClick={search}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); search(); } }}
          sx={{
            display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1, px: 1.5, py: 0.75, width: 220,
            borderRadius: 2, cursor: "pointer", border: "1px solid", borderColor: "divider",
            bgcolor: "background.default", color: "text.secondary",
            "&:hover": { borderColor: "primary.main", color: "text.primary" }, transition: "all 0.15s ease",
          }}
        >
          <SearchRounded sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ flex: 1 }}>Search…</Typography>
          <Chip label={SEARCH_SHORTCUT} size="small" sx={{ height: 20, fontSize: "0.75rem", fontWeight: 700, bgcolor: "action.hover", color: "text.secondary" }} />
        </Box>
        <IconButton onClick={search} aria-label="Search" sx={{ display: { xs: "inline-flex", md: "none" }, color: "text.secondary" }}>
          <SearchRounded />
        </IconButton>

        <Tooltip title={announcements.count ? `${announcements.count} unread announcement${announcements.count === 1 ? "" : "s"}` : "Announcements"}>
          <IconButton onClick={announcements.onOpen} aria-label="Announcements" sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}>
            <Badge badgeContent={announcements.count} color="error" max={99}>
              <CampaignRounded />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Who: the person, and the role they are working as. */}
        <ButtonBase
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={`${name}, ${role}. Account menu`}
          aria-haspopup="menu"
          sx={{ display: "flex", alignItems: "center", gap: 1, borderRadius: 2, pl: 0.5, pr: { xs: 0.5, md: 1 }, py: 0.5, "&:hover": { bgcolor: "action.hover" } }}
        >
          <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: "0.875rem", fontWeight: 700 }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "left", minWidth: 0, maxWidth: 200 }}>
            <Typography noWrap sx={{ fontWeight: 650, fontSize: "0.8125rem", lineHeight: 1.25 }}>{name}</Typography>
            <Typography noWrap sx={{ color: "text.secondary", fontSize: "0.75rem", lineHeight: 1.25 }}>{role}</Typography>
          </Box>
          <ExpandMoreRounded sx={{ display: { xs: "none", md: "block" }, fontSize: 18, color: "text.secondary" }} />
        </ButtonBase>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 260, mt: 0.5 } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>{name}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>{role}</Typography>
            {user?.email && <Typography sx={{ color: "text.secondary", fontSize: "0.75rem", mt: 0.25 }}>{user.email}</Typography>}
            <Typography sx={{ color: "text.secondary", fontSize: "0.75rem", mt: 0.5 }}>{hospital?.name}</Typography>
          </Box>
          {otherPanels.length > 0 && <Divider />}
          {otherPanels.map((p) => (
            <MenuItem key={p} onClick={() => { close(); navigate(panelHomeForUser(user, p)); }}>
              <ListItemIcon><SwapHorizRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary={`Switch to ${PANEL_LABEL[p]}`} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={() => { close(); logout(); }} sx={{ color: SEMANTIC.danger }}>
            <ListItemIcon><LogoutRounded fontSize="small" sx={{ color: SEMANTIC.danger }} /></ListItemIcon>
            <ListItemText primary="Sign out" />
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
