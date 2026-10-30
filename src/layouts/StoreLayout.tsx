import { useState } from "react";
import { useRoleTitle } from "@/hooks/useRoleTitle";
import SidebarNav from "@/components/layout/SidebarNav";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const storeTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Box, Drawer, useTheme, useMediaQuery } from "@mui/material";
import { Inventory2Rounded } from "@mui/icons-material";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import TopBar, { TopBarSpacer } from "@/components/layout/TopBar";
import { floatingSidebarPaper } from "@/components/layout/floatingShell";
import TrialBanner from "@/components/layout/TrialBanner";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";

const drawerWidth = 260;

/**
 * The Store Keeper's panel: one screen, the store room (spare beds, equipment,
 * linen). The API keeps the role to exactly that (backend lib/roleCatalog.ts).
 */
export default function StoreLayout() {
  useRoleTitle("Store room");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  useSocket({ ANNOUNCEMENT_PUBLISHED: onAnnouncement, connect: onConnect });
  const menuItems = [
    { text: "Store room", icon: <Inventory2Rounded />, path: "/store", section: "Store" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper", color: "text.primary" }}>
      <SidebarProductHeader compact />
      <SidebarNav
        items={menuItems}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setMobileOpen(false); }}
      />
    </Box>
  );

  return (
    <ThemeProvider theme={storeTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar drawerWidth={drawerWidth} onMenu={handleDrawerToggle} announcements={{ count: announcementsUnread, onOpen: () => navigate("/store/announcements") }} />

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" } }}>
          {drawerContent}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": floatingSidebarPaper(drawerWidth) }} open>
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 3, width: { md: `calc(100% - ${drawerWidth}px)` }, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBarSpacer />
        <TrialBanner />
        <Outlet />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
