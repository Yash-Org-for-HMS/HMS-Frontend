import { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  LocalHospitalRounded,
  LogoutRounded,
  AccountCircleRounded,
  PeopleRounded,
  CalendarTodayRounded,
  ScienceRounded,
  SettingsRounded,
  DomainRounded,
  BadgeRounded,
  WidgetsRounded,
  MedicalServicesRounded,
  DatasetRounded,
  DynamicFormRounded,
  SecurityRounded,
  AccountBalanceRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import BranchSwitcher from "../components/BranchSwitcher";
import SidebarHeader from "../components/layout/SidebarHeader";
import SidebarUserCard from "../components/layout/SidebarUserCard";
import { axiosInstance } from "../api/axios";

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

  // Map sidebar items to required permissions
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/hospital/dashboard", permission: null },
    { text: "Hospital Profile", icon: <LocalHospitalRounded />, path: "/hospital/profile", permission: null, adminOnly: true },
    // Admin-only: its endpoint (/billing/analytics) is admin-gated, so don't show
    // a tab non-admins can't actually open.
    { text: "Financial Analytics", icon: <AccountBalanceRounded />, path: "/hospital/financials", permission: null, adminOnly: true },
    { text: "Departments", icon: <DomainRounded />, path: "/hospital/departments", permission: "DEPARTMENT_MANAGE" },
    { text: "Staff & Users", icon: <BadgeRounded />, path: "/hospital/users", permission: "USER_MANAGE" },
    { text: "Doctors", icon: <MedicalServicesRounded />, path: "/hospital/doctors", permission: "USER_MANAGE" },
    // Custom roles + granular permissions are shelved until the permission model
    // is fully wired/enforced. Routes still exist; just hidden from the nav for
    // now (re-add these two entries to bring the feature back).
    // { text: "Role Management", icon: <ShieldRounded />, path: "/hospital/roles", permission: "ROLE_MANAGE" },
    // { text: "Permission Matrix", icon: <RuleRounded />, path: "/hospital/permissions-matrix", permission: "ROLE_MANAGE" },
    { text: "Master Data", icon: <DatasetRounded />, path: "/hospital/lookups", permission: "SETTINGS_MANAGE" },
    { text: "Form Builder", icon: <DynamicFormRounded />, path: "/hospital/form-builder", permission: "SETTINGS_MANAGE" },
    { text: "Module Access", icon: <WidgetsRounded />, path: "/hospital/module-access", permission: "SETTINGS_MANAGE" },
    { text: "Audit Logs", icon: <SecurityRounded />, path: "/hospital/audit-logs", permission: "SETTINGS_MANAGE" },
    { text: "System Settings", icon: <SettingsRounded />, path: "/hospital/settings", permission: "SETTINGS_MANAGE" },
  ];

  // Org AND branch admins see everything (mirrors the backend ADMIN_ROLE_CODES
  // bypass). B_ADMIN was previously omitted, which hid every permission-gated
  // tab for branch admins — leaving only the two ungated items (the "2 tabs" bug).
  const isAdmin = ["H_ADMIN", "B_ADMIN", "HOSPITAL_ADMIN"].includes(user?.role || "");
  const visibleMenuItems = menuItems.filter(item => {
    if ((item as any).adminOnly) return isAdmin;   // admin-only tab (e.g. Financial)
    if (!item.permission) return true;
    if (isAdmin) return true;
    return user?.permissions?.includes(item.permission);
  });

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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
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
      
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? "rgba(16, 185, 129, 0.08)" : "transparent",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "#10B981" : "#64748B",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#10B981" : "#64748B",
                  }}
                />
              </ListItemButton>
            </ListItem>
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" } }} /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
}
