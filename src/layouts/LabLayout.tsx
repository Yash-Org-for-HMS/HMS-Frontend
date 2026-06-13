import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
} from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import { assetUrl } from "../utils/assetUrl";

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

  const menuItems = [
    { text: "Dashboard", icon: <DashboardRounded />, path: "/lab/dashboard" },
    { text: "Lab Orders", icon: <ScienceRounded />, path: "/lab/orders" },
    { text: "Radiology Orders", icon: <SettingsAccessibilityRounded />, path: "/lab/radiology" },
    { text: "Lab Catalog", icon: <MenuBookRounded />, path: "/lab/catalog" },
    { text: "Radiology Catalog", icon: <MenuBookRounded />, path: "/lab/radiology-catalog" },
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
      <Toolbar sx={{ px: 2, display: "flex", alignItems: "center", gap: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: hospital?.logoUrl ? "transparent" : "primary.main", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {hospital?.logoUrl ? <img src={assetUrl(hospital.logoUrl)} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <LocalHospitalRounded fontSize="medium" sx={{ color: "#fff" }} />}
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight="700" noWrap sx={{ maxWidth: 180 }}>
            {hospital?.name || "Lab Portal"}
          </Typography>
        </Box>
      </Toolbar>
      
      <List sx={{ px: 2, pt: 2, flex: 1, overflowY: "auto" }}>
        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                sx={{ borderRadius: 2, bgcolor: isActive ? "rgba(16, 185, 129, 0.08)" : "transparent", "&:hover": { bgcolor: "action.hover" } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isActive ? "#10B981" : "#64748B" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: "0.95rem", fontWeight: isActive ? 600 : 500, color: isActive ? "#10B981" : "#64748B" }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      
      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ListItem disablePadding>
            <ListItemButton onClick={handleMenuOpen} sx={{ borderRadius: 2, "&:hover": { bgcolor: "action.hover" }, px: 1 }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32, fontSize: "0.9rem", mr: 1.5 }}>
                {user?.firstName?.charAt(0) || "U"}
              </Avatar>
              <ListItemText primary={user?.firstName ? `${user.firstName} ${user.lastName || ''}` : "Lab Tech"} primaryTypographyProps={{ fontWeight: 600, fontSize: "0.9rem" }} />
            </ListItemButton>
          </ListItem>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{ elevation: 0, sx: { mt: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" } }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="600">{user?.firstName} {user?.lastName}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{user?.email}</Typography>
              <Typography variant="caption" sx={{ color: "#10b981", mt: 0.5, display: "block", fontWeight: 600 }}>{user?.roleName}</Typography>
            </Box>
            <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1, color: "#f87171" }}>
              <LogoutRounded fontSize="small" /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>
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
        <Outlet />
      </Box>
    </Box>
  );
}
