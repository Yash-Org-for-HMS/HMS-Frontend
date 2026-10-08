import { alpha, BRAND } from "@/styles/accents";
import SidebarNav from "@/components/layout/SidebarNav";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const nurseTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, Divider, useTheme, useMediaQuery,
} from "@mui/material";
import {
  DashboardRounded, PeopleAltRounded, AssessmentRounded, MedicationRounded, VaccinesRounded, HotelRounded, MedicalServicesRounded, EventNoteRounded, WarehouseRounded, AssignmentIndRounded, ApartmentRounded, CalendarMonthRounded, AssignmentRounded, EventAvailableRounded,
} from "@mui/icons-material";
import { hasAction, holdsHome } from "@/constants/roles";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import TopBar, { TopBarSpacer } from "@/components/layout/TopBar";
import TrialBanner from "@/components/layout/TrialBanner";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";
import { useQueryClient } from "@tanstack/react-query";
import { refetchUnlessFresh, isOpdQueueEvent, catchUpEventOnlyScreens } from "@/utils/liveRefresh";

const drawerWidth = 260;

export default function NurseLayout() {
  useEffect(() => {
    document.title = "Dolphin | Nurse";
  }, []);

  const { user } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isModuleEnabled } = useEnabledModules();

  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  // The nurse's worklists (dashboard and queue) are refreshed through this one
  // connection rather than each opening its own. They read the outpatient
  // queue, so a lab or radiology change is not a reason to ask again; a
  // reconnect is, since changes may have been missed while it was down.
  const queryClient = useQueryClient();
  useSocket({
    ANNOUNCEMENT_PUBLISHED: onAnnouncement,
    QUEUE_UPDATED: (payload?: unknown) => {
      // A ward indent moved (raised, issued against, closed): only the indents page asks again.
      if ((payload as { area?: string } | undefined)?.area === "indent") {
        queryClient.invalidateQueries({ queryKey: ["ward-indents", "list"] });
        return;
      }
      // A bed moved: the bed board and the ward screens, if open.
      if ((payload as { area?: string } | undefined)?.area === "beds") {
        queryClient.invalidateQueries({ queryKey: ["ipd-structure"] });
        queryClient.invalidateQueries({ queryKey: ["role-home"] });
        return;
      }
      if (!isOpdQueueEvent(payload)) return;
      queryClient.invalidateQueries({ queryKey: ["nurse-dashboard-queue"] });
      queryClient.invalidateQueries({ queryKey: ["nurse-queue"] });
    },
    connect: () => {
      onConnect();
      catchUpEventOnlyScreens(queryClient);
      refetchUnlessFresh(queryClient, ["nurse-dashboard-queue"]);
      refetchUnlessFresh(queryClient, ["nurse-queue"]);
    },
  });
  const menuItems = [
    // The in-charge's and nursing administration's own homes.
    ...(holdsHome(user, "/nurse/my-wards") ? [{ text: "My wards", icon: <ApartmentRounded />, path: "/nurse/my-wards", section: "Overview" }] : []),
    ...(holdsHome(user, "/nurse/all-wards") ? [{ text: "All wards", icon: <ApartmentRounded />, path: "/nurse/all-wards", section: "Overview" }] : []),
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
    // Every nurse: their own shifts on the roster.
    { text: "My duties", icon: <EventAvailableRounded />, path: "/nurse/my-duties", section: "Ward management", module: "IPD" },
    // The in-charge's (their wards) and nursing administration's (every ward).
    ...(hasAction(user, "nurse.roster")
      ? [{ text: "Duty roster", icon: <CalendarMonthRounded />, path: "/nurse/roster", section: "Ward management", module: "IPD" }]
      : []),
    // ...and asks the pharmacy for their wards' stock.
    ...(hasAction(user, "nurse.indent")
      ? [{ text: "Indents", icon: <AssignmentRounded />, path: "/nurse/indents", section: "Ward management", module: "Pharmacy" }]
      : []),
    // Nursing Administration's: which ward each nurse works on.
    ...(hasAction(user, "nurse.postings")
      ? [{ text: "Ward postings", icon: <AssignmentIndRounded />, path: "/nurse/postings", section: "Nursing administration" }]
      : []),
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
      <SidebarProductHeader compact />

      {/* Navigation */}
      <SidebarNav
        items={menuItems}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setMobileOpen(false); }}
        isLocked={(item) => Boolean(item.module) && !isModuleEnabled(item.module!)}
        sx={{ px: 1.5, pt: 2 }}
      />

      <Divider sx={{ borderColor: alpha(BRAND.action, 0.1) }} />

      {/* User card at bottom */}
    </Box>
  );

  return (
    <ThemeProvider theme={nurseTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Mobile Topbar */}
      <TopBar drawerWidth={drawerWidth} onMenu={handleDrawerToggle} announcements={{ count: announcementsUnread, onOpen: () => navigate("/nurse/announcements") }} />

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
        <TopBarSpacer />
        <TrialBanner />
        <Outlet />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
