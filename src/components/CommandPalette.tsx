import { useState, useEffect, useRef } from "react";
import { Dialog, Box, InputBase, Typography, List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Chip } from "@mui/material";
import { SearchRounded, DashboardRounded, ScienceRounded, LocalPharmacyRounded, PersonalVideoRounded, ArrowForwardRounded, PersonRounded } from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { axiosInstance } from "../api/axios";

const STATIC_ROUTES = [
  { name: "Front Desk Console", path: "/reception/console", icon: <PersonalVideoRounded />, section: "Reception" },
  { name: "Patient Registry", path: "/reception/patients", icon: <PersonRounded />, section: "Reception" },
  { name: "Lab Dashboard", path: "/lab/dashboard", icon: <ScienceRounded />, section: "Laboratory" },
  { name: "Radiology Queue", path: "/lab/radiology", icon: <ScienceRounded />, section: "Laboratory" },
  { name: "Pharmacy POS", path: "/pharmacy/pos", icon: <LocalPharmacyRounded />, section: "Pharmacy" },
  { name: "Pharmacy Inventory", path: "/pharmacy/inventory", icon: <LocalPharmacyRounded />, section: "Pharmacy" },
  { name: "Doctor Dashboard", path: "/doctor/dashboard", icon: <DashboardRounded />, section: "Doctor" },
  { name: "Hospital Settings", path: "/hospital/settings", icon: <DashboardRounded />, section: "Admin" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we're in a hospital/clinical route. If not, don't mount the palette at all.
  const isClinicalRoute = /^\/(reception|doctor|nurse|lab|pharmacy|hospital)/.test(location.pathname);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPatients([]);
    }
  }, [open]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    // Only search patients if query is 3+ chars
    if (val.length >= 3) {
      setLoading(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          // Extremely lightweight search, limit to 3 results
          const res = await axiosInstance.get("/reception/patients", {
            params: { search: val, page: 1, limit: 3 }
          });
          setPatients(res.data?.data || []);
        } catch (err) {
          // Fail silently if not authenticated or error
          setPatients([]);
        } finally {
          setLoading(false);
        }
      }, 500); // 500ms debounce
    } else {
      setPatients([]);
      setLoading(false);
    }
  };

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  let userRole = "";
  try {
    const hospitalUserStr = sessionStorage.getItem("hospitalUser");
    if (hospitalUserStr) {
      userRole = JSON.parse(hospitalUserStr).role?.toLowerCase() || "";
    }
  } catch (e) {}

  const isReception = userRole.includes("reception");
  const isLab = userRole.includes("lab");
  const isPharmacy = userRole.includes("pharmac");
  const isDoctor = userRole.includes("doctor");
  const isNurse = userRole.includes("nurse");
  const isAdmin = userRole === "admin" || userRole === "hospital_admin";

  const filteredRoutes = STATIC_ROUTES.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.section.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (isAdmin) return true;
    if (r.section === "Reception" && !isReception) return false;
    if (r.section === "Laboratory" && !isLab) return false;
    if (r.section === "Pharmacy" && !isPharmacy) return false;
    if (r.section === "Doctor" && !isDoctor) return false;
    if (r.section === "Admin" && !isAdmin) return false;

    return true;
  });

  if (!isClinicalRoute) return null;

  return (
    <Dialog 
      open={open} 
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          bgcolor: "background.paper",
          backgroundImage: "none",
          mt: "10vh",
          verticalAlign: "top",
          alignSelf: "flex-start"
        }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <SearchRounded sx={{ color: "text.secondary", mr: 2 }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search patients, jump to modules... (e.g. Lab, POS)"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          sx={{ fontSize: "1.1rem", color: "text.primary" }}
        />
        {loading && <CircularProgress size={20} sx={{ color: "#06b6d4" }} />}
        <Chip label="ESC" size="small" sx={{ ml: 2, borderRadius: 1, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" }} />
      </Box>

      <List sx={{ p: 1, maxHeight: "60vh", overflowY: "auto" }}>
        {search.length > 0 && filteredRoutes.length === 0 && patients.length === 0 && !loading && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No results found for "{search}"</Typography>
          </Box>
        )}

        {filteredRoutes.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, color: "text.secondary", display: "block", lineHeight: 1 }}>
              Quick Navigation
            </Typography>
            {filteredRoutes.map((route) => (
              <ListItemButton 
                key={route.path}
                onClick={() => handleSelect(route.path)}
                sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: "#0891b2" }}>{route.icon}</ListItemIcon>
                <ListItemText 
                  primary={route.name} 
                  secondary={route.section}
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }} 
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
                <ArrowForwardRounded sx={{ color: "text.secondary", opacity: 0.5, fontSize: "1.2rem" }} />
              </ListItemButton>
            ))}
          </>
        )}

        {patients.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, mt: 1, color: "text.secondary", display: "block", borderTop: "1px solid", borderColor: "divider", lineHeight: 1 }}>
              Patients
            </Typography>
            {patients.map((p) => {
              const routePath = isDoctor ? `/doctor/patients/${p.patientId}` : 
                                isNurse ? `/nurse/patients/${p.patientId}` : 
                                `/reception/patients/${p.patientId}`;
              return (
              <ListItemButton 
                key={p.patientId}
                onClick={() => handleSelect(routePath)}
                sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: "#06b6d4" }}><PersonRounded /></ListItemIcon>
                <ListItemText 
                  primary={`${p.firstName} ${p.lastName}`} 
                  secondary={`MRN: ${p.uhidNumber} • ${p.phone}`}
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                />
              </ListItemButton>
              );
            })}
          </>
        )}
      </List>
    </Dialog>
  );
}
