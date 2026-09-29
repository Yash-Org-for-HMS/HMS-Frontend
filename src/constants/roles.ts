// Role codes that count as a hospital "admin" — the org admin (H_ADMIN), branch
// admin (B_ADMIN), and the legacy HOSPITAL_ADMIN alias. Mirrors the backend's
// ADMIN_ROLE_CODES bypass in hospitalAuth.jwt.ts, so the client shows admins the
// same tabs the API already authorizes them for. Centralized here because the
// set was previously copy-pasted across HospitalLayout and ReportsHub.
export const ADMIN_ROLE_CODES = ["H_ADMIN", "B_ADMIN", "HOSPITAL_ADMIN"] as const;

export function isAdmin(role?: string | null): boolean {
  return !!role && (ADMIN_ROLE_CODES as readonly string[]).includes(role);
}

// ── Panel access (frontend mirror of backend middleware/panelAccess.ts) ──────
//
// Each role opens one panel (the backend's lib/roleCatalog.ts ROLE_DEFS is the
// source; this mirrors it). A login holds its primary role and may hold more
// (HMS_Platform_Master_Data.xlsx 15_System_Roles), so it can open every panel
// its roles open and switches between them from the sidebar. The route guard
// is deliberately NEVER stricter than the backend: admins bypass everything and
// a user always reaches their own home panel. The backend still enforces the
// real data boundary — including what the workbook's newer roles may change.
export type Panel = "reception" | "nurse" | "doctor" | "lab" | "pharmacy" | "housekeeping" | "hospital";

/** The panel each role opens. Codes not listed (admins, anything unknown) are the hospital panel. */
const ROLE_PANEL: Record<string, Exclude<Panel, "hospital">> = {
  RECEPTIONIST: "reception", RECEPTION: "reception",
  ADMISSION_DESK: "reception", BILLING: "reception", TPA_DESK: "reception", MRD: "reception",
  NURSE: "nurse", NURSE_INCHARGE: "nurse", NURSING_ADMIN: "nurse",
  DOCTOR: "doctor", DOCTOR_RESIDENT: "doctor",
  LAB_ADMIN: "lab", LAB_TECH: "lab", LAB: "lab", RADIOLOGY: "lab",
  PHARMACIST: "pharmacy", PHARMACY: "pharmacy",
  HOUSEKEEPING: "housekeeping",
};

export const PANEL_HOME: Record<Panel, string> = {
  reception: "/reception/dashboard",
  nurse: "/nurse/dashboard",
  doctor: "/doctor/dashboard",
  lab: "/lab/dashboard",
  pharmacy: "/pharmacy/dashboard",
  housekeeping: "/housekeeping/beds",
  hospital: "/hospital/dashboard",
};

export const PANEL_LABEL: Record<Panel, string> = {
  reception: "Reception", nurse: "Nurse", doctor: "Doctor", lab: "Lab", pharmacy: "Pharmacy",
  housekeeping: "Housekeeping", hospital: "Hospital admin",
};

/** Where a role lands inside its panel, when not the panel's dashboard. */
const ROLE_HOME: Record<string, string> = {
  HR_ADMIN: "/hospital/staff",
};

// The panel a role belongs to. Anything that isn't a known clinical role (admins
// and custom management roles) belongs to the hospital-admin panel — matching
// the login redirect's default branch.
export function primaryPanelForRole(role?: string | null): Panel {
  return ROLE_PANEL[(role || "").toUpperCase()] ?? "hospital";
}

export function homeForRole(role?: string | null): string {
  return ROLE_HOME[(role || "").toUpperCase()] ?? PANEL_HOME[primaryPanelForRole(role)];
}

// May this role render the given panel's routes? True when: it's an admin, OR
// it's its own home panel, OR nurse/reception (which share the backend's
// receptionAccess class). Mirrors middleware/panelAccess.ts, which is likewise
// role-only since the permission layer was removed.
export function canAccessPanel(role: string | null | undefined, panel: Panel): boolean {
  if (isAdmin(role)) return true;
  const home = primaryPanelForRole(role);
  if (home === panel) return true;
  // Nurse and Reception are one trust class on the backend (receptionAccess),
  // so either may enter both panels. Only the original two: the workbook's desk
  // roles and nursing roles each keep to their own panel.
  const r = (role || "").toUpperCase();
  if ((panel === "reception" || panel === "nurse") && ["RECEPTIONIST", "RECEPTION", "NURSE"].includes(r)) return true;
  return false;
}

// ── Several roles per login ─────────────────────────────────────────────────

export interface HeldRole {
  code: string;
  name: string;
  /** The facility it applies at; null = every facility. */
  branchId: string | null;
  branchName: string | null;
  primary: boolean;
}

export interface RoleHolder {
  role: string;
  roles?: HeldRole[];
}

