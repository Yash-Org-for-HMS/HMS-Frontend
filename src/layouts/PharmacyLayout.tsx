import { useState, useEffect } from "react";
import SidebarNav from "@/components/layout/SidebarNav";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const pharmacyTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import {
  Box, Drawer, useTheme, useMediaQuery,
} from "@mui/material";
import {
  DashboardRounded, MedicationRounded, LocalShippingRounded, InventoryRounded, PointOfSaleRounded, AssessmentRounded, LocalPharmacyRounded, WarehouseRounded, ReceiptLongRounded,
} from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import TopBar, { TopBarSpacer } from "@/components/layout/TopBar";
import { floatingSidebarPaper } from "@/components/layout/floatingShell";
import TrialBanner from "@/components/layout/TrialBanner";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { DASHBOARD_POLL_MS, LIVE_DASHBOARD_FALLBACK_MS } from "@/constants/intervals";
import { refetchUnlessFresh, catchUpEventOnlyScreens } from "@/utils/liveRefresh";

const drawerWidth = 260;

export default function PharmacyLayout() {
  useEffect(() => {
    document.title = "Dolphin | Pharmacy Portal";
  }, []);

  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  // Wards waiting on an indent: on the Ward Stock entry. Asked again when an
  // indent changes (its own event area, so a sale at the counter never asks)
  // and on reconnect; while connected the slow poll is only a safety net.
  const queryClient = useQueryClient();
  const { connected } = useSocket({
    ANNOUNCEMENT_PUBLISHED: onAnnouncement,
    QUEUE_UPDATED: (payload?: unknown) => {
      if ((payload as { area?: string } | undefined)?.area !== "indent") return;
      queryClient.invalidateQueries({ queryKey: ["ward-indents-open-count"] });
      queryClient.invalidateQueries({ queryKey: ["ward-indents", "open"] });
    },
    connect: () => {
      onConnect();
      catchUpEventOnlyScreens(queryClient);
      refetchUnlessFresh(queryClient, ["ward-indents-open-count"]);
    },
  });
  const { data: indents } = useQuery({
    queryKey: ["ward-indents-open-count"],
    queryFn: async () => (await axiosInstance.get("/ward-indents/open/count")).data.data as { open: number },
    enabled: isModuleEnabled("IPD") && isModuleEnabled("Pharmacy"),
    refetchInterval: connected ? LIVE_DASHBOARD_FALLBACK_MS : DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/pharmacy/dashboard", section: "Overview" },
    { text: "Dispensary (POS)", icon: <PointOfSaleRounded />, path: "/pharmacy/pos", section: "Dispensary" },
    { text: "IPD Medication Requests", icon: <LocalPharmacyRounded />, path: "/pharmacy/ipd-requests", section: "Dispensary", module: "IPD" },
    { text: "Medicine Catalog", icon: <MedicationRounded />, path: "/pharmacy/medicines", section: "Inventory" },
    { text: "Suppliers", icon: <LocalShippingRounded />, path: "/pharmacy/suppliers", section: "Inventory" },
    { text: "Inventory & POs", icon: <InventoryRounded />, path: "/pharmacy/inventory", section: "Inventory" },
    { text: "Ward Stock", icon: <WarehouseRounded />, path: "/pharmacy/ward-stock", section: "Inventory", module: "IPD", badge: indents?.open || 0 },
    { text: "Billing History", icon: <ReceiptLongRounded />, path: "/pharmacy/billing", section: "Reports", module: "Billing" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/pharmacy/reports", section: "Reports" },
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
    <ThemeProvider theme={pharmacyTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar drawerWidth={drawerWidth} onMenu={handleDrawerToggle} announcements={{ count: announcementsUnread, onOpen: () => navigate("/pharmacy/announcements") }} />

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" } }}>
          {drawerContent}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": floatingSidebarPaper(drawerWidth) }} open>
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
        <ModuleGate module="Pharmacy"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
