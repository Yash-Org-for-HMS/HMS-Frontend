import { useState, useEffect } from "react";
import { menuPathsFor, holdsHome, hasAction, hasRole } from "@/constants/roles";
import { isNavItemActive } from "@/components/layout/navActive";

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
import { alpha, BRAND } from "@/styles/accents";
const receptionTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import {
  Box, Drawer, List, Typography, Divider, ListItem, ListItemButton, ListItemIcon, ListItemText, useTheme, useMediaQuery, Badge,
} from "@mui/material";
import {
  DashboardRounded, AccountCircleRounded, CalendarTodayRounded, PersonAddRounded, QueueRounded, ReceiptRounded, MedicalServicesRounded, ApartmentRounded, CallSplitRounded, AssessmentRounded, LocalHotelRounded, HotelRounded, NotificationsRounded, HealthAndSafetyRounded, LockRounded, EventNoteRounded, WorkRounded, FolderSharedRounded, EventAvailableRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { assetUrl } from "@/utils/assetUrl";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import TopBar, { TopBarSpacer } from "@/components/layout/TopBar";
import ScrollFade from "@/components/layout/ScrollFade";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { DASHBOARD_POLL_MS, LIVE_DASHBOARD_FALLBACK_MS } from "@/constants/intervals";
import { refetchUnlessFresh, catchUpEventOnlyScreens } from "@/utils/liveRefresh";

const drawerWidth = 260;

export default function ReceptionLayout() {
  useEffect(() => {
    document.title = "Dolphin | Reception";
  }, []);

  const { user } = useHospitalAuth();
  const { isModuleEnabled } = useEnabledModules();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  // Grouped into sections that follow the front-desk workflow:
  // overview → patient flow → clinical lookups → in-patient → finance → system.
  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  // What is routed to a desk (roles phase 4): a discharge started is the
  // billing desk's final bill, and the TPA desk's when the stay is insured. On
  // "My desk", refreshed when a bed moves ("beds") and on reconnect; while
  // connected the slow poll is only a safety net. A bed move also refreshes
  // whatever bed screen is open here.
  const queryClient = useQueryClient();
  const routedDesk = hasRole(user, "BILLING", "TPA_DESK", "ADMISSION_DESK");
  const { connected } = useSocket({
    ANNOUNCEMENT_PUBLISHED: onAnnouncement,
    QUEUE_UPDATED: (payload?: unknown) => {
      if ((payload as { area?: string } | undefined)?.area !== "beds") return;
      for (const key of [["desk-notices"], ["role-home"], ["ipd-structure"], ["ipd-reservations"], ["ipd-available-beds"]]) queryClient.invalidateQueries({ queryKey: key });
    },
    connect: () => {
      onConnect();
      catchUpEventOnlyScreens(queryClient);
      if (routedDesk) refetchUnlessFresh(queryClient, ["desk-notices"]);
    },
  });
  const { data: notices } = useQuery({
    queryKey: ["desk-notices"],
    queryFn: async () => (await axiosInstance.get("/role-home/notices")).data.data as { dischargesStarted: number; dischargesStartedInsured: number },
    enabled: routedDesk && isModuleEnabled("IPD"),
    refetchInterval: connected ? LIVE_DASHBOARD_FALLBACK_MS : DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const deskBadge = !notices ? 0
    : hasRole(user, "BILLING", "ADMISSION_DESK") ? notices.dischargesStarted
      : notices.dischargesStartedInsured;
  const allSections = [
    {
      heading: "Overview",
      items: [
        // The desk roles' own home (Admission Desk, Billing, TPA, Medical Records).
        ...(holdsHome(user, "/reception/desk") ? [{ text: "My desk", icon: <WorkRounded />, path: "/reception/desk", badge: deskBadge }] : []),
        { text: "Dashboard", icon: <DashboardRounded />, path: "/reception/dashboard" },
        { text: "Front Desk Console", icon: <PersonAddRounded />, path: "/reception/console" },
      ],
    },
    {
      heading: "Patient Flow",
      items: [
        { text: "All Patients", icon: <AccountCircleRounded />, path: "/reception/patients" },
        { text: "Appointments", icon: <CalendarTodayRounded />, path: "/reception/appointments" },
        { text: "Patient Queue", icon: <QueueRounded />, path: "/reception/queue" },
      ],
    },
    {
      heading: "Clinical",
      items: [
        { text: "Doctor Availability", icon: <MedicalServicesRounded />, path: "/reception/doctors" },
        { text: "Department Directory", icon: <ApartmentRounded />, path: "/reception/directory" },
        { text: "Referred Patients", icon: <CallSplitRounded />, path: "/reception/referrals" },
        // Medical Records' registers: medico-legal cases, certificates, files and copies.
        ...(hasAction(user, "mrd.records") ? [{ text: "Medical records", icon: <FolderSharedRounded />, path: "/reception/mrd" }] : []),
      ],
    },
    {
      heading: "In-Patient",
      items: [
        { text: "Admissions", icon: <LocalHotelRounded />, path: "/reception/ipd/admissions", module: "IPD" },
        { text: "Bed Management", icon: <HotelRounded />, path: "/reception/ipd/beds", module: "IPD" },
        // The admission desk's holds for planned admissions.
        ...(hasAction(user, "ipd.reservations") ? [{ text: "Bed reservations", icon: <EventAvailableRounded />, path: "/reception/ipd/reservations", module: "IPD" }] : []),
        { text: "Theatre Board", icon: <MedicalServicesRounded />, path: "/reception/ipd/theatres", module: "IPD" },
        { text: "Operating List", icon: <EventNoteRounded />, path: "/reception/ipd/ot-schedule", module: "IPD" },
      ],
    },
    {
      heading: "Finance & Insights",
      items: [
        { text: "Billing", icon: <ReceiptRounded />, path: "/reception/billing", module: "Billing" },
        { text: "Insurance Claims", icon: <HealthAndSafetyRounded />, path: "/reception/claims" },
        { text: "Reports", icon: <AssessmentRounded />, path: "/reception/reports" },
      ],
    },
    {
      heading: "System",
      items: [
        { text: "Notifications", icon: <NotificationsRounded />, path: "/reception/notifications" },
      ],
    },
  ];

  // The workbook's desk roles (Admission Desk, Billing, TPA, Medical Records) see their desk.
  const onlyPaths = menuPathsFor(user, "reception");
  const navSections = onlyPaths
    ? allSections.map((s) => ({ ...s, items: s.items.filter((i) => onlyPaths.has(i.path)) })).filter((s) => s.items.length)
    : allSections;

  const [mobileOpen, setMobileOpen] = useState(false);

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
      {/* Product mark up top; the hospital identifies itself at the foot. */}
      <SidebarProductHeader compact />

      {/* Navigation — module-gated items (e.g. IPD) aren't hidden; they show with
          a lock so staff can see the feature exists, and the page shows an upsell. */}
      {/* ScrollFade owns the scrolling, so the list can admit with a soft edge
          that there is more below it. */}
      <ScrollFade>
        <List sx={{ px: 1.5, pt: 1 }}>
        {navSections
          .map((section, si) => (
          <Box key={section.heading} sx={{ mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: "#475569", fontWeight: 700, px: 1.5, pt: si === 0 ? 0 : 1.5, pb: 0.75, display: "block", letterSpacing: 1, textTransform: "uppercase", fontSize: "0.75rem" }}
            >
              {section.heading}
            </Typography>
            {section.items.map((item) => {
              const isActive = isNavItemActive(location.pathname, item.path);
              const locked = (item as any).module && !isModuleEnabled((item as any).module);
              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: 2,
                      bgcolor: isActive ? "action.selected" : "transparent",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                      transition: "all 0.15s ease",
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isActive ? "primary.main" : "text.secondary",
                        transition: "color 0.15s ease",
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      {(item as any).badge ? (
                        <Badge badgeContent={(item as any).badge} color="error">
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
                        color: isActive ? "primary.main" : "text.secondary",
                        sx: { opacity: locked ? 0.6 : 1 },
                      }}
                    />
                    {locked && <LockRounded sx={{ fontSize: 15, color: "#f59e0b", ml: 1, flexShrink: 0 }} />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>
      </ScrollFade>

      <Divider sx={{ borderColor: alpha(BRAND.action, 0.1) }} />

      {/* Who you are, then where you are. */}
    </Box>
  );

  return (
    <ThemeProvider theme={receptionTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <TopBar drawerWidth={drawerWidth} onMenu={handleDrawerToggle} announcements={{ count: announcementsUnread, onOpen: () => navigate("/reception/announcements") }} />

      {/* ── Sidebar ─────────────────────────────────────── */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "none",
            },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "none",
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
              boxShadow: "4px 0 24px rgba(0,0,0,0.03)",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* ── Main Content Area ─────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // A flex item defaults to min-width:auto, so it refuses to shrink
          // below its content: one wide table made the whole page scroll
          // sideways instead of the table scrolling inside its own card.
          minWidth: 0,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBarSpacer />
        <Outlet />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
