import { useState } from "react";
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
  ToggleOnRounded,
  HandshakeRounded,
  AdminPanelSettingsRounded,
  LogoutRounded,
  AccountCircleRounded,
  SecurityRounded,
  HistoryRounded,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

const drawerWidth = 260;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    { text: t("nav.dashboard"), icon: <DashboardRounded />, path: "/" },
    { text: t("nav.hospitals"), icon: <LocalHospitalRounded />, path: "/hospitals" },
    { text: t("nav.leads"), icon: <PeopleAltRounded />, path: "/leads" },
    { text: t("nav.trials"), icon: <TimerRounded />, path: "/trials" },
    { text: t("nav.plans"), icon: <CardMembershipRounded />, path: "/plans" },
    { text: t("nav.featureFlags"), icon: <ToggleOnRounded />, path: "/feature-flags" },
    { text: t("nav.onboarding"), icon: <HandshakeRounded />, path: "/onboarding" },
    { text: t("nav.superAdmins"), icon: <AdminPanelSettingsRounded />, path: "/super-admins" },
    { text: t("nav.roles") || "Roles", icon: <SecurityRounded />, path: "/rbac/roles" },
    { text: t("nav.users") || "Users", icon: <PeopleAltRounded />, path: "/rbac/users" },
    { text: t("nav.auditLogs"), icon: <HistoryRounded />, path: "/audit-logs" },
  ];

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
        bgcolor: "#0f172a",
        color: "#f8fafc",
      }}
    >
      <Toolbar
        sx={{
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">H</Typography>
        </Box>
        <Typography variant="h6" fontWeight="700" noWrap>
          HMS Admin
        </Typography>
      </Toolbar>
      
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
                  "&:hover": {
                    bgcolor: "rgba(99, 102, 241, 0.08)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "#818cf8" : "#94a3b8",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#fff" : "#cbd5e1",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />
      
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: "#64748b" }}>
          © {new Date().getFullYear()} HMS SaaS
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#0f172a" }}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
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

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Account settings">
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  p: 0.5,
                  border: "2px solid rgba(99, 102, 241, 0.5)",
                  "&:hover": { borderColor: "#818cf8" },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "#6366f1",
                    width: 32,
                    height: 32,
                    fontSize: "0.9rem",
                  }}
                >
                  {user?.firstName?.charAt(0) || "U"}
                </Avatar>
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{
                elevation: 0,
                sx: {
                  mt: 1.5,
                  bgcolor: "#1e293b",
                  color: "#f8fafc",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  overflow: "visible",
                  "&:before": {
                    content: '""',
                    display: "block",
                    position: "absolute",
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: "#1e293b",
                    transform: "translateY(-50%) rotate(45deg)",
                    zIndex: 0,
                    borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  },
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)", mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="600">
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItem onClick={handleMenuClose} sx={{ gap: 1.5, py: 1 }}>
                <AccountCircleRounded fontSize="small" sx={{ color: "#94a3b8" }} />
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1, color: "#f87171" }}>
                <LogoutRounded fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
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
              borderRight: "1px solid rgba(255, 255, 255, 0.08)",
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
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
}