/** Every role the login holds (primary first). A session from before roles could be several has only `role`. */
export function heldRoles(user: RoleHolder | null | undefined): string[] {
  if (!user) return [];
  const codes = (user.roles ?? []).map((r) => r.code);
  return codes.includes(user.role) ? codes : [user.role, ...codes];
}

export function hasRole(user: RoleHolder | null | undefined, ...codes: string[]): boolean {
  return heldRoles(user).some((r) => codes.includes(r));
}

export function isAdminUser(user: RoleHolder | null | undefined): boolean {
  return heldRoles(user).some((r) => isAdmin(r));
}

/** The panels this login can open, its primary role's first. */
export function panelsForUser(user: RoleHolder | null | undefined): Panel[] {
  const out: Panel[] = [];
  for (const r of heldRoles(user)) {
    const p = primaryPanelForRole(r);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function homeForUser(user: RoleHolder | null | undefined): string {
  return homeForRole(user?.role);
}

export function canUserAccessPanel(user: RoleHolder | null | undefined, panel: Panel): boolean {
  return heldRoles(user).some((r) => canAccessPanel(r, panel));
}

/** Where a login lands in one of its panels: the home of the first role it holds there. */
export function panelHomeForUser(user: RoleHolder | null | undefined, panel: Panel): string {
  const r = heldRoles(user).find((code) => primaryPanelForRole(code) === panel);
  return r ? homeForRole(r) : PANEL_HOME[panel];
}

/**
 * The part of a shared panel each of the workbook's roles works in, by menu
 * path. The API holds them to it (backend lib/roleCatalog.ts writes); the menu
 * shows only that part. A role not listed here sees its whole panel.
 */
const ROLE_MENU: Record<string, string[]> = {
  ADMISSION_DESK: ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/ipd/beds", "/reception/ipd/theatres", "/reception/doctors", "/reception/directory", "/reception/notifications"],
  BILLING: ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/billing", "/reception/reports", "/reception/notifications"],
  TPA_DESK: ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/claims", "/reception/notifications"],
  MRD: ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/directory", "/reception/reports"],
  RADIOLOGY: ["/lab/dashboard", "/lab/radiology", "/lab/radiology-catalog", "/lab/billing-history", "/lab/reports"],
  HR_ADMIN: ["/hospital/staff"],
  // View only: the overview, the day-to-day windows and the audit trail.
  AUDITOR: [
    "/hospital/dashboard", "/hospital/financials", "/hospital/gst-report", "/hospital/reports",
    "/hospital/patients", "/hospital/appointments", "/hospital/queue", "/hospital/ipd/admissions",
    "/hospital/ipd/beds", "/hospital/ipd/ot-schedule", "/hospital/billing", "/hospital/audit-logs",
  ],
};

/**
 * Which menu paths of a panel this login sees, or null for all of them — when
 * any role it holds there sees the whole panel (every original role and admin).
 */
export function menuPathsFor(user: RoleHolder | null | undefined, panel: Panel): Set<string> | null {
  if (isAdminUser(user)) return null;
  const here = heldRoles(user).filter((r) => canAccessPanel(r, panel));
  if (!here.length) return null; // the route guard already decided; don't hide what it let in
  const paths = new Set<string>();
  for (const r of here) {
    const list = ROLE_MENU[r.toUpperCase()];
    if (!list) return null;
    list.forEach((p) => paths.add(p));
  }
  return paths;
}

/** What each role is for (backend lib/roleCatalog.ts descriptions, from the workbook). */
export const ROLE_HINT: Record<string, string> = {
  H_ADMIN: "Manages all facilities, settings, masters and users",
  B_ADMIN: "Sets up wards, rooms, beds and staff for their facilities",
  DOCTOR: "Admits, treats, orders and discharges own patients",
  NURSE: "Charting and medication administration",
  RECEPTIONIST: "The whole front office",
  PHARMACIST: "Dispensing, stock, returns",
  LAB_TECH: "Laboratory and radiology",
  HR_ADMIN: "Staff Directory: onboarding, reporting lines, exits",
  DOCTOR_RESIDENT: "Notes, orders and ward rounds (the doctor panel)",
  NURSE_INCHARGE: "Nursing, plus bed status, roster and indents",
  NURSING_ADMIN: "All wards: roster, postings, nursing reports",
  ADMISSION_DESK: "Admissions, bed allocation, reservations, transfers",
  BILLING: "IP / OP bills, deposits, final bill",
  TPA_DESK: "Pre-authorisation and insurance claims",
  RADIOLOGY: "Radiology orders and reports",
  HOUSEKEEPING: "Marks beds cleaned and available",
  MRD: "Patient records, documents, consent forms",
  AUDITOR: "Sees what an admin sees, changes nothing",
};
