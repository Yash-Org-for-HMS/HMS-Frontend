import { useState, useEffect, useRef } from "react";
import { Dialog, Box, InputBase, Typography, List, ListItemButton, ListItemIcon, ListItemText, Chip } from "@mui/material";
import {
  SearchRounded, DashboardRounded, ScienceRounded, LocalPharmacyRounded, PersonalVideoRounded,
  ArrowForwardRounded, PersonRounded, PersonAddRounded, CalendarMonthRounded, QueueRounded,
  ReceiptLongRounded, AssessmentRounded, LocalHotelRounded, HotelRounded, MedicalServicesRounded,
  ApartmentRounded, CallSplitRounded, BoltRounded,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import HeartbeatLoader from "./HeartbeatLoader";

// Create-flows surfaced as one-tap actions (reception/admin).
const QUICK_ACTIONS = [
  { name: "Register new patient", path: "/reception/patients/new", icon: <PersonAddRounded />, section: "Reception" },
  { name: "Book appointment", path: "/reception/appointments/new", icon: <CalendarMonthRounded />, section: "Reception" },
  { name: "Create / collect a bill", path: "/reception/billing", icon: <ReceiptLongRounded />, section: "Reception" },
  { name: "Admit a patient", path: "/reception/ipd/admissions", icon: <LocalHotelRounded />, section: "Reception", module: "IPD" },
];

const STATIC_ROUTES = [
  { name: "Reception Dashboard", path: "/reception/dashboard", icon: <DashboardRounded />, section: "Reception" },
  { name: "Front Desk Console", path: "/reception/console", icon: <PersonalVideoRounded />, section: "Reception" },
  { name: "All Patients", path: "/reception/patients", icon: <PersonRounded />, section: "Reception" },
  { name: "Appointments", path: "/reception/appointments", icon: <CalendarMonthRounded />, section: "Reception" },
  { name: "Patient Queue", path: "/reception/queue", icon: <QueueRounded />, section: "Reception" },
  { name: "Doctor Availability", path: "/reception/doctors", icon: <MedicalServicesRounded />, section: "Reception" },
  { name: "Department Directory", path: "/reception/directory", icon: <ApartmentRounded />, section: "Reception" },
  { name: "Referrals", path: "/reception/referrals", icon: <CallSplitRounded />, section: "Reception" },
  { name: "Admissions (IPD)", path: "/reception/ipd/admissions", icon: <LocalHotelRounded />, section: "Reception", module: "IPD" },
  { name: "Bed Management", path: "/reception/ipd/beds", icon: <HotelRounded />, section: "Reception", module: "IPD" },
  { name: "Billing", path: "/reception/billing", icon: <ReceiptLongRounded />, section: "Reception" },
  { name: "Reports", path: "/reception/reports", icon: <AssessmentRounded />, section: "Reception" },
  { name: "Lab Dashboard", path: "/lab/dashboard", icon: <ScienceRounded />, section: "Laboratory", module: "Laboratory" },
  { name: "Radiology Queue", path: "/lab/radiology", icon: <ScienceRounded />, section: "Laboratory", module: "Laboratory" },
  { name: "Pharmacy POS", path: "/pharmacy/pos", icon: <LocalPharmacyRounded />, section: "Pharmacy", module: "Pharmacy" },
  { name: "Pharmacy Inventory", path: "/pharmacy/inventory", icon: <LocalPharmacyRounded />, section: "Pharmacy", module: "Pharmacy" },
  { name: "Doctor Dashboard", path: "/doctor/dashboard", icon: <DashboardRounded />, section: "Doctor", module: "Doctor" },
  { name: "My Queue", path: "/doctor/queue", icon: <QueueRounded />, section: "Doctor", module: "Doctor" },
  { name: "My Patients", path: "/doctor/patients", icon: <PersonRounded />, section: "Doctor", module: "Doctor" },
  { name: "Results (Lab / Radiology)", path: "/doctor/results", icon: <ScienceRounded />, section: "Doctor", module: "Doctor" },
  { name: "My Reports", path: "/doctor/reports", icon: <AssessmentRounded />, section: "Doctor", module: "Doctor" },
  { name: "Nurse Dashboard", path: "/nurse/dashboard", icon: <DashboardRounded />, section: "Nurse" },
  { name: "Nurse Patient Queue", path: "/nurse/queue", icon: <QueueRounded />, section: "Nurse" },
  { name: "Nurse Reports", path: "/nurse/reports", icon: <AssessmentRounded />, section: "Nurse" },
  { name: "Hospital Settings", path: "/hospital/settings", icon: <DashboardRounded />, section: "Admin" },
];

// Fallback permission codes per section — mirrors the backend's own panel
// guards (middleware/panelAccess.ts). A custom tenant role (no standard
// roleCode match) still sees the sections it actually has permissions for,
// instead of an empty palette.
const SECTION_PERMISSIONS: Record<string, string[]> = {
  Reception: ["PATIENT_VIEW", "APPOINTMENT_VIEW"],
  Laboratory: ["LAB_TEST_VIEW", "LAB_ORDER_CREATE", "LAB_RESULT_UPDATE"],
  Pharmacy: ["PRESCRIPTION_VIEW", "MEDICINE_DISPENSE"],
  Doctor: ["CONSULTATION_VIEW", "CONSULTATION_CREATE", "PRESCRIPTION_CREATE"],
  Nurse: ["PATIENT_VIEW", "APPOINTMENT_VIEW"],
};

interface PaletteItem {
  key: string;
  path: string;
  name: string;
  icon: React.ReactNode;
  section?: string;
  kind: "action" | "route" | "patient";
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { isModuleEnabled } = useEnabledModules();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: if a slower earlier request
  // resolves after a newer one, its result is stale and must be dropped.
  const searchReqId = useRef(0);
  const itemRefs = useRef<Record<number, HTMLElement | null>>({});

  // Determine if we're in a hospital/clinical route. If not, don't mount the palette at all.
  // Note the trailing slash on `hospital/`: it matches the hospital-admin panel
  // (/hospital/dashboard, …) but NOT the super-admin Organizations list at
  // /hospitals — which would otherwise flip this flag and, combined with the
  // early return below, change the hook count between renders (crash).
  const isClinicalRoute = /^\/(reception|doctor|nurse|lab|pharmacy|hospital\/)/.test(location.pathname);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openEvt = () => setOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", openEvt);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", openEvt);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPatients([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // This component is mounted unconditionally at the top of the hospital tree,
  // so it re-renders on every navigation/state change everywhere in the app —
  // including the super-admin portal and every non-clinical page. Bail out
  // before doing any of the sessionStorage parsing or list filtering below;
  // only the keydown listener above needs to always be alive.
  if (!isClinicalRoute) return null;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSelectedIndex(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    // Only search patients if query is 3+ chars
    if (val.length >= 3) {
      setLoading(true);
      searchTimeout.current = setTimeout(async () => {
        const reqId = ++searchReqId.current;
        try {
          // Extremely lightweight search, limit to 3 results
          const res = await axiosInstance.get("/reception/patients", {
            params: { search: val, page: 1, limit: 3 }
          });
          if (reqId !== searchReqId.current) return; // a newer search already superseded this one
          setPatients(res.data?.data || []);
        } catch (err) {
          if (reqId !== searchReqId.current) return;
          // Fail silently if not authenticated or error
          setPatients([]);
        } finally {
          if (reqId === searchReqId.current) setLoading(false);
        }
      }, 500); // 500ms debounce
    } else {
      searchReqId.current++; // invalidate any in-flight request
      setPatients([]);
      setLoading(false);
    }
  };

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  let userRole = "";
  let permissions: string[] = [];
  try {
    const hospitalUserStr = sessionStorage.getItem("hospitalUser");
    if (hospitalUserStr) {
      const parsed = JSON.parse(hospitalUserStr);
      userRole = parsed.role?.toLowerCase() || "";
      permissions = Array.isArray(parsed.permissions) ? parsed.permissions : [];
    }
  } catch (e) {}

  const isReception = userRole.includes("reception");
  const isLab = userRole.includes("lab");
  const isPharmacy = userRole.includes("pharmac");
  const isDoctor = userRole.includes("doctor");
  const isNurse = userRole.includes("nurse");
  // Role codes are "H_ADMIN" (org admin) / "B_ADMIN" (branch admin) — see
  // middleware/branchContext.ts. Matching literal "admin"/"hospital_admin"
  // never matched a real role, so admins previously saw an empty palette.
  const isAdmin = userRole === "h_admin" || userRole === "b_admin";
  const hasAnyPermission = (codes: string[]) => codes.some((c) => permissions.includes(c));

  const allowSection = (section: string) => {
    if (isAdmin) return true;
    if (section === "Reception") return isReception || hasAnyPermission(SECTION_PERMISSIONS.Reception);
    if (section === "Laboratory") return isLab || hasAnyPermission(SECTION_PERMISSIONS.Laboratory);
    if (section === "Pharmacy") return isPharmacy || hasAnyPermission(SECTION_PERMISSIONS.Pharmacy);
    if (section === "Doctor") return isDoctor || hasAnyPermission(SECTION_PERMISSIONS.Doctor);
    if (section === "Nurse") return isNurse || hasAnyPermission(SECTION_PERMISSIONS.Nurse);
    if (section === "Admin") return isAdmin;
    return true;
  };
  const matches = (name: string, section: string) =>
    name.toLowerCase().includes(search.toLowerCase()) || section.toLowerCase().includes(search.toLowerCase());

  // Skip the filtering passes entirely while the palette is closed — they only
  // matter for what gets rendered in the (unmounted) list below.
  const filteredActions = open ? QUICK_ACTIONS.filter((a) => allowSection(a.section) && isModuleEnabled((a as any).module) && matches(a.name, a.section)) : [];
  const filteredRoutes = open ? STATIC_ROUTES.filter((r) => allowSection(r.section) && isModuleEnabled((r as any).module) && matches(r.name, r.section)) : [];

  // Route to a shell the caller actually owns. Doctors and nurses get their
  // own confined profile view (nurses previously fell through to
  // /reception/patients/:id, which rendered inside the FULL Reception
  // sidebar — letting a nurse click into front desk/billing/admissions
  // screens that aren't theirs). Hospital admins get the read-only oversight
  // profile inside their own shell (/hospital/*) — otherwise a patient hit from
  // the admin panel bounced them into the full Reception panel. Everyone else
  // uses the Reception profile.
  const patientPath = (p: any) =>
    isDoctor ? `/doctor/patients/${p.patientId}` :
    isNurse ? `/nurse/patients/${p.patientId}` :
    isAdmin ? `/hospital/patients/${p.patientId}` :
    `/reception/patients/${p.patientId}`;

  // Single flat, ordered list mirroring what's rendered below — drives
  // keyboard navigation (arrow keys select by index, Enter activates).
  // NOT a useMemo: this sits after the `if (!isClinicalRoute) return null`
  // early return above, and a hook after a conditional return violates the
  // Rules of Hooks (the crash this file previously hit). A plain const is
  // safe here — the list is tiny and only built while the palette is open.
  const allItems: PaletteItem[] = [
    ...filteredActions.map((a) => ({ key: `action-${a.path}`, path: a.path, name: a.name, icon: a.icon, section: a.section, kind: "action" as const })),
    ...filteredRoutes.map((r) => ({ key: `route-${r.path}`, path: r.path, name: r.name, icon: r.icon, section: r.section, kind: "route" as const })),
    ...patients.map((p) => ({ key: `patient-${p.patientId}`, path: patientPath(p), name: `${p.firstName} ${p.lastName}`, icon: <PersonRounded />, kind: "patient" as const })),
  ];

  const clampedIndex = Math.min(selectedIndex, Math.max(allItems.length - 1, 0));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (allItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(i + 1, allItems.length - 1);
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.max(i - 1, 0);
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[clampedIndex];
      if (item) handleSelect(item.path);
    }
  };

  let renderIndex = -1;

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
          onKeyDown={handleKeyDown}
          sx={{ fontSize: "1.1rem", color: "text.primary" }}
        />
        {loading && <HeartbeatLoader size={22} />}
        <Chip label="ESC" size="small" sx={{ ml: 2, borderRadius: 1, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" }} />
      </Box>

      <List sx={{ p: 1, maxHeight: "60vh", overflowY: "auto" }}>
        {search.length > 0 && filteredActions.length === 0 && filteredRoutes.length === 0 && patients.length === 0 && !loading && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No results found for "{search}"</Typography>
          </Box>
        )}

        {filteredActions.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, color: "text.secondary", display: "block", lineHeight: 1 }}>
              Quick Actions
            </Typography>
            {filteredActions.map((action) => {
              renderIndex++;
              const isSelected = renderIndex === clampedIndex;
              return (
                <ListItemButton
                  key={action.path}
                  ref={(el) => { itemRefs.current[renderIndex] = el; }}
                  selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(renderIndex)}
                  onClick={() => handleSelect(action.path)}
                  sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(245,158,11,0.1)" }, "&.Mui-selected": { bgcolor: "rgba(245,158,11,0.16)" }, "&.Mui-selected:hover": { bgcolor: "rgba(245,158,11,0.2)" } }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "#f59e0b" }}>{action.icon}</ListItemIcon>
                  <ListItemText primary={action.name} primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }} />
                  <BoltRounded sx={{ color: "#f59e0b", opacity: 0.6, fontSize: "1.1rem" }} />
                </ListItemButton>
              );
            })}
          </>
        )}

        {filteredRoutes.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, color: "text.secondary", display: "block", lineHeight: 1 }}>
              Quick Navigation
            </Typography>
            {filteredRoutes.map((route) => {
              renderIndex++;
              const isSelected = renderIndex === clampedIndex;
              return (
                <ListItemButton
                  key={route.path}
                  ref={(el) => { itemRefs.current[renderIndex] = el; }}
                  selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(renderIndex)}
                  onClick={() => handleSelect(route.path)}
                  sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" }, "&.Mui-selected": { bgcolor: "rgba(6, 182, 212, 0.14)" }, "&.Mui-selected:hover": { bgcolor: "rgba(6, 182, 212, 0.18)" } }}
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
              );
            })}
          </>
        )}

        {patients.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, mt: 1, color: "text.secondary", display: "block", borderTop: "1px solid", borderColor: "divider", lineHeight: 1 }}>
              Patients
            </Typography>
            {patients.map((p) => {
              renderIndex++;
              const isSelected = renderIndex === clampedIndex;
              const routePath = patientPath(p);
              const idx = renderIndex;
              return (
                <ListItemButton
                  key={p.patientId}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelect(routePath)}
                  sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" }, "&.Mui-selected": { bgcolor: "rgba(6, 182, 212, 0.14)" }, "&.Mui-selected:hover": { bgcolor: "rgba(6, 182, 212, 0.18)" } }}
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
