import { useState, useEffect } from "react";
import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { ThemeProvider } from "@mui/material/styles";
import { createPanelTheme } from "@/theme";
const pharmacyTheme = createPanelTheme(ACCENTS.pharmacy, ACCENTS.pharmacyDark);
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
  MedicationRounded,
  LocalShippingRounded,
  InventoryRounded,
  PointOfSaleRounded,
  LogoutRounded,
  LocalHospitalRounded,
  AssessmentRounded,
  LocalPharmacyRounded,
  LockRounded,
} from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import BranchSwitcher from "@/components/BranchSwitcher";
import SidebarHeader from "@/components/layout/SidebarHeader";
import SidebarUserCard from "@/components/layout/SidebarUserCard";
import TrialBanner from "@/components/layout/TrialBanner";

const drawerWidth = 260;

export default function PharmacyLayout() {
  useEffect(() => {
    document.title = "HMS | Pharmacy Portal";
  }, []);

  const { user, hospital, logout } = useHospitalAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/pharmacy/dashboard", section: "Overview" },
    { text: "Dispensary (POS)", icon: <PointOfSaleRounded />, path: "/pharmacy/pos", section: "Dispensary" },
    { text: "IPD Medication Requests", icon: <LocalPharmacyRounded />, path: "/pharmacy/ipd-requests", section: "Dispensary", module: "IPD" },
    { text: "Medicine Catalog", icon: <MedicationRounded />, path: "/pharmacy/medicines", section: "Inventory" },
    { text: "Suppliers", icon: <LocalShippingRounded />, path: "/pharmacy/suppliers", section: "Inventory" },
    { text: "Inventory & POs", icon: <InventoryRounded />, path: "/pharmacy/inventory", section: "Inventory" },
    { text: "Reports", icon: <AssessmentRounded />, path: "/pharmacy/reports", section: "Reports" },
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
        title={hospital?.name || "Pharmacy"}
        subtitle="Pharmacy Portal"
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
                sx={{ borderRadius: 2, bgcolor: isActive ? "rgba(79, 70, 229, 0.08)" : "transparent", "&:hover": { bgcolor: "action.hover" } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isActive ? ACCENTS.pharmacy : NEUTRAL.muted, opacity: locked ? 0.55 : 1 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: isActive ? 600 : 500, color: isActive ? ACCENTS.pharmacy : NEUTRAL.muted, sx: { opacity: locked ? 0.6 : 1 } }} />
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
        name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Pharmacist"}
        role={user?.roleName || "Pharmacist"}
        avatarText={user?.firstName?.charAt(0) || "P"}
        onLogout={logout}
      />
    </Box>
  );

  return (
    <ThemeProvider theme={pharmacyTheme}>
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
        <ModuleGate module="Pharmacy"><Outlet /></ModuleGate>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
