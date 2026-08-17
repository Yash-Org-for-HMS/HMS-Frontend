import { useState, useEffect, useRef } from "react";
import { Dialog, Box, InputBase, Typography, List, ListItemButton, ListItemIcon, ListItemText, Chip } from "@mui/material";
import {
  SearchRounded, DashboardRounded, ScienceRounded, LocalPharmacyRounded, PersonalVideoRounded,
  ArrowForwardRounded, PersonRounded, PersonAddRounded, CalendarMonthRounded, QueueRounded,
  ReceiptLongRounded, AssessmentRounded, LocalHotelRounded, HotelRounded, MedicalServicesRounded,
  ApartmentRounded, CallSplitRounded, BoltRounded, HistoryRounded,
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
  { name: "Referred Patients", path: "/reception/referrals", icon: <CallSplitRounded />, section: "Reception" },
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
  // Admin section — all within the hospital-admin shell (/hospital/*). Admins
  // are shown ONLY these (see allowSection): the palette must not route them into
  // the full Reception/Doctor/etc. panels, and the read-only Operations pages
  // below are their in-shell equivalents.
  { name: "Admin Dashboard", path: "/hospital/dashboard", icon: <DashboardRounded />, section: "Admin" },
  { name: "All Patients", path: "/hospital/patients", icon: <PersonRounded />, section: "Admin" },
  { name: "Appointments", path: "/hospital/appointments", icon: <CalendarMonthRounded />, section: "Admin" },
  { name: "Patient Queue", path: "/hospital/queue", icon: <QueueRounded />, section: "Admin" },
  { name: "Admissions", path: "/hospital/ipd/admissions", icon: <LocalHotelRounded />, section: "Admin", module: "IPD" },
  { name: "Bed Board", path: "/hospital/ipd/beds", icon: <HotelRounded />, section: "Admin", module: "IPD" },
  { name: "Billing Overview", path: "/hospital/billing", icon: <ReceiptLongRounded />, section: "Admin", module: "Billing" },
  { name: "Reports", path: "/hospital/reports", icon: <AssessmentRounded />, section: "Admin" },
  { name: "Staff & Users", path: "/hospital/users", icon: <PersonRounded />, section: "Admin" },
  { name: "Departments", path: "/hospital/departments", icon: <ApartmentRounded />, section: "Admin" },
  { name: "Doctors", path: "/hospital/doctors", icon: <MedicalServicesRounded />, section: "Admin" },
  { name: "Hospital Settings", path: "/hospital/settings", icon: <DashboardRounded />, section: "Admin" },
];

// Everyday aliases so common terms find the right destination (keyed by path so
// the route lists above stay clean). e.g. "pos" → Pharmacy POS, "xray" → Radiology.
const ALIASES: Record<string, string[]> = {
  "/reception/dashboard": ["opd", "front desk", "reception"],
  "/reception/patients/new": ["opd", "new patient", "register", "signup", "add patient"],
  "/reception/appointments/new": ["opd", "appt", "booking", "schedule", "new appointment"],
  "/reception/queue": ["opd", "waiting", "token"],
  "/reception/billing": ["bill", "invoice", "payment", "collect", "cashier"],
  "/reception/ipd/admissions": ["admit", "ipd", "inpatient", "admission"],
  "/reception/ipd/beds": ["bed", "ward", "occupancy"],
  "/reception/reports": ["report", "analytics", "mis"],
  "/hospital/billing": ["bill", "invoice", "payment", "collect"],
  "/hospital/ipd/admissions": ["admit", "ipd", "inpatient", "admission"],
  "/hospital/ipd/beds": ["bed", "ward", "occupancy", "bed board"],
  "/hospital/reports": ["report", "analytics", "mis"],
  "/hospital/users": ["staff", "users", "employees"],
  "/lab/dashboard": ["lab", "pathology", "test", "sample"],
  "/lab/radiology": ["xray", "x-ray", "scan", "ct", "mri", "imaging", "radiology"],
  "/pharmacy/pos": ["pos", "dispense", "sell", "counter", "medicine"],
  "/pharmacy/inventory": ["stock", "medicine", "drug", "inventory"],
  "/doctor/results": ["results", "lab", "radiology", "reports"],
};

// Fuzzy scorer: exact > prefix > substring > subsequence; higher wins, 0 = no match.
function fieldScore(q: string, t: string): number {
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  const idx = t.indexOf(q);
  if (idx >= 0) return 70 - Math.min(idx, 40);
  // Subsequence: every query char appears in order (typos/skips tolerated).
  let ti = 0, qi = 0, gaps = 0, started = false;
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) { qi++; started = true; }
    else if (started) gaps++;
    ti++;
  }
  return qi === q.length ? Math.max(1, 28 - gaps) : 0;
}
function scoreItem(name: string, section: string, keywords: string[], q: string): number {
  if (!q) return 1;
  let best = fieldScore(q, name);
  for (const k of keywords) best = Math.max(best, fieldScore(q, k.toLowerCase()) * 0.92);
  if (section && section.toLowerCase().includes(q)) best = Math.max(best, 18);
  return best;
}

