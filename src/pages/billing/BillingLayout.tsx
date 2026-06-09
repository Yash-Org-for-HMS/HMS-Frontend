import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Box, Paper, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { ReceiptLongRounded, PaymentRounded, HistoryRounded } from "@mui/icons-material";

export default function BillingLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Generate Invoice", icon: <ReceiptLongRounded />, path: "/billing" },
    { text: "Payment History", icon: <HistoryRounded />, path: "/billing/history" },
  ];

  return (
    <Box sx={{ display: "flex", gap: 3, height: "100%" }}>
      {/* Sidebar Navigation */}
      <Paper sx={{ width: 280, flexShrink: 0, borderRadius: 3, overflow: "hidden", display: { xs: "none", md: "block" } }}>
        <Box sx={{ p: 3, bgcolor: "primary.main", color: "white" }}>
          <Typography variant="h6" fontWeight="700" display="flex" alignItems="center" gap={1}>
            <PaymentRounded /> Billing
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Cashier & Invoicing
          </Typography>
        </Box>
        <List sx={{ p: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root": { color: "inherit" },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? "inherit" : "text.secondary" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
