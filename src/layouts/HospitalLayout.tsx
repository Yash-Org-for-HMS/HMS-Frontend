import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";

const drawerWidth = 260;

export default function HospitalLayout() {
  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  // Placeholder navigation items for future phases
  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/hospital/dashboard" },
    { text: "Patients", icon: <PeopleRounded />, path: "/hospital/patients" },
    { text: "Appointments", icon: <CalendarTodayRounded />, path: "/hospital/appointments" },
    { text: "Laboratory", icon: <ScienceRounded />, path: "/hospital/lab" },
    { text: "System Settings", icon: <SettingsRounded />, path: "/hospital/settings" },
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
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LocalHospitalRounded fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight="700" noWrap sx={{ maxWidth: 180 }}>
            {hospital?.name || "Hospital Admin"}
          </Typography>
        </Box>
      </Toolbar>
      
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item) => {
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
                  bgcolor: isActive ? "rgba(16, 185, 129, 0.15)" : "transparent",
                  "&:hover": {
                    bgcolor: "rgba(16, 185, 129, 0.08)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "#34d399" : "#94a3b8",
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
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Account settings">
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  p: 0.5,
                  border: "2px solid rgba(16, 185, 129, 0.5)",
                  "&:hover": { borderColor: "#34d399" },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "#10b981",
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
                <Typography variant="caption" sx={{ color: "#10b981", mt: 0.5, display: "block", fontWeight: 600 }}>
                  {user?.roleName}
                </Typography>
              </Box>
              <MenuItem onClick={() => { handleMenuClose(); navigate("/hospital/profile"); }} sx={{ gap: 1.5, py: 1 }}>
                <AccountCircleRounded fontSize="small" sx={{ color: "#94a3b8" }} />
                Profile Settings
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
