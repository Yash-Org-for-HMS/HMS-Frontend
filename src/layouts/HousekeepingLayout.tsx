import { useState, useEffect } from "react";
import SidebarNav from "@/components/layout/SidebarNav";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const housekeepingTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import {
  Box, Drawer, useTheme, useMediaQuery,
} from "@mui/material";
import { HotelRounded } from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import TopBar, { TopBarSpacer } from "@/components/layout/TopBar";
import TrialBanner from "@/components/layout/TrialBanner";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { DASHBOARD_POLL_MS, LIVE_DASHBOARD_FALLBACK_MS } from "@/constants/intervals";
import { refetchUnlessFresh, catchUpEventOnlyScreens } from "@/utils/liveRefresh";

const drawerWidth = 260;

/**
 * Housekeeping (HMS_Platform_Master_Data.xlsx 15_System_Roles: "Update CLEANING /
 * AVAILABLE bed status"): one screen, the bed board, where the beds waiting to
 * be turned round can be marked as being cleaned or cleaned. The API keeps the
 * role to exactly that (lib/roleCatalog.ts, beds.controller setBedStatus).
 */
export default function HousekeepingLayout() {
  useEffect(() => {
    document.title = "Dolphin | Housekeeping";
  }, []);

  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  // Beds vacated are routed here (roles phase 4): the count waiting to be
  // turned round, on the Bed Board entry, asked again when a bed moves.
  const queryClient = useQueryClient();
  const { connected } = useSocket({
    ANNOUNCEMENT_PUBLISHED: onAnnouncement,
    QUEUE_UPDATED: (payload?: unknown) => {
      if ((payload as { area?: string } | undefined)?.area !== "beds") return;
      queryClient.invalidateQueries({ queryKey: ["beds-to-clean"] });
      queryClient.invalidateQueries({ queryKey: ["ipd-structure"] });
    },
    connect: () => {
      onConnect();
      catchUpEventOnlyScreens(queryClient);
      refetchUnlessFresh(queryClient, ["beds-to-clean"]);
    },
  });
  const { data: toClean } = useQuery({
    queryKey: ["beds-to-clean"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/to-clean")).data.data as { count: number },
    enabled: isModuleEnabled("IPD"),
    refetchInterval: connected ? LIVE_DASHBOARD_FALLBACK_MS : DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const menuItems = [
    { text: "Bed Board", icon: <HotelRounded />, path: "/housekeeping/beds", section: "Beds", badge: toClean?.count || 0 },
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
        isLocked={(item) => Boolean(item.module) && !isModuleEnabled(item.module!)}
      />

    </Box>
  );

  return (
    <ThemeProvider theme={housekeepingTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar drawerWidth={drawerWidth} onMenu={handleDrawerToggle} announcements={{ count: announcementsUnread, onOpen: () => navigate("/housekeeping/announcements") }} />

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" } }}>
          {drawerContent}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none", borderTopRightRadius: 24, borderBottomRightRadius: 24, boxShadow: "4px 0 24px rgba(0,0,0,0.03)" } }} open>
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1,
          // A flex item defaults to min-width:auto, so it refuses to shrink
          // below its content: one wide table made the whole page scroll
          // sideways instead of the table scrolling inside its own card.
          minWidth: 0, p: 3, width: { md: `calc(100% - ${drawerWidth}px)` }, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBarSpacer />
        <TrialBanner />
        <ModuleGate module="IPD"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
