import { useState, useEffect } from "react";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ModuleGate from "@/components/ModuleGate";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
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
} from "@mui/material";
import {
  Menu as MenuIcon,
  DashboardRounded,
  ScienceRounded,
  SettingsAccessibilityRounded,
  LogoutRounded,
  AccountCircleRounded,
  LocalHospitalRounded,
  MenuBookRounded,
  AssessmentRounded,
  ReceiptLongRounded,
  LockRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";

const drawerWidth = 260;

export default function LabLayout() {
  useEffect(() => {
    document.title = "HMS | Lab & Radiology";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/lab/dashboard", section: "Overview" },
    { text: "Lab Orders", icon: <ScienceRounded />, path: "/lab/orders", section: "Orders" },
    { text: "Radiology Orders", icon: <SettingsAccessibilityRounded />, path: "/lab/radiology", section: "Orders" },
    { text: "Billing", icon: <ReceiptLongRounded />, path: "/lab/billing", section: "Billing", module: "Billing" },
    { text: "Lab Catalog", icon: <MenuBookRounded />, path: "/lab/catalog", section: "Catalogs" },
    { text: "Radiology Catalog", icon: <MenuBookRounded />, path: "/lab/radiology-catalog", section: "Catalogs" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/lab/reports", section: "Reports" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  
  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper", color: "text.primary" }}>
      <SidebarHeader
        logoUrl={hospital?.logoUrl}
        title={hospital?.name || "Lab"}
        subtitle="Lab & Radiology"
      />
      
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item, idx, arr) => {
          const isActive = location.pathname.startsWith(item.path);
          const locked = (item as any).module && !isModuleEnabled((item as any).module);
          return (
            <Box key={item.text}>
              {(idx === 0 || arr[idx - 1].section !== item.section) && (
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", fontSize: "0.75rem", px: 1.5, pt: idx === 0 ? 0 : 1.75, pb: 0.5 }}>
                  {item.section}
                </Typography>
              )}
              <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                sx={{ borderRadius: 2, bgcolor: isActive ? "rgba(16, 185, 129, 0.08)" : "transparent", "&:hover": { bgcolor: "action.hover" } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isActive ? SEMANTIC.success : NEUTRAL.muted, opacity: locked ? 0.55 : 1 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: isActive ? 600 : 500, color: isActive ? SEMANTIC.success : NEUTRAL.muted, sx: { opacity: locked ? 0.6 : 1 } }} />
                {locked && <LockRounded sx={{ fontSize: 15, color: SEMANTIC.warning, ml: 1, flexShrink: 0 }} />}
              </ListItemButton>
            </ListItem>
            </Box>
          );
        })}
      </List>

      <Box sx={{ px: 2, pb: 1 }}>
        <BranchSwitcher />
      </Box>

      <SidebarUserCard
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Lab Technician"}
        role={user?.roleName || "Lab Technician"}
        avatarText={user?.firstName?.charAt(0) || "L"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" elevation={0} sx={{ display: { xs: "block", md: "none" }, width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: "none" }, color: "text.primary" }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" } }}>
          {drawerContent}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none", borderTopRightRadius: 24, borderBottomRightRadius: 24, boxShadow: "4px 0 24px rgba(0,0,0,0.03)" } }} open>
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${drawerWidth}px)` }, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Toolbar sx={{ display: { xs: "block", md: "none" } }} />
        <TrialBanner />
        <ModuleGate module="Laboratory"><Outlet /></ModuleGate>
      </Box>
    </Box>
  );
}
