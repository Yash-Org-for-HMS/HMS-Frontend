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

// The panel a role belongs to. Anything that isn't a known clinical role (admins
// and custom management roles) belongs to the hospital-admin panel — matching
// the login redirect's default branch.
export function primaryPanelForRole(role?: string | null): Panel {
  return ROLE_PANEL[(role || "").toUpperCase()] ?? "hospital";
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

/**
 * What the app shows a role — which pages it opens, where it lands, what it may
 * do beyond its panel. Decided on the server (backend lib/roleCatalog.ts) and
 * sent with the login and on every load; not repeated here, so the two cannot
 * disagree. pages null: the role's whole panel.
 */
export interface RoleFeatures {
  pages: string[] | null;
  home: string | null;
  actions: string[];
}

export interface HeldRole extends Partial<RoleFeatures> {
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
  /** Each held role's features by code, as the server last sent them (on load). */
  features?: Record<string, RoleFeatures>;
}

/**
 * A role's features: the latest the server sent, else what came with the login.
 * Undefined for a session from before roles had features — treated as the
 * role's whole panel until the next load fills it in.
 */
export function featuresFor(user: RoleHolder | null | undefined, code: string): RoleFeatures | undefined {
  const sent = user?.features?.[code];
  if (sent) return sent;
  const held = user?.roles?.find((r) => r.code === code);
  return held && held.pages !== undefined ? { pages: held.pages ?? null, home: held.home ?? null, actions: held.actions ?? [] } : undefined;
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
  const role = user?.role ?? "";
  return featuresFor(user, role)?.home ?? PANEL_HOME[primaryPanelForRole(role)];
}

export function canUserAccessPanel(user: RoleHolder | null | undefined, panel: Panel): boolean {
  return heldRoles(user).some((r) => canAccessPanel(r, panel));
}

/** Where a login lands in one of its panels: the home of the first role it holds there. */
export function panelHomeForUser(user: RoleHolder | null | undefined, panel: Panel): string {
  const r = heldRoles(user).find((code) => primaryPanelForRole(code) === panel);
  return (r && featuresFor(user, r)?.home) || PANEL_HOME[panel];
}

/**
 * Which menu paths of a panel this login sees, or null for all of them — when
 * any role it holds there sees the whole panel (every original role and admin).
 * The pages come from the server with the role (featuresFor).
 */
export function menuPathsFor(user: RoleHolder | null | undefined, panel: Panel): Set<string> | null {
  if (isAdminUser(user)) return null;
  const here = heldRoles(user).filter((r) => canAccessPanel(r, panel));
  if (!here.length) return null; // the route guard already decided; don't hide what it let in
  const paths = new Set<string>();
  for (const r of here) {
    const pages = featuresFor(user, r)?.pages;
    if (!pages) return null;
    pages.forEach((p) => paths.add(p));
  }
  return paths;
}

/**
 * May this login open this page of the panel? The same rule as the menu, by
 * prefix: a role's page covers the pages under it ("/reception/patients" covers
 * "/reception/patients/:id/edit"). Every role reads its panel's announcements.
 */
export function pageOpenFor(user: RoleHolder | null | undefined, panel: Panel, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (under(`/${panel}/announcements`)) return true;
  const pages = menuPathsFor(user, panel);
  return !pages || [...pages].some(under);
}

/** Does one of the roles this login holds land on this page (its home, from the server)? */
export function holdsHome(user: RoleHolder | null | undefined, path: string): boolean {
  return heldRoles(user).some((r) => featuresFor(user, r)?.home === path);
}

/** May this login do one of the things only some roles may (a role's actions)? Admins may. */
export function hasAction(user: RoleHolder | null | undefined, action: string): boolean {
  if (isAdminUser(user)) return true;
  return heldRoles(user).some((r) => featuresFor(user, r)?.actions.includes(action));
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
