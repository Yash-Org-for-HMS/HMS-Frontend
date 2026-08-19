import { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SEMANTIC, NEUTRAL, alpha, BRAND } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const hospitalTheme = createPanelTheme(BRAND.action, BRAND.actionDark);
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  } from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  LocalHospitalRounded,
  PeopleRounded,
  CalendarTodayRounded,
  SettingsRounded,
  DomainRounded,
  BadgeRounded,
  WidgetsRounded,
  MedicalServicesRounded,
  DatasetRounded,
  DynamicFormRounded,
  SecurityRounded,
  AccountBalanceRounded,
  AssessmentRounded,
  HotelRounded,
  MonitorHeartRounded,
  VaccinesRounded,
  MedicationRounded,
  LocalHotelRounded,
  ReceiptLongRounded,
  FormatListNumberedRounded,
  LockRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { isAdmin as isAdminRole } from "@/constants/roles";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarSearch from "@/components/layout/SidebarSearch";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";
import { axiosInstance } from "@/api/axios";

const drawerWidth = 260;

export default function HospitalLayout() {
  useEffect(() => {
    document.title = "HMS | Hospital Admin";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar items; `adminOnly` tabs are hidden from non-admin roles.
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/hospital/dashboard", section: "Overview" },
    { text: "Hospital Profile", icon: <LocalHospitalRounded />, path: "/hospital/profile", adminOnly: true, section: "Overview" },
    // Admin-only: its endpoint (/billing/analytics) is admin-gated, so don't show
    // a tab non-admins can't actually open.
    { text: "Financial Analytics", icon: <AccountBalanceRounded />, path: "/hospital/financials", adminOnly: true, module: "Billing", section: "Overview" },
    { text: "GST Report", icon: <AssessmentRounded />, path: "/hospital/gst-report", adminOnly: true, module: "Billing", section: "Overview" },
    // Admin-only by design: raising a refund and approving it have to be
    // different people, so this never appears for the desk that raises them.
    { text: "Refund Approvals", icon: <AccountBalanceRounded />, path: "/hospital/refund-approvals", adminOnly: true, module: "Billing", section: "Overview" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/hospital/reports", section: "Overview" },
    // Operations: hospital-wide, read-oriented windows into day-to-day activity.
    // Admin-only (mirrors the backend org-wide data view for H_ADMIN); these
    // reuse the existing reception/IPD pages, mounted under the admin shell.
    { text: "All Patients", icon: <PeopleRounded />, path: "/hospital/patients", adminOnly: true, section: "Operations" },
    { text: "Appointments", icon: <CalendarTodayRounded />, path: "/hospital/appointments", adminOnly: true, section: "Operations" },
    { text: "Patient Queue", icon: <FormatListNumberedRounded />, path: "/hospital/queue", adminOnly: true, section: "Operations" },
    { text: "Admissions", icon: <LocalHotelRounded />, path: "/hospital/ipd/admissions", adminOnly: true, module: "IPD", section: "Operations" },
    { text: "Bed Board", icon: <HotelRounded />, path: "/hospital/ipd/beds", adminOnly: true, module: "IPD", section: "Operations" },
    { text: "Billing Overview", icon: <ReceiptLongRounded />, path: "/hospital/billing", adminOnly: true, module: "Billing", section: "Operations" },
    { text: "Departments", icon: <DomainRounded />, path: "/hospital/departments", adminOnly: true, section: "Organization" },
    { text: "Staff & Users", icon: <BadgeRounded />, path: "/hospital/users", adminOnly: true, section: "Organization" },
    { text: "Doctors", icon: <MedicalServicesRounded />, path: "/hospital/doctors", adminOnly: true, section: "Organization" },
    // Role Management and the Permission Matrix used to live here, commented
    // out. Both are gone now: every hospital uses the fixed standard role set,
    // and role authoring is removed rather than hidden — see the note in
    // rbac.controller.ts for why.
    { text: "Master Data", icon: <DatasetRounded />, path: "/hospital/lookups", adminOnly: true, section: "Configuration" },
    // Backend restricts these strictly to H_ADMIN/B_ADMIN (requireRole, no
    // permission-code bypass) — adminOnly here matches that exactly so a
    // custom role never sees a link that would just 403.
    { text: "Ward & Bed Setup", icon: <HotelRounded />, path: "/hospital/facility-setup", adminOnly: true, module: "IPD", section: "Configuration" },
    { text: "Ward Chart Settings", icon: <MonitorHeartRounded />, path: "/hospital/ward-chart", adminOnly: true, module: "IPD", section: "Configuration" },
    { text: "Vaccine Catalog", icon: <VaccinesRounded />, path: "/hospital/vaccines", adminOnly: true, section: "Configuration" },
    { text: "Schedule of Charges", icon: <ReceiptLongRounded />, path: "/hospital/soc", adminOnly: true, section: "Configuration" },
    { text: "Medicine Catalog", icon: <MedicationRounded />, path: "/hospital/medicines", adminOnly: true, section: "Configuration" },
    { text: "Form Builder", icon: <DynamicFormRounded />, path: "/hospital/form-builder", adminOnly: true, section: "Configuration" },
    { text: "Module Access", icon: <WidgetsRounded />, path: "/hospital/module-access", adminOnly: true, section: "Configuration" },
    { text: "Audit Logs", icon: <SecurityRounded />, path: "/hospital/audit-logs", adminOnly: true, section: "System" },
    { text: "System Settings", icon: <SettingsRounded />, path: "/hospital/settings", adminOnly: true, section: "System" },
  ];

  // Org AND branch admins see everything (mirrors the backend ADMIN_ROLE_CODES
  // bypass). B_ADMIN was previously omitted, which hid every permission-gated
  // tab for branch admins — leaving only the two ungated items (the "2 tabs" bug).
  const isAdmin = isAdminRole(user?.role);
  const { isModuleEnabled } = useEnabledModules();
  // Module-gated items are NOT hidden — they render with a lock badge so tenants
  // can discover the feature and upgrade (the page itself shows the upsell).
  // adminOnly / permission still gate visibility as before.
  const visibleMenuItems = menuItems.filter(item => {
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
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Hospital Admin"}
        subtitle="Admin Portal"
      />
      
      <SidebarSearch />
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {visibleMenuItems.map((item, idx, arr) => {
          const isActive = location.pathname.startsWith(item.path);
          const locked = isLocked(item);
          return (
            <Box key={item.text}>
              {(idx === 0 || arr[idx - 1].section !== item.section) && (
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", fontSize: "0.75rem", px: 1.5, pt: idx === 0 ? 0 : 1.75, pb: 0.5 }}>
                  {item.section}
                </Typography>
              )}
              <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? alpha(BRAND.action, 0.08) : "transparent",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? BRAND.action : NEUTRAL.muted,
                    opacity: locked ? 0.55 : 1,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? BRAND.action : NEUTRAL.muted,
                    sx: { opacity: locked ? 0.6 : 1 },
                  }}
                />
                {locked && <LockRounded sx={{ fontSize: 15, color: SEMANTIC.warning, ml: 1, flexShrink: 0 }} />}
              </ListItemButton>
            </ListItem>
            </Box>
          );
        })}
      </List>
      
      <Divider sx={{ borderColor: "divider" }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Administrator"}
        role={user?.roleName || "Administrator"}
        avatarText={user?.firstName?.charAt(0) || "A"}
        onLogout={logout}
        onProfile={() => navigate("/hospital/profile")}
      />
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
