import { useState, useEffect } from "react";
import PanelSwitcher from "@/components/layout/PanelSwitcher";
import SidebarNav from "@/components/layout/SidebarNav";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const hospitalTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import {
  Box, Drawer, AppBar, Toolbar, Divider, IconButton, useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon, DashboardRounded, LocalHospitalRounded, PeopleRounded,
  CalendarTodayRounded, SettingsRounded, ApartmentRounded, DomainRounded, BadgeRounded, CardMembershipRounded, AccountTreeRounded, SchemaRounded,
  WidgetsRounded, MedicalServicesRounded, DatasetRounded, EventNoteRounded,
  DynamicFormRounded, SecurityRounded, AccountBalanceRounded,
  AssessmentRounded, HotelRounded, MonitorHeartRounded, VaccinesRounded,
  MedicationRounded, LocalHotelRounded, ReceiptLongRounded,
  FormatListNumberedRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { isAdminUser, menuPathsFor } from "@/constants/roles";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarProductHeader from "@/components/layout/SidebarProductHeader";
import SidebarHospitalStrip from "@/components/layout/SidebarHospitalStrip";
import SidebarSearch from "@/components/layout/SidebarSearch";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";
import { axiosInstance } from "@/api/axios";
import { useAnnouncementBadge } from "@/features/announcements/useAnnouncementBadge";
import { useSocket } from "@/hooks/useSocket";

const drawerWidth = 260;

export default function HospitalLayout() {
  useEffect(() => {
    document.title = "Dolphin | Hospital Admin";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar items; `adminOnly` tabs are hidden from non-admin roles.
  const { unread: announcementsUnread, onAnnouncement, onConnect } = useAnnouncementBadge();
  useSocket({ ANNOUNCEMENT_PUBLISHED: onAnnouncement, connect: onConnect });
  // In the order a hospital is set up — each step needs the ones above it:
  // profile, settings and modules first; departments before the wards, doctors
  // and staff that belong to them; charges before beds (a bed's room class
  // picks up its rent from the Schedule of Charges); wards and beds before
  // theatres; doctors and staff once there are departments and wards to put
  // them in (postings, reporting lines); logins last. Then the catalogs a
  // hospital fills as it goes, the day-to-day windows, and the reports.
  // Items keep their own adminOnly / module gates.
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/hospital/dashboard", section: "Overview" },

    // ── Set up, in this order ──
    { text: "Hospital Profile", icon: <LocalHospitalRounded />, path: "/hospital/profile", adminOnly: true, section: "Set up — in this order" },
    { text: "System Settings", icon: <SettingsRounded />, path: "/hospital/settings", adminOnly: true, section: "Set up — in this order" },
    { text: "Branches", icon: <ApartmentRounded />, path: "/hospital/branches", adminOnly: true, section: "Set up — in this order" },
    { text: "Module Access", icon: <WidgetsRounded />, path: "/hospital/module-access", adminOnly: true, section: "Set up — in this order" },
    { text: "Departments", icon: <DomainRounded />, path: "/hospital/departments", adminOnly: true, section: "Set up — in this order" },
    { text: "Schedule of Charges", icon: <ReceiptLongRounded />, path: "/hospital/soc", adminOnly: true, section: "Set up — in this order" },
    // Backend restricts these strictly to H_ADMIN/B_ADMIN (requireRole, no
    // permission-code bypass) — adminOnly here matches that exactly so a
    // custom role never sees a link that would just 403.
    { text: "Ward & Bed Setup", icon: <HotelRounded />, path: "/hospital/facility-setup", adminOnly: true, module: "IPD", section: "Set up — in this order" },
    { text: "Operating Theatres", icon: <MedicalServicesRounded />, path: "/hospital/theatres", adminOnly: true, module: "IPD", section: "Set up — in this order" },
    { text: "Doctors", icon: <MedicalServicesRounded />, path: "/hospital/doctors", adminOnly: true, section: "Set up — in this order" },
    // People (with or without a login) and who they report to — the one place a
    // person is added. Logins & roles below manages the logins themselves.
    { text: "Staff Directory", icon: <AccountTreeRounded />, path: "/hospital/staff", adminOnly: true, section: "Set up — in this order" },
    // Who reports to whom, and the departments under those who oversee them.
    { text: "Organisation chart", icon: <SchemaRounded />, path: "/hospital/organogram", adminOnly: true, section: "Set up — in this order" },
    { text: "Logins & roles", icon: <BadgeRounded />, path: "/hospital/users", adminOnly: true, section: "Set up — in this order" },

    // ── Catalogs and forms, as the hospital needs them ──
    { text: "Medicine Catalog", icon: <MedicationRounded />, path: "/hospital/medicines", adminOnly: true, module: "Pharmacy", section: "Catalogs & forms" },
    { text: "Vaccine Catalog", icon: <VaccinesRounded />, path: "/hospital/vaccines", adminOnly: true, section: "Catalogs & forms" },
    { text: "Ward Chart Settings", icon: <MonitorHeartRounded />, path: "/hospital/ward-chart", adminOnly: true, module: "IPD", section: "Catalogs & forms" },
    { text: "Form Builder", icon: <DynamicFormRounded />, path: "/hospital/form-builder", adminOnly: true, section: "Catalogs & forms" },
    // Role Management and the Permission Matrix used to live here, commented
    // out. Both are gone now: every hospital uses the fixed standard role set,
    // and role authoring is removed rather than hidden — see the note in
    // rbac.controller.ts for why.
    { text: "Master Data", icon: <DatasetRounded />, path: "/hospital/lookups", adminOnly: true, section: "Catalogs & forms" },

    // ── Day to day ──
    // Operations: hospital-wide, read-oriented windows into day-to-day activity.
    // Admin-only (mirrors the backend org-wide data view for H_ADMIN); these
    // reuse the existing reception/IPD pages, mounted under the admin shell.
    { text: "All Patients", icon: <PeopleRounded />, path: "/hospital/patients", adminOnly: true, section: "Daily operations" },
    { text: "Appointments", icon: <CalendarTodayRounded />, path: "/hospital/appointments", adminOnly: true, section: "Daily operations" },
    { text: "Patient Queue", icon: <FormatListNumberedRounded />, path: "/hospital/queue", adminOnly: true, section: "Daily operations" },
    { text: "Admissions", icon: <LocalHotelRounded />, path: "/hospital/ipd/admissions", adminOnly: true, module: "IPD", section: "Daily operations" },
    { text: "Bed Board", icon: <HotelRounded />, path: "/hospital/ipd/beds", adminOnly: true, module: "IPD", section: "Daily operations" },
    { text: "Operating List", icon: <EventNoteRounded />, path: "/hospital/ipd/ot-schedule", adminOnly: true, module: "IPD", section: "Daily operations" },
    { text: "Billing Overview", icon: <ReceiptLongRounded />, path: "/hospital/billing", adminOnly: true, module: "Billing", section: "Daily operations" },
    // Admin-only by design: raising a refund and approving it have to be
    // different people, so this never appears for the desk that raises them.
    { text: "Refund Approvals", icon: <AccountBalanceRounded />, path: "/hospital/refund-approvals", adminOnly: true, module: "Billing", section: "Daily operations" },

    // ── Reports ──
    { text: "Reports", icon: <AssessmentRounded />, path: "/hospital/reports", section: "Reports & finance" },
    // Admin-only: its endpoint (/billing/analytics) is admin-gated, so don't show
    // a tab non-admins can't actually open.
    { text: "Financial Analytics", icon: <AccountBalanceRounded />, path: "/hospital/financials", adminOnly: true, module: "Billing", section: "Reports & finance" },
    { text: "GST Report", icon: <AssessmentRounded />, path: "/hospital/gst-report", adminOnly: true, module: "Billing", section: "Reports & finance" },

    { text: "Audit Logs", icon: <SecurityRounded />, path: "/hospital/audit-logs", adminOnly: true, section: "System" },
  ];

  // Org AND branch admins see everything (mirrors the backend ADMIN_ROLE_CODES
  // bypass). B_ADMIN was previously omitted, which hid every permission-gated
  // tab for branch admins — leaving only the two ungated items (the "2 tabs" bug).
  const isAdmin = isAdminUser(user);
  // An Auditor or HR Admin (15_System_Roles) sees only their part of this panel.
  const onlyPaths = menuPathsFor(user, "hospital");
  const { isModuleEnabled } = useEnabledModules();
  // Module-gated items are NOT hidden — they render with a lock badge so tenants
  // can discover the feature and upgrade (the page itself shows the upsell).
  // adminOnly / permission still gate visibility as before.
  const visibleMenuItems = menuItems.filter(item => {
    if (onlyPaths) return onlyPaths.has(item.path);
    if ((item as any).adminOnly) return isAdmin;   // admin-only tab (e.g. Financial, Operations)
    return true;
  });
  const isLocked = (item: any) => item.module && !isModuleEnabled(item.module);

  // First-run gate: the hospital admin must fill a few required profile details
  // before using the rest of the panel. Completeness is derived from the fields
  // (no flag needed); the gate releases as soon as they're filled + saved.
  const { data: hospitalProfile } = useQuery({
    queryKey: ["hospital-profile"],
    queryFn: async () => (await axiosInstance.get("/hospital/profile")).data.data,
  });
  const profileComplete = !!(
    hospitalProfile &&
    hospitalProfile.officialPhone &&
    hospitalProfile.addressLine1 &&
    hospitalProfile.registrationNumber
  );
  const mustCompleteProfile =
    isAdmin && !!hospitalProfile && !profileComplete && location.pathname !== "/hospital/profile";

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

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
      <SidebarProductHeader />
      
      <SidebarSearch />
      <SidebarNav
        items={visibleMenuItems}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setMobileOpen(false); }}
        isLocked={isLocked}
      />
      
      <Divider sx={{ borderColor: "divider" }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <PanelSwitcher />
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Administrator"}
        role={user?.roleName || "Administrator"}
        avatarText={user?.firstName?.charAt(0) || "A"}
        onLogout={logout}
        onProfile={() => navigate("/hospital/profile")}
        variant="compact"
        roleCode={user?.role}
        // Announcements was the last nav row, and therefore below the fold
        // on a 768px laptop in every panel. Pinned here instead.
        announcements={{ count: announcementsUnread, onOpen: () => navigate("/hospital/announcements") }}
      />
      <SidebarHospitalStrip logoUrl={hospital?.logoUrl} name={hospital?.name || ""} roleCode={user?.role} role={user?.roleName || ""} />
    </Box>
  );

  // Until the required profile details are filled, keep the admin on the profile page.
  if (mustCompleteProfile) {
    return <Navigate to="/hospital/profile" replace />;
  }

  return (
    <ThemeProvider theme={hospitalTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.paper",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid", borderColor: "divider",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
          
          
        </Toolbar>
      </AppBar>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
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
              borderRight: "none"
            }
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
              boxShadow: "4px 0 24px rgba(0,0,0,0.03)"
            }
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" } }} /> {/* Spacer for fixed AppBar */}
        <TrialBanner />
        <Outlet />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
