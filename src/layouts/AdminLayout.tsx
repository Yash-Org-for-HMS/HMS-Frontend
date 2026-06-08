import { useState, useEffect } from "react";
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
  useEffect(() => {
    document.title = "HMS | Super Admin";
  }, []);

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
    { text: t("nav.roles", "Hospital Roles"), icon: <SecurityRounded />, path: "/rbac/roles" },
    { text: t("nav.users", "Hospital Staff"), icon: <PeopleAltRounded />, path: "/rbac/users" },
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
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Toolbar
        sx={{
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid", borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: "primary.main",
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
                  bgcolor: isActive ? "rgba(79, 70, 229, 0.08)" : "transparent",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "#4F46E5" : "#64748B",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#4F46E5" : "#64748B",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      
      <Box sx={{ height: 16 }} />
      
      
      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleMenuOpen}
            sx={{
              borderRadius: 2,
              "&:hover": { bgcolor: "action.hover" },
              px: 1,
            }}
          >
            <Avatar
              sx={{
                bgcolor: "primary.main",
                width: 32,
                height: 32,
                fontSize: "0.9rem",
                mr: 1.5,
              }}
            >
              {user?.firstName?.charAt(0) || "U"}
            </Avatar>
            <ListItemText 
              primary={user?.firstName ? `${user.firstName} ${user.lastName || ''}` : "Admin"} 
              primaryTypographyProps={{ fontWeight: 600, fontSize: "0.9rem" }}
            />
          </ListItemButton>
        </ListItem>
    
            
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
                  bgcolor: "background.paper",
                  color: "text.primary",
                  border: "1px solid", borderColor: "divider",
                  overflow: "visible",
                  "&:before": {
                    content: '""',
                    display: "block",
                    position: "absolute",
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: "background.paper",
                    transform: "translateY(-50%) rotate(45deg)",
                    zIndex: 0,
                    borderLeft: "1px solid",
                    borderTop: "1px solid", borderColor: "divider",
                  },
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="600">
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItem onClick={handleMenuClose} sx={{ gap: 1.5, py: 1 }}>
                <AccountCircleRounded fontSize="small" sx={{ color: "text.secondary" }} />
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1, color: "#f87171" }}>
                <LogoutRounded fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
      </Box>
    
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          © {new Date().getFullYear()} HMS SaaS
        </Typography>
      </Box>
    </Box>
  );

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
  );
}
