import { alpha, BRAND } from "@/styles/accents";
import SidebarNav from "@/components/layout/SidebarNav";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const nurseTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, AppBar, Toolbar, Divider, IconButton, useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, DashboardRounded, PeopleAltRounded, AssessmentRounded,
  MedicationRounded, VaccinesRounded, HotelRounded, MedicalServicesRounded, EventNoteRounded,
  WarehouseRounded,
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

export default function NurseLayout() {
  useEffect(() => {
    document.title = "Dolphin | Nurse";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isModuleEnabled } = useEnabledModules();

  const { unread: announcementsUnread, onAnnouncement } = useAnnouncementBadge();
  useSocket({ ANNOUNCEMENT_PUBLISHED: onAnnouncement, connect: onAnnouncement });
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/nurse/dashboard", section: "Overview" },
    { text: "Patient Queue", icon: <PeopleAltRounded />, path: "/nurse/queue", section: "Patient Care" },
    { text: "Ward", icon: <MedicationRounded />, path: "/nurse/ward", section: "Patient Care", module: "IPD" },
    { text: "Ward Stock", icon: <WarehouseRounded />, path: "/nurse/ward-stock", section: "Patient Care", module: "Pharmacy" },
    { text: "Immunisations", icon: <VaccinesRounded />, path: "/nurse/immunisations", section: "Patient Care" },
    // Taking a patient to theatre and bringing them back is a nursing job.
    // These screens existed but were reachable only from Reception, so the
    // people who actually do the work had no way to record it.
    { text: "Bed Board", icon: <HotelRounded />, path: "/nurse/ipd/beds", section: "Theatre & Beds", module: "IPD" },
    { text: "Theatre Board", icon: <MedicalServicesRounded />, path: "/nurse/ipd/theatres", section: "Theatre & Beds", module: "IPD" },
    { text: "Operating List", icon: <EventNoteRounded />, path: "/nurse/ipd/ot-schedule", section: "Theatre & Beds", module: "IPD" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/nurse/reports", section: "Reports" },
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
      <SidebarProductHeader />

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
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Nurse"}
        role={user?.roleName || "Nurse"}
        avatarText={user?.firstName?.charAt(0) || "N"}
        onLogout={logout}
        variant="compact"
        roleCode={user?.role}
        // Announcements was the last nav row, and therefore below the fold
        // on a 768px laptop in every panel. Pinned here instead.
        announcements={{ count: announcementsUnread, onOpen: () => navigate("/nurse/announcements") }}
      />
      <SidebarHospitalStrip logoUrl={hospital?.logoUrl} name={hospital?.name || ""} roleCode={user?.role} role={user?.roleName || ""} />
    </Box>
  );

  return (
    <ThemeProvider theme={nurseTheme}>
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
        <Outlet />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
