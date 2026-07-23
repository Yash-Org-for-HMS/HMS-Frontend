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
// Each hospital user belongs to exactly one "primary" panel (the one login sends
// them to). The route guard uses this so a user of one panel can't render
// another panel's shell by URL. It is deliberately NEVER stricter than the
// backend: admins bypass everything, a user always reaches their own home panel,
// and CUSTOM roles (which carry permission codes, not a standard roleCode) pass
// via the same permission fallback the API uses — so no legitimate user is
// locked out. The backend still enforces the real data boundary on every call.
export type Panel = "reception" | "nurse" | "doctor" | "lab" | "pharmacy" | "hospital";

// Role codes per clinical panel. Kept in sync with the post-login redirect in
// HospitalAuthContext. Matched case-insensitively.
const PANEL_ROLES: Record<Exclude<Panel, "hospital">, string[]> = {
  reception: ["RECEPTIONIST", "RECEPTION"],
  nurse: ["NURSE"],
  doctor: ["DOCTOR"],
  lab: ["LAB_ADMIN", "LAB_TECH", "LAB"],
  pharmacy: ["PHARMACIST", "PHARMACY"],
};

// Fallback permission codes per panel — mirrors backend middleware/panelAccess.ts
// so a custom role reaches exactly the panels the API already authorizes it for.
const PANEL_PERMISSIONS: Record<Panel, string[]> = {
  reception: ["PATIENT_VIEW", "APPOINTMENT_VIEW"],
  nurse: ["PATIENT_VIEW", "APPOINTMENT_VIEW"],
  doctor: ["CONSULTATION_VIEW", "CONSULTATION_CREATE", "CONSULTATION_EDIT", "PRESCRIPTION_VIEW", "PRESCRIPTION_CREATE", "LAB_ORDER_CREATE"],
  lab: ["LAB_TEST_VIEW", "LAB_ORDER_CREATE", "LAB_RESULT_UPDATE"],
  pharmacy: ["PRESCRIPTION_VIEW", "MEDICINE_DISPENSE"],
  hospital: ["USER_MANAGE", "DEPARTMENT_MANAGE", "ROLE_MANAGE", "SETTINGS_MANAGE"],
};

export const PANEL_HOME: Record<Panel, string> = {
  reception: "/reception/dashboard",
  nurse: "/nurse/dashboard",
  doctor: "/doctor/dashboard",
  lab: "/lab/dashboard",
  pharmacy: "/pharmacy/dashboard",
  hospital: "/hospital/dashboard",
};

// The panel a role belongs to. Anything that isn't a known clinical role (admins
// and custom management roles) belongs to the hospital-admin panel — matching
// the login redirect's default branch.
export function primaryPanelForRole(role?: string | null): Panel {
  const r = (role || "").toUpperCase();
  if (PANEL_ROLES.reception.includes(r)) return "reception";
  if (PANEL_ROLES.nurse.includes(r)) return "nurse";
  if (PANEL_ROLES.doctor.includes(r)) return "doctor";
  if (PANEL_ROLES.lab.includes(r)) return "lab";
  if (PANEL_ROLES.pharmacy.includes(r)) return "pharmacy";
  return "hospital";
}

export function homeForRole(role?: string | null): string {
  return PANEL_HOME[primaryPanelForRole(role)];
}

// May this user render the given panel's routes? True when: they're an admin, OR
// it's their own home panel, OR nurse/reception (which share the backend's
// receptionAccess class), OR they hold one of the panel's fallback permissions.
export function canAccessPanel(role: string | null | undefined, permissions: string[] | null | undefined, panel: Panel): boolean {
  if (isAdmin(role)) return true;
  const home = primaryPanelForRole(role);
  if (home === panel) return true;
  // Nurse and Reception are one trust class on the backend (receptionAccess),
  // so either may enter both panels.
  if ((panel === "reception" || panel === "nurse") && (home === "reception" || home === "nurse")) return true;
  return (PANEL_PERMISSIONS[panel] || []).some((p) => (permissions || []).includes(p));
}
