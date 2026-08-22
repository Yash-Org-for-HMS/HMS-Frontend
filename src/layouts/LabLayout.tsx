import { useState, useEffect } from "react";
import SidebarNav from "@/components/layout/SidebarNav";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const labTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import {
  Box, Drawer, AppBar, Toolbar, IconButton, useTheme, useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, DashboardRounded, ScienceRounded,
  SettingsAccessibilityRounded, MenuBookRounded, AssessmentRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarSearch from "@/components/layout/SidebarSearch";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";

const drawerWidth = 260;

export default function LabLayout() {
  useEffect(() => {
    document.title = "HMS | Lab & Radiology";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/lab/dashboard", section: "Overview" },
    { text: "Lab Orders", icon: <ScienceRounded />, path: "/lab/orders", section: "Orders" },
    { text: "Radiology Orders", icon: <SettingsAccessibilityRounded />, path: "/lab/radiology", section: "Orders" },
    { text: "Billing", icon: <ReceiptLongRounded />, path: "/lab/billing", section: "Billing", module: "Billing" },
    { text: "Lab Catalog", icon: <MenuBookRounded />, path: "/lab/catalog", section: "Catalogs" },
    { text: "Radiology Catalog", icon: <MenuBookRounded />, path: "/lab/radiology-catalog", section: "Catalogs" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/lab/reports", section: "Reports" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper", color: "text.primary" }}>
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Lab"}
        subtitle="Lab & Radiology"
      />
      
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
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Lab Technician"}
        role={user?.roleName || "Lab Technician"}
        avatarText={user?.firstName?.charAt(0) || "L"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <ThemeProvider theme={labTheme}>
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
        <ModuleGate module="Laboratory"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
