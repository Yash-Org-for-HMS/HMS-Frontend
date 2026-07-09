// Role codes that count as a hospital "admin" — the org admin (H_ADMIN), branch
// admin (B_ADMIN), and the legacy HOSPITAL_ADMIN alias. Mirrors the backend's
// ADMIN_ROLE_CODES bypass in hospitalAuth.jwt.ts, so the client shows admins the
// same tabs the API already authorizes them for. Centralized here because the
// set was previously copy-pasted across HospitalLayout and ReportsHub.
export const ADMIN_ROLE_CODES = ["H_ADMIN", "B_ADMIN", "HOSPITAL_ADMIN"] as const;

export function isAdmin(role?: string | null): boolean {
  return !!role && (ADMIN_ROLE_CODES as readonly string[]).includes(role);
}
