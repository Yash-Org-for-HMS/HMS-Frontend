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
  SearchRounded,
  LocalHotelRounded,
  HotelRounded,
  NotificationsRounded,
  WifiRounded,
  AccessTimeRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import { assetUrl } from "../utils/assetUrl";
import BranchSwitcher from "../components/BranchSwitcher";
import SidebarHeader from "../components/layout/SidebarHeader";
import SidebarUserCard from "../components/layout/SidebarUserCard";
import { useEnabledModules } from "../hooks/useEnabledModules";

const drawerWidth = 260;

export default function ReceptionLayout() {
  useEffect(() => {
    document.title = "HMS | Reception";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const { isModuleEnabled } = useEnabledModules();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();

  // Grouped into sections that follow the front-desk workflow:
  // overview → patient flow → clinical lookups → in-patient → finance → system.
  const navSections = [
    {
      heading: "Overview",
      items: [
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
        { text: "Referrals", icon: <CallSplitRounded />, path: "/reception/referrals" },
      ],
    },
    {
      heading: "In-Patient",
      items: [
        { text: "Admissions", icon: <LocalHotelRounded />, path: "/reception/ipd/admissions", module: "IPD" },
        { text: "Bed Management", icon: <HotelRounded />, path: "/reception/ipd/beds", module: "IPD" },
      ],
    },
    {
      heading: "Finance & Insights",
      items: [
        { text: "Billing", icon: <ReceiptRounded />, path: "/reception/billing" },
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
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Reception"}
        subtitle="Reception Portal"
      />

      {/* Quick search — opens the command palette (also ⌘K / Ctrl+K) */}
      <Box sx={{ px: 1.5, pt: 1.5 }}>
        <Box
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          sx={{
            display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: 2, cursor: "pointer",
            border: "1px solid", borderColor: "divider", bgcolor: "background.default", color: "text.secondary",
            "&:hover": { borderColor: "primary.main", color: "text.primary" }, transition: "all 0.15s ease",
          }}
        >
          <SearchRounded sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ flex: 1 }}>Search…</Typography>
          <Chip label="⌘K" size="small" sx={{ height: 20, fontSize: "0.75rem", fontWeight: 700, bgcolor: "action.hover", color: "text.secondary" }} />
        </Box>
      </Box>

      {/* Navigation — hide items for modules this hospital doesn't have, and
          drop any section left empty. */}
      <List sx={{ px: 1.5, pt: 1, flex: 1, overflowY: "auto" }}>
        {navSections
          .map((section) => ({ ...section, items: section.items.filter((i) => isModuleEnabled((i as any).module)) }))
          .filter((section) => section.items.length > 0)
          .map((section, si) => (
          <Box key={section.heading} sx={{ mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: "#475569", fontWeight: 700, px: 1.5, pt: si === 0 ? 0 : 1.5, pb: 0.75, display: "block", letterSpacing: 1, textTransform: "uppercase", fontSize: "0.75rem" }}
            >
              {section.heading}
            </Typography>
            {section.items.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/reception/dashboard" && location.pathname.startsWith(item.path));
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
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>

      <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.1)" }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Receptionist"}
        role={user?.roleName || "Receptionist"}
        avatarText={user?.firstName?.charAt(0) || "R"}
        onLogout={logout}
      />
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
