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
  Chip,
  Badge,
} from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  LogoutRounded,
  AccountCircleRounded,
  CalendarTodayRounded,
  PersonAddRounded,
  QueueRounded,
  ReceiptRounded,
  LocalHospitalRounded,
  NotificationsRounded,
  WifiRounded,
  AccessTimeRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";

const drawerWidth = 260;

export default function ReceptionLayout() {
  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/reception/dashboard" },
    { text: "Appointments", icon: <CalendarTodayRounded />, path: "/reception/appointments" },
    { text: "Patient Queue", icon: <QueueRounded />, path: "/reception/queue" },
    { text: "Patient Search & Registry", icon: <PersonAddRounded />, path: "/reception/patients" },
    { text: "Billing", icon: <ReceiptRounded />, path: "/reception/billing" },
    { text: "Notifications", icon: <NotificationsRounded />, path: "/reception/notifications" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
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
        background: "linear-gradient(180deg, #0c1445 0%, #0c1a3a 100%)",
        color: "#f8fafc",
      }}
    >
      {/* Logo / Hospital Name */}
      <Toolbar
        sx={{
          px: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(6, 182, 212, 0.15)",
          minHeight: "70px !important",
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(6, 182, 212, 0.4)",
            flexShrink: 0,
          }}
        >
          <LocalHospitalRounded fontSize="small" sx={{ color: "#fff" }} />
        </Box>
        <Box sx={{ overflow: "hidden" }}>
          <Typography
            variant="subtitle1"
            fontWeight="700"
            noWrap
            sx={{ maxWidth: 170, color: "#f1f5f9" }}
          >
            {hospital?.name || "Reception"}
          </Typography>
          <Typography variant="caption" sx={{ color: "#06b6d4", fontWeight: 600 }}>
            Reception Portal
          </Typography>
        </Box>
      </Toolbar>

      {/* Status Pill */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.8,
            borderRadius: 2,
            bgcolor: "rgba(6, 182, 212, 0.08)",
            border: "1px solid rgba(6, 182, 212, 0.15)",
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#34d399",
              boxShadow: "0 0 6px #34d399",
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }}
          />
          <WifiRounded sx={{ fontSize: 14, color: "#06b6d4" }} />
          <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 500 }}>
            Live System
          </Typography>
        </Box>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1.5, pt: 1, flex: 1, overflowY: "auto" }}>
        <Typography
          variant="caption"
          sx={{ color: "#475569", fontWeight: 700, px: 1.5, pb: 1, display: "block", letterSpacing: 1, textTransform: "uppercase" }}
        >
          Reception
        </Typography>
        {menuItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/reception/dashboard" && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive
                    ? "rgba(6, 182, 212, 0.15)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(6, 182, 212, 0.25)"
                    : "1px solid transparent",
                  "&:hover": {
                    bgcolor: "rgba(6, 182, 212, 0.08)",
                    border: "1px solid rgba(6, 182, 212, 0.15)",
                  },
                  transition: "all 0.15s ease",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "#06b6d4" : "#64748b",
                    transition: "color 0.15s ease",
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
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#e2e8f0" : "#94a3b8",
                  }}
                />
                {isActive && (
                  <Box
                    sx={{
                      width: 4,
                      height: 24,
                      borderRadius: 2,
                      bgcolor: "#06b6d4",
                      boxShadow: "0 0 8px rgba(6, 182, 212, 0.6)",
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.1)" }} />

      {/* User card at bottom */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "rgba(6, 182, 212, 0.06)",
            border: "1px solid rgba(6, 182, 212, 0.12)",
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: "#0891b2",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            {user?.firstName?.charAt(0) || "R"}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1 }}>
            <Typography variant="caption" sx={{ color: "#e2e8f0", fontWeight: 600, display: "block" }} noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" sx={{ color: "#06b6d4", fontSize: "0.7rem" }}>
              {user?.roleName || "Receptionist"}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: "#334155", display: "block", textAlign: "center", mt: 1 }}>
          © {new Date().getFullYear()} HMS SaaS
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#070e24" }}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "rgba(7, 14, 36, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(6, 182, 212, 0.12)",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: "70px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AccessTimeRounded sx={{ color: "#06b6d4", fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 500 }}>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Chip
              label="Reception"
              size="small"
              sx={{
                bgcolor: "rgba(6, 182, 212, 0.1)",
                color: "#06b6d4",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />

            <Tooltip title="Notifications">
              <IconButton
                size="small"
                sx={{ color: "#64748b", "&:hover": { color: "#06b6d4" } }}
              >
                <Badge badgeContent={0} color="error">
                  <NotificationsRounded fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Account settings">
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  p: 0.5,
                  border: "2px solid rgba(6, 182, 212, 0.4)",
                  "&:hover": { borderColor: "#06b6d4" },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "#0891b2",
                    width: 32,
                    height: 32,
                    fontSize: "0.9rem",
                    fontWeight: 700,
                  }}
                >
                  {user?.firstName?.charAt(0) || "R"}
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
                  bgcolor: "#0c1a3a",
                  color: "#f8fafc",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  minWidth: 200,
                  "&:before": {
                    content: '""',
                    display: "block",
                    position: "absolute",
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: "#0c1a3a",
                    transform: "translateY(-50%) rotate(45deg)",
                    zIndex: 0,
                    borderLeft: "1px solid rgba(6, 182, 212, 0.2)",
                    borderTop: "1px solid rgba(6, 182, 212, 0.2)",
                  },
                },
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" fontWeight="600">
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                  {user?.email}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#06b6d4", mt: 0.5, display: "block", fontWeight: 600 }}
                >
                  {user?.roleName || "Receptionist"}
                </Typography>
              </Box>
              <MenuItem
                onClick={handleLogout}
                sx={{ gap: 1.5, py: 1, color: "#f87171" }}
              >
                <LogoutRounded fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

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
              borderRight: "1px solid rgba(6, 182, 212, 0.1)",
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
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar sx={{ minHeight: "70px !important" }} />
        <Outlet />
      </Box>
    </Box>
  );
}
