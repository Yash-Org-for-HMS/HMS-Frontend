import { useState, useEffect, useRef } from "react";
import { Dialog, Box, InputBase, Typography, List, ListItemButton, ListItemIcon, ListItemText, Chip } from "@mui/material";
import {
  SearchRounded, DashboardRounded, ApartmentRounded, WorkspacePremiumRounded, ReceiptLongRounded,
  TrendingUpRounded, ScienceRounded, RocketLaunchRounded, BadgeRounded, GroupRounded, AssessmentRounded,
  HistoryRounded, ArrowForwardRounded,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";

// Super-admin console destinations. NAVIGATION ONLY — this palette never calls
// an API or searches any records, so it exposes no patient or tenant data
// (patient search lives strictly in the hospital-realm CommandPalette). It just
// mirrors the admin sidebar for keyboard-driven navigation.
const ADMIN_ROUTES = [
  { name: "Dashboard", path: "/", icon: <DashboardRounded /> },
  { name: "Organizations (Hospitals)", path: "/hospitals", icon: <ApartmentRounded /> },
  { name: "Plans", path: "/plans", icon: <WorkspacePremiumRounded /> },
  { name: "Subscription Billing", path: "/subscription-billing", icon: <ReceiptLongRounded /> },
  { name: "Leads", path: "/leads", icon: <TrendingUpRounded /> },
  { name: "Trials", path: "/trials", icon: <ScienceRounded /> },
  { name: "Onboarding", path: "/onboarding", icon: <RocketLaunchRounded /> },
  { name: "Super Admins", path: "/super-admins", icon: <BadgeRounded /> },
  { name: "Roles", path: "/rbac/roles", icon: <BadgeRounded /> },
  { name: "Users", path: "/rbac/users", icon: <GroupRounded /> },
  { name: "Reports", path: "/reports", icon: <AssessmentRounded /> },
  { name: "Audit Logs", path: "/audit-logs", icon: <HistoryRounded /> },
];

export default function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const itemRefs = useRef<Record<number, HTMLElement | null>>({});

  // Active only on the super-admin console. Excludes the hospital realm (owned
  // by CommandPalette) and login pages. The keydown listener stays alive (hooks
  // must run every render); the render bails below on non-admin routes.
  const isClinicalRoute = /^\/(reception|doctor|nurse|lab|pharmacy|hospital\/)/.test(location.pathname);
  const isAuthRoute = location.pathname === "/login" || location.pathname.startsWith("/hospital/login");
  const active = !isClinicalRoute && !isAuthRoute;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setOpen((p) => !p); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-command-palette", onOpen); };
  }, []);

  useEffect(() => { if (!open) { setSearch(""); setSelectedIndex(0); } }, [open]);

  if (!active) return null;

  const items = ADMIN_ROUTES.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const clamped = Math.min(selectedIndex, Math.max(items.length - 1, 0));
  const go = (path: string) => { navigate(path); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => { const n = Math.min(i + 1, items.length - 1); itemRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n; }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => { const n = Math.max(i - 1, 0); itemRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n; }); }
    else if (e.key === "Enter") { e.preventDefault(); const it = items[clamped]; if (it) go(it.path); }
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", bgcolor: "background.paper", backgroundImage: "none", mt: "10vh", alignSelf: "flex-start" } }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <SearchRounded sx={{ color: "text.secondary", mr: 2 }} />
        <InputBase autoFocus fullWidth placeholder="Jump to… (e.g. Hospitals, Plans, Leads)" value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }} onKeyDown={onKeyDown}
          sx={{ fontSize: "1.1rem", color: "text.primary" }} />
        <Chip label="ESC" size="small" sx={{ ml: 2, borderRadius: 1, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" }} />
      </Box>
      <List sx={{ p: 1, maxHeight: "60vh", overflowY: "auto" }}>
        {items.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}><Typography variant="body2">No results for "{search}"</Typography></Box>
        )}
        {items.map((route, i) => (
          <ListItemButton key={route.path} ref={(el) => { itemRefs.current[i] = el; }} selected={i === clamped}
            onMouseEnter={() => setSelectedIndex(i)} onClick={() => go(route.path)}
            sx={{ borderRadius: 2, mb: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>{route.icon}</ListItemIcon>
            <ListItemText primary={route.name} primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }} />
            <ArrowForwardRounded sx={{ color: "text.secondary", opacity: 0.5, fontSize: "1.2rem" }} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