// Path → route metadata, for rehydrating a saved "recent" item's icon/label.
const ROUTE_INDEX = new Map<string, { name: string; icon: React.ReactNode; section?: string; module?: string }>(
  [...STATIC_ROUTES, ...QUICK_ACTIONS].map((r) => [r.path, r as any]),
);

// Recently-opened items (per browser) so the palette opens onto your last picks.
type RecentEntry = { kind: "route" | "patient"; path?: string; patientId?: string; name: string };
const RECENTS_KEY = "cmdk-recents";
function loadRecents(): RecentEntry[] {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function pushRecent(e: RecentEntry) {
  const id = (r: RecentEntry) => (r.kind === "patient" ? `p:${r.patientId}` : r.path);
  const cur = loadRecents().filter((r) => id(r) !== id(e));
  cur.unshift(e);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 6))); } catch { /* quota / private mode */ }
}

interface PaletteItem {
  key: string;
  path: string;
  name: string;
  icon: React.ReactNode;
  section?: string;
  kind: "action" | "route" | "patient" | "recent";
  recent?: RecentEntry;
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
  // The hospital login + forced change-password pages match the `hospital/`
  // prefix above but are PRE-app: no real session yet (change-password holds
  // only a temp token), so the palette must not open there — it would pop an
  // empty dialog and, worse, offer a navigation escape from the password gate
  // if a stale session lingered. Mirrors AdminCommandPalette's auth-route guard.
  const isAuthRoute = location.pathname === "/hospital/login" || location.pathname.startsWith("/hospital/change-password");

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
  if (!isClinicalRoute || isAuthRoute) return null;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSelectedIndex(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    // Only search patients if the caller's panel owns a patient view, and the
    // query is 3+ chars. Lab/Pharmacy have no patient-profile destination, so
    // they get no patient results — which also stops a patient hit from routing
    // them into the Reception panel. Mirrors the backend, which gates
    // /reception/patients behind receptionAccess (RECEPTIONIST/NURSE + admin +
    // PATIENT_VIEW/APPOINTMENT_VIEW).
    if (canSearchPatients && val.length >= 3) {
      setLoading(true);
      searchTimeout.current = setTimeout(async () => {
        const reqId = ++searchReqId.current;
        try {
          // Extremely lightweight search, limit to 3 results
          const res = await axiosInstance.get("/reception/patients", {
            params: { search: val, page: 1, limit: 6 }
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

  const handleSelect = (path: string, recent?: RecentEntry) => {
    if (recent) pushRecent(recent);
    navigate(path);
    setOpen(false);
  };

  let userRole = "";
  try {
    const hospitalUserStr = sessionStorage.getItem("hospitalUser");
    if (hospitalUserStr) {
      userRole = JSON.parse(hospitalUserStr).role?.toLowerCase() || "";
    }
  } catch (e) { /* no readable session — the palette simply shows nothing */ }

  const isReception = userRole.includes("reception");
  const isLab = userRole.includes("lab");
  const isPharmacy = userRole.includes("pharmac");
  const isDoctor = userRole.includes("doctor");
  const isNurse = userRole.includes("nurse");
  // Role codes are "H_ADMIN" (org admin) / "B_ADMIN" (branch admin) — see
  // middleware/branchContext.ts. Matching literal "admin"/"hospital_admin"
  // never matched a real role, so admins previously saw an empty palette.
  const isAdmin = userRole === "h_admin" || userRole === "b_admin";

  // Who may search patient PII from the palette. Only panels with a real
  // patient-profile destination (reception, nurse→reception, doctor, admin→
  // hospital oversight). Lab/Pharmacy are deliberately excluded — see the guard
  // in handleSearchChange.
  const canSearchPatients = isReception || isNurse || isDoctor || isAdmin;

  const allowSection = (section: string) => {
    // Admins operate from their own shell. Surface ONLY the Admin section (which
    // points at /hospital/*), never the other panels' shortcuts — clicking those
    // would drop the admin into the full Reception/Doctor/etc. panels. Patient
    // search is separate and already routes admins to /hospital.
    if (isAdmin) return section === "Admin";
    if (section === "Reception") return isReception;
    if (section === "Laboratory") return isLab;
    if (section === "Pharmacy") return isPharmacy;
    if (section === "Doctor") return isDoctor;
    if (section === "Nurse") return isNurse;
    if (section === "Admin") return isAdmin;
    return true;
  };
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

  // Fuzzy-rank a route/action list against the query, keeping only what the
  // caller may see (role/section + module gating unchanged). Empty query keeps
  // everything (menu mode), scored 1 so the source order is preserved.
  const q = search.trim().toLowerCase();
  const rank = <T extends { name: string; path: string; section?: string; module?: string }>(list: T[]): T[] =>
    list
      .filter((it) => allowSection(it.section || "") && isModuleEnabled(it.module))
      .map((it) => ({ it, s: scoreItem(it.name.toLowerCase(), it.section || "", ALIASES[it.path] || [], q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);

  // Recently-opened items — only when idle (empty query), re-gated in case the
  // role/modules changed since they were saved, and re-pathed for the caller.
  const recentItems: PaletteItem[] = (open && q === "" ? loadRecents() : [])
    .map((r): PaletteItem | null => {
      if (r.kind === "patient") {
        if (!canSearchPatients || !r.patientId) return null;
        return { key: `recent-p-${r.patientId}`, path: patientPath({ patientId: r.patientId }), name: r.name, icon: <PersonRounded />, kind: "recent", recent: r };
      }
      const meta = r.path ? ROUTE_INDEX.get(r.path) : undefined;
      if (!meta || !allowSection(meta.section || "") || !isModuleEnabled(meta.module)) return null;
      return { key: `recent-r-${r.path}`, path: r.path!, name: meta.name, icon: meta.icon, section: meta.section, kind: "recent", recent: r };
    })
    .filter((x): x is PaletteItem => x !== null)
    .slice(0, 6);
  const recentPaths = new Set(recentItems.map((i) => i.path));

  // Skip the filtering passes entirely while the palette is closed. When idle,
  // hide items already surfaced in Recent to avoid duplicates.
  const filteredActions = open ? rank(QUICK_ACTIONS).filter((a) => !(q === "" && recentPaths.has(a.path))) : [];
  const filteredRoutes = open ? rank(STATIC_ROUTES).filter((r) => !(q === "" && recentPaths.has(r.path))) : [];

  // Single flat, ordered list mirroring what's rendered below — drives
  // keyboard navigation (arrow keys select by index, Enter activates).
  // NOT a useMemo: this sits after the `if (!isClinicalRoute) return null`
  // early return above, and a hook after a conditional return violates the
  // Rules of Hooks (the crash this file previously hit). A plain const is
  // safe here — the list is tiny and only built while the palette is open.
  const allItems: PaletteItem[] = [
    ...recentItems,
    ...filteredActions.map((a) => ({ key: `action-${a.path}`, path: a.path, name: a.name, icon: a.icon, section: a.section, kind: "action" as const, recent: { kind: "route" as const, path: a.path, name: a.name } })),
    ...filteredRoutes.map((r) => ({ key: `route-${r.path}`, path: r.path, name: r.name, icon: r.icon, section: r.section, kind: "route" as const, recent: { kind: "route" as const, path: r.path, name: r.name } })),
    ...patients.map((p) => ({ key: `patient-${p.patientId}`, path: patientPath(p), name: `${p.firstName} ${p.lastName}`, icon: <PersonRounded />, kind: "patient" as const, recent: { kind: "patient" as const, patientId: p.patientId, name: `${p.firstName} ${p.lastName}` } })),
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
      if (item) handleSelect(item.path, item.recent);
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
          placeholder="Search patients or jump anywhere… (e.g. POS, admit, x-ray, bill)"
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

        {recentItems.length > 0 && (
          <>
            <Typography variant="overline" sx={{ px: 2, py: 1, color: "text.secondary", display: "block", lineHeight: 1 }}>
              Recent
            </Typography>
            {recentItems.map((item) => {
              renderIndex++;
              const isSelected = renderIndex === clampedIndex;
              return (
                <ListItemButton
                  key={item.key}
                  ref={(el) => { itemRefs.current[renderIndex] = el; }}
                  selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(renderIndex)}
                  onClick={() => handleSelect(item.path, item.recent)}
                  sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" }, "&.Mui-selected": { bgcolor: "rgba(6, 182, 212, 0.14)" }, "&.Mui-selected:hover": { bgcolor: "rgba(6, 182, 212, 0.18)" } }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.name} secondary={item.section} primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }} secondaryTypographyProps={{ fontSize: "0.75rem" }} />
                  <HistoryRounded sx={{ color: "text.secondary", opacity: 0.45, fontSize: "1.1rem" }} />
                </ListItemButton>
              );
            })}
          </>
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
                  onClick={() => handleSelect(action.path, { kind: "route", path: action.path, name: action.name })}
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
                  onClick={() => handleSelect(route.path, { kind: "route", path: route.path, name: route.name })}
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
                  onClick={() => handleSelect(routePath, { kind: "patient", patientId: p.patientId, name: `${p.firstName} ${p.lastName}` })}
                  sx={{ borderRadius: 2, mb: 0.5, "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" }, "&.Mui-selected": { bgcolor: "rgba(6, 182, 212, 0.14)" }, "&.Mui-selected:hover": { bgcolor: "rgba(6, 182, 212, 0.18)" } }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "#06b6d4" }}><PersonRounded /></ListItemIcon>
                  <ListItemText
                    primary={`${p.firstName} ${p.lastName}`}
                    secondary={`MRN: ${p.uhidNumber || "—"}${p.phone ? ` • ${p.phone}` : ""}`}
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
