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
  LogoutRounded,
  LocalHospitalRounded,
  QueueRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import { assetUrl } from "../utils/assetUrl";
import BranchSwitcher from "../components/BranchSwitcher";

const drawerWidth = 260;
const DOCTOR_BLUE = "#3b82f6";
const DOCTOR_BLUE_DARK = "#2563eb";

export default function DoctorLayout() {
  useEffect(() => {
    document.title = "HMS | Doctor";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/doctor/dashboard" },
    { text: "My Queue", icon: <QueueRounded />, path: "/doctor/queue" },
    { text: "My Patients", icon: <PeopleAltRounded />, path: "/doctor/patients" },
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
      <Toolbar
        sx={{
          px: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: `1px solid rgba(59,130,246,0.15)`,
          minHeight: "70px !important",
        }}
      >
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 1.5,
            background: hospital?.logoUrl ? "transparent" : `linear-gradient(135deg, ${DOCTOR_BLUE_DARK}, ${DOCTOR_BLUE})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: hospital?.logoUrl ? "none" : `0 0 16px rgba(59,130,246,0.35)`,
            flexShrink: 0,
            overflow: "hidden"
          }}
        >
          {hospital?.logoUrl ? (
            <img src={assetUrl(hospital.logoUrl)} alt="Hospital Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <LocalHospitalRounded fontSize="small" sx={{ color: "#fff" }} />
          )}
        </Box>
        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="subtitle1" fontWeight="700" noWrap sx={{ maxWidth: 170, color: "text.primary" }}>
            {hospital?.name || "Doctor Panel"}
          </Typography>
          <Typography variant="caption" sx={{ color: DOCTOR_BLUE, fontWeight: 600 }}>
            Doctor Workspace
          </Typography>
        </Box>
      </Toolbar>

      {/* Navigation */}
      <List sx={{ px: 1.5, pt: 2, flex: 1, overflowY: "auto" }}>
        <Typography
          variant="caption"
          sx={{ color: "#475569", fontWeight: 700, px: 1.5, pb: 1, display: "block", letterSpacing: 1, textTransform: "uppercase" }}
        >
          My Workspace
        </Typography>
        {menuItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/doctor/dashboard" && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
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
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? DOCTOR_BLUE : "text.secondary",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: `rgba(59,130,246,0.1)` }} />

      {/* Branch switcher (only shown to multi-branch users) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <BranchSwitcher />
      </Box>

      {/* User card at bottom */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex", alignItems: "center", gap: 1.5, p: 1.5,
            borderRadius: 2, bgcolor: "background.default",
            border: "1px solid", borderColor: "divider",
          }}
        >
          <Avatar
            sx={{
              width: 34, height: 34,
              background: `linear-gradient(135deg, ${DOCTOR_BLUE_DARK}, ${DOCTOR_BLUE})`,
              fontSize: "0.85rem", fontWeight: 700,
            }}
          >
            {user?.firstName?.charAt(0) || "D"}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "block" }} noWrap>
              Dr. {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" sx={{ color: DOCTOR_BLUE, fontSize: "0.7rem", fontWeight: 600 }}>
              {user?.roleName || "Doctor"}
            </Typography>
          </Box>
          <IconButton size="small" onClick={logout} sx={{ color: "text.secondary", "&:hover": { color: "#ef4444" } }}>
            <LogoutRounded fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: "#334155", display: "block", textAlign: "center", mt: 1 }}>
          © {new Date().getFullYear()} HMS SaaS
        </Typography>
      </Box>
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
        <Outlet />
      </Box>
    </Box>
  );
}
