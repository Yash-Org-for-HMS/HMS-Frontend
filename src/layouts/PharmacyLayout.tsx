import { useState, useEffect } from "react";
import SidebarNav from "@/components/layout/SidebarNav";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const pharmacyTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import {
  Box, Drawer, AppBar, Toolbar, IconButton, useTheme, useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, DashboardRounded, MedicationRounded,
  LocalShippingRounded, InventoryRounded, PointOfSaleRounded,
  AssessmentRounded, LocalPharmacyRounded, WarehouseRounded, ReceiptLongRounded,
} from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import SidebarHospitalStrip from "@/components/layout/SidebarHospitalStrip";
import SidebarSearch from "@/components/layout/SidebarSearch";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";

const drawerWidth = 260;

export default function PharmacyLayout() {
  useEffect(() => {
    document.title = "Dolphin | Pharmacy Portal";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const { unread: announcementsUnread, onAnnouncement } = useAnnouncementBadge();
  useSocket({ ANNOUNCEMENT_PUBLISHED: onAnnouncement, connect: onAnnouncement });
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/pharmacy/dashboard", section: "Overview" },
    { text: "Dispensary (POS)", icon: <PointOfSaleRounded />, path: "/pharmacy/pos", section: "Dispensary" },
    { text: "IPD Medication Requests", icon: <LocalPharmacyRounded />, path: "/pharmacy/ipd-requests", section: "Dispensary", module: "IPD" },
    { text: "Medicine Catalog", icon: <MedicationRounded />, path: "/pharmacy/medicines", section: "Inventory" },
    { text: "Suppliers", icon: <LocalShippingRounded />, path: "/pharmacy/suppliers", section: "Inventory" },
    { text: "Inventory & POs", icon: <InventoryRounded />, path: "/pharmacy/inventory", section: "Inventory" },
    { text: "Ward Stock", icon: <WarehouseRounded />, path: "/pharmacy/ward-stock", section: "Inventory", module: "IPD" },
    { text: "Billing History", icon: <ReceiptLongRounded />, path: "/pharmacy/billing", section: "Reports", module: "Billing" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/pharmacy/reports", section: "Reports" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper", color: "text.primary" }}>
      <SidebarProductHeader />
      
      <SidebarSearch />
      <SidebarNav
        items={menuItems}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setMobileOpen(false); }}
        isLocked={(item) => Boolean(item.module) && !isModuleEnabled(item.module!)}
      />

      <Box sx={{ px: 2, pb: 1 }}>
        <BranchSwitcher />
      </Box>

      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Pharmacist"}
        role={user?.roleName || "Pharmacist"}
        avatarText={user?.firstName?.charAt(0) || "P"}
        onLogout={logout}
        variant="compact"
        roleCode={user?.role}
        // Announcements was the last nav row, and therefore below the fold
        // on a 768px laptop in every panel. Pinned here instead.
        announcements={{ count: announcementsUnread, onOpen: () => navigate("/pharmacy/announcements") }}
      />
      <SidebarHospitalStrip logoUrl={hospital?.logoUrl} name={hospital?.name || ""} roleCode={user?.role} role={user?.roleName || ""} />
    </Box>
  );

  return (
    <ThemeProvider theme={pharmacyTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" elevation={0} sx={{ display: { xs: "block", md: "none" }, width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: "none" }, color: "text.primary" }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

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
        <Toolbar sx={{ display: { xs: "block", md: "none" } }} />
        <TrialBanner />
        <ModuleGate module="Pharmacy"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
