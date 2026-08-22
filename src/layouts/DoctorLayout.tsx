import { alpha, BRAND } from "@/styles/accents";
import SidebarNav from "@/components/layout/SidebarNav";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const doctorTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Drawer, AppBar, Toolbar, Divider, IconButton, useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, DashboardRounded, PeopleAltRounded, GroupsRounded,
  QueueRounded, EventBusyRounded, ScienceRounded, AssessmentRounded,
} from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarSearch from "@/components/layout/SidebarSearch";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";
import { axiosInstance } from "@/api/axios";
import { useSocket } from "@/hooks/useSocket";
import { DASHBOARD_POLL_MS } from "@/constants/intervals";

const drawerWidth = 260;

export default function DoctorLayout() {
  useEffect(() => {
    document.title = "HMS | Doctor";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar notification counts (unread results, patients waiting). Polls as a
  // fallback and refreshes instantly on queue/order socket events.
  const { data: badges } = useQuery({
    queryKey: ["doctor-badges"],
    queryFn: async () => (await axiosInstance.get("/doctor/badges")).data.data as { resultsReady: number; queueWaiting: number },
    refetchInterval: DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  useSocket({ QUEUE_UPDATED: () => queryClient.invalidateQueries({ queryKey: ["doctor-badges"] }) });

  const { isModuleEnabled } = useEnabledModules();
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/doctor/dashboard", badge: 0, section: "Overview" },
    { text: "My Queue", icon: <QueueRounded />, path: "/doctor/queue", badge: badges?.queueWaiting || 0, section: "My Work" },
    { text: "My Patients", icon: <PeopleAltRounded />, path: "/doctor/patients", badge: 0, section: "My Work" },
    { text: "All Patients", icon: <GroupsRounded />, path: "/doctor/all-patients", badge: 0, section: "My Work" },
    { text: "Results", icon: <ScienceRounded />, path: "/doctor/results", badge: badges?.resultsReady || 0, section: "My Work", module: "Laboratory" },
    // Kept beside the other My Work entries. The heading below is emitted when
    // the section changes from the previous row, so an item listed away from
    // its own group prints that group's heading a second time.
    { text: "My Leave", icon: <EventBusyRounded />, path: "/doctor/leaves", badge: 0, section: "My Work" },
    { text: "My Reports", icon: <AssessmentRounded />, path: "/doctor/reports", badge: 0, section: "Insights" },
  ];

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      {/* Logo / Header */}
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Doctor"}
        subtitle="Doctor Workspace"
      />

      {/* Navigation */}
      <SidebarSearch />
      <SidebarNav
        items={menuItems}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setMobileOpen(false); }}
        isLocked={(item) => Boolean(item.module) && !isModuleEnabled(item.module!)}
        sx={{ px: 1.5, pt: 2 }}
      />

      <Divider sx={{ borderColor: alpha(BRAND.action, 0.1) }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`Dr. ${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
        role={user?.roleName || "Doctor"}
        avatarText={user?.firstName?.charAt(0) || "D"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <ThemeProvider theme={doctorTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Mobile Topbar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.paper",
          borderBottom: `1px solid ${alpha(BRAND.action, 0.12)}`,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: "70px !important" }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box", width: drawerWidth, borderRight: "none",
              borderTopRightRadius: 24, borderBottomRightRadius: 24,
              boxShadow: "4px 0 24px rgba(0,0,0,0.03)"
            }
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // A flex item defaults to min-width:auto, so it refuses to shrink
          // below its content: one wide table made the whole page scroll
          // sideways instead of the table scrolling inside its own card.
          minWidth: 0, p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh", display: "flex", flexDirection: "column",
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" }, minHeight: "70px !important" }} />
        <TrialBanner />
        <ModuleGate module="Doctor"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
