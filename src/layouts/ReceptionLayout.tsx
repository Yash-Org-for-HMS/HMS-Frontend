import { useState, useEffect } from "react";
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
  MedicalServicesRounded,
  ApartmentRounded,
  CallSplitRounded,
  AssessmentRounded,
  LocalHotelRounded,
  HotelRounded,
  NotificationsRounded,
  WifiRounded,
  AccessTimeRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import { assetUrl } from "../utils/assetUrl";
import BranchSwitcher from "../components/BranchSwitcher";

const drawerWidth = 260;

export default function ReceptionLayout() {
  useEffect(() => {
    document.title = "HMS | Reception";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/reception/dashboard" },
    { text: "Front Desk Console", icon: <PersonAddRounded />, path: "/reception/console" },
    { text: "Appointments", icon: <CalendarTodayRounded />, path: "/reception/appointments" },
    { text: "Doctor Availability", icon: <MedicalServicesRounded />, path: "/reception/doctors" },
    { text: "Department Directory", icon: <ApartmentRounded />, path: "/reception/directory" },
    { text: "Referrals", icon: <CallSplitRounded />, path: "/reception/referrals" },
    { text: "Admissions (IPD)", icon: <LocalHotelRounded />, path: "/reception/ipd/admissions" },
    { text: "Bed Management", icon: <HotelRounded />, path: "/reception/ipd/beds" },
    { text: "Patient Queue", icon: <QueueRounded />, path: "/reception/queue" },
    { text: "All Patients", icon: <AccountCircleRounded />, path: "/reception/patients" },
    { text: "Billing", icon: <ReceiptRounded />, path: "/reception/billing" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/reception/reports" },
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
        bgcolor: "background.paper",
        color: "text.primary",
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
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: hospital?.logoUrl ? "transparent" : "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: hospital?.logoUrl ? "none" : "0 0 16px rgba(6, 182, 212, 0.4)",
            flexShrink: 0,
            overflow: "hidden"
          }}
        >
          {hospital?.logoUrl ? (
            <img src={assetUrl(hospital.logoUrl)} alt="Hospital Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <LocalHospitalRounded fontSize="medium" sx={{ color: "#fff" }} />
          )}
        </Box>
        <Box sx={{ overflow: "hidden" }}>
          <Typography
            variant="subtitle1"
            fontWeight="700"
            noWrap
            sx={{ maxWidth: 170, color: "text.primary" }}
          >
            {hospital?.name || "Reception"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            Reception Portal
          </Typography>
        </Box>
      </Toolbar>

      {/* Status Pill Removed for clean aesthetic */}

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
                    color: isActive ? "primary.main" : "text.secondary",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.1)" }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: "primary.main",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            {user?.firstName?.charAt(0) || "R"}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "block" }} noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
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
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" }, minHeight: "70px !important" }} />
        <Outlet />
      </Box>
    </Box>
  );
}
