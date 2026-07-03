/**
 * Per-realm accent colours.
 *
 * Each module (realm) has its own accent so staff can tell at a glance which
 * area of the app they're in — reception is cyan, the doctor workspace is blue,
 * nursing is violet, the super-admin console is indigo. That colour-coding is
 * intentional; what this file fixes is that each accent used to be re-declared
 * as a magic hex constant in ~25 files. Now a realm's colour is defined once.
 */
export const ACCENTS = {
  doctor: "#3b82f6",
  doctorDark: "#2563eb",
  nurse: "#a78bfa",
  nurseDark: "#7c3aed",
  reception: "#0891b2",
  admin: "#6366f1",
} as const;
