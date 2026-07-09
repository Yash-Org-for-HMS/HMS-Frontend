import { ACCENTS } from "../styles/accents";
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, useTheme, useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  PeopleAltRounded,
  LocalHospitalRounded,
  LogoutRounded,
  MedicalServicesRounded,
  AssessmentRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import BranchSwitcher from "../components/BranchSwitcher";
import SidebarHeader from "../components/layout/SidebarHeader";
import SidebarUserCard from "../components/layout/SidebarUserCard";
import TrialBanner from "../components/layout/TrialBanner";

const drawerWidth = 260;
const NURSE_PURPLE = ACCENTS.nurse;

export default function NurseLayout() {
  useEffect(() => {
    document.title = "HMS | Nurse";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/nurse/dashboard", section: "Overview" },
    { text: "Patient Queue", icon: <PeopleAltRounded />, path: "/nurse/queue", section: "Patient Care" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/nurse/reports", section: "Reports" },
  ];

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

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
      {/* Logo / Header */}
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Nurse"}
        subtitle="Nursing Station"
      />

      {/* Navigation */}
      <List sx={{ px: 1.5, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item, idx, arr) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/nurse/dashboard" && location.pathname.startsWith(item.path));
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
                  bgcolor: isActive ? `rgba(167,139,250,0.12)` : "transparent",
                  "&:hover": { bgcolor: `rgba(167,139,250,0.08)` },
                  transition: "all 0.15s ease",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? NURSE_PURPLE : "text.secondary",
                    transition: "color 0.15s ease",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? NURSE_PURPLE : "text.secondary",
                  }}
                />
              </ListItemButton>
            </ListItem>
            </Box>
          );
        })}
      </List>

      <Divider sx={{ borderColor: `rgba(167,139,250,0.1)` }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Nurse"}
        role={user?.roleName || "Nurse"}
        avatarText={user?.firstName?.charAt(0) || "N"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Mobile Topbar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.paper",
          borderBottom: `1px solid rgba(167,139,250,0.12)`,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: "70px !important" }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box", width: drawerWidth, borderRight: "none",
              borderTopRightRadius: 24, borderBottomRightRadius: 24,
              boxShadow: "4px 0 24px rgba(0,0,0,0.03)",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1, p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh", display: "flex", flexDirection: "column",
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" }, minHeight: "70px !important" }} />
        <TrialBanner />
        <Outlet />
      </Box>
    </Box>
  );
}
