import { useState, useEffect, type ReactNode } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  PeopleAltRounded,
  TimerRounded,
  CardMembershipRounded,
  ReceiptLongRounded,
  HandshakeRounded,
  AdminPanelSettingsRounded,
  LogoutRounded,
  AccountCircleRounded,
  SecurityRounded,
  HistoryRounded,
  NotificationsActiveRounded,
  AssessmentRounded,
} from "@mui/icons-material";
import { useAuth } from "@/providers/AuthContext";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import { ACCENTS, NEUTRAL } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const adminTheme = createPanelTheme(ACCENTS.admin, ACCENTS.adminDark);

const drawerWidth = 260;

export default function AdminLayout() {
  useEffect(() => {
    document.title = "HMS | Super Admin";
  }, []);

  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Grouped navigation that follows the tenant lifecycle so the flow reads
  // top-to-bottom: see the overview → work the sales pipeline → manage tenants →
  // control access → configure the platform → audit.
  const navGroups: { heading: string | null; items: { text: string; icon: ReactNode; path: string }[] }[] = [
    {
      heading: t("nav.group.overview", "Overview"),
      items: [
        { text: t("nav.dashboard"), icon: <DashboardRounded />, path: "/" },
        { text: t("nav.reports", "Reports"), icon: <AssessmentRounded />, path: "/reports" },
        { text: "Action Needed", icon: <NotificationsActiveRounded />, path: "/onboarding" },
      ],
    },
    {
      heading: t("nav.group.salesPipeline", "Sales Pipeline"),
      items: [
        { text: t("nav.leads"), icon: <PeopleAltRounded />, path: "/leads" },
        { text: t("nav.trials"), icon: <TimerRounded />, path: "/trials" },
      ],
    },
    {
      heading: t("nav.group.tenants", "Tenants"),
      items: [{ text: t("nav.hospitals"), icon: <LocalHospitalRounded />, path: "/hospitals" }],
    },
    {
      heading: t("nav.group.accessControl", "Access Control"),
      items: [
        { text: t("nav.roles", "Hospital Roles"), icon: <SecurityRounded />, path: "/rbac/roles" },
        { text: t("nav.users", "Hospital Staff"), icon: <PeopleAltRounded />, path: "/rbac/users" },
        { text: t("nav.superAdmins"), icon: <AdminPanelSettingsRounded />, path: "/super-admins" },
      ],
    },
    {
      heading: t("nav.group.configuration", "Configuration"),
      items: [
        { text: t("nav.plans"), icon: <CardMembershipRounded />, path: "/plans" },
        { text: t("nav.subscriptionBilling", "Billing"), icon: <ReceiptLongRounded />, path: "/subscription-billing" },
        // Feature Flags page hidden: its only functional keys (MODULE_*) are managed
        // better by the per-hospital Module Access screen (immediate, cache-aware),
        // and its Global scope / arbitrary keys are not consumed by any code. The
        // backend table, API, and Module Access screen are left untouched.
      ],
    },
    {
      heading: t("nav.group.system", "System"),
      items: [{ text: t("nav.auditLogs"), icon: <HistoryRounded />, path: "/audit-logs" }],
    },
  ];

  // A nav item is active for its own route and any nested route beneath it
  // (e.g. /leads/new keeps "Leads" highlighted). "/" only matches exactly.
  const isActivePath = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(path + "/");

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
        title="HMS Admin"
        subtitle="Platform Console"
      />
      
      <List sx={{ px: 2, pt: 1.5, flex: 1, overflowY: "auto" }}>
        {navGroups.map((group, gi) => (
          <Box key={group.heading ?? gi} sx={{ mb: 1 }}>
            {group.heading && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  pt: gi === 0 ? 0.5 : 1.5,
                  pb: 0.5,
                  color: "text.secondary",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {group.heading}
              </Typography>
            )}
            {group.items.map((item) => {
              const isActive = isActivePath(item.path);
              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: 2,
                      bgcolor: isActive ? "rgba(79, 70, 229, 0.08)" : "transparent",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isActive ? ACCENTS.adminDark : NEUTRAL.muted,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: "0.875rem",
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? ACCENTS.adminDark : NEUTRAL.muted,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>
      
      <Divider sx={{ borderColor: "divider" }} />

      {/* User card at bottom */}
      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Super Admin"}
        role="Super Admin"
        avatarText={user?.firstName?.charAt(0) || "A"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <ThemeProvider theme={adminTheme}>
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
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ display: { xs: "none", md: "block" } }} />

          
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
    </ThemeProvider>
  );
}
