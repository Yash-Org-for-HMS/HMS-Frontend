import { ACCENTS } from "@/styles/accents";
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, useTheme, useMediaQuery, Badge,
} from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  PeopleAltRounded,
  GroupsRounded,
  LogoutRounded,
  LocalHospitalRounded,
  QueueRounded,
  ScienceRounded,
  AssessmentRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { assetUrl } from "@/utils/assetUrl";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";
import { axiosInstance } from "@/api/axios";
import { useSocket } from "@/hooks/useSocket";
import { DASHBOARD_POLL_MS } from "@/constants/intervals";

const drawerWidth = 260;
const DOCTOR_BLUE = ACCENTS.doctor;
const DOCTOR_BLUE_DARK = ACCENTS.doctorDark;

export default function DoctorLayout() {
  useEffect(() => {
    document.title = "HMS | Doctor";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar notification counts (unread results, patients waiting). Polls as a
  // fallback and refreshes instantly on queue/order socket events.
  const { data: badges } = useQuery({
    queryKey: ["doctor-badges"],
    queryFn: async () => (await axiosInstance.get("/doctor/badges")).data.data as { resultsReady: number; queueWaiting: number },
    refetchInterval: DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  useSocket({ QUEUE_UPDATED: () => queryClient.invalidateQueries({ queryKey: ["doctor-badges"] }) });

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/doctor/dashboard", badge: 0, section: "Overview" },
    { text: "My Queue", icon: <QueueRounded />, path: "/doctor/queue", badge: badges?.queueWaiting || 0, section: "My Work" },
    { text: "My Patients", icon: <PeopleAltRounded />, path: "/doctor/patients", badge: 0, section: "My Work" },
    { text: "All Patients", icon: <GroupsRounded />, path: "/doctor/all-patients", badge: 0, section: "My Work" },
    { text: "Results", icon: <ScienceRounded />, path: "/doctor/results", badge: badges?.resultsReady || 0, section: "My Work" },
    { text: "My Reports", icon: <AssessmentRounded />, path: "/doctor/reports", badge: 0, section: "Insights" },
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
        title={hospital?.name || "Doctor"}
        subtitle="Doctor Workspace"
      />

      {/* Navigation */}
      <List sx={{ px: 1.5, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item, idx, arr) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/doctor/dashboard" && location.pathname.startsWith(item.path));
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
                  bgcolor: isActive ? `rgba(59,130,246,0.12)` : "transparent",
                  "&:hover": { bgcolor: `rgba(59,130,246,0.08)` },
                  transition: "all 0.15s ease",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? DOCTOR_BLUE : "text.secondary",
                    transition: "color 0.15s ease",
                  }}
                >
                  <Badge badgeContent={item.badge} color="error" max={99} overlap="circular">
                    {item.icon}
                  </Badge>
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? DOCTOR_BLUE : "text.secondary",
                  }}
                />
              </ListItemButton>
            </ListItem>
            </Box>
          );
        })}
      </List>

      <Divider sx={{ borderColor: `rgba(59,130,246,0.1)` }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <SidebarUserCard
        name={`Dr. ${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
        role={user?.roleName || "Doctor"}
        avatarText={user?.firstName?.charAt(0) || "D"}
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
          borderBottom: `1px solid rgba(59,130,246,0.12)`,
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
        <ModuleGate module="Doctor"><Outlet /></ModuleGate>
      </Box>
    </Box>
  );
}
