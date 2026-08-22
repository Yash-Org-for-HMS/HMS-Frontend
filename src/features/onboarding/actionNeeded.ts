/**
 * Which tenants and trials need a human to act, and how many DISTINCT ones.
 *
 * Extracted so two rules can be tested rather than eyeballed:
 *
 *   1. "Expiring soon" needs a lower bound. Without it a trial that lapsed a
 *      month ago — the status flip is a job, so there is a gap — rendered as
 *      "Expires today".
 *   2. The buckets are NOT disjoint: a tenant can be suspended and have an
 *      incomplete profile, so summing their lengths double-counts.
 */

/** Days from now until `date`; negative once it is in the past. */
export function daysUntil(date: string, now: number = Date.now()): number {
  return Math.ceil((new Date(date).getTime() - now) / 86_400_000);
}

export const EXPIRY_WINDOW_DAYS = 7;

export interface TrialLike {
  hospitalTrialId: string;
  trialStatus: string;
  trialEndDate: string;
}

export interface HospitalLike {
  hospitalId: string;
  status: string;
  /** Computed server-side from unpaid subscription invoices. */
  subscriptionState?: string;
  officialPhone?: string | null;
  addressLine1?: string | null;
  registrationNumber?: string | null;
}

export interface ActionBuckets<T extends TrialLike, H extends HospitalLike> {
  expiring: T[];
  expired: T[];
  suspended: H[];
  overdue: H[];
  incomplete: H[];
  /** Distinct trials across the trial buckets. */
  trialCount: number;
  /** Distinct tenants across the tenant buckets — NOT the sum of their lengths. */
  hospitalCount: number;
  /** trialCount + hospitalCount. Zero means genuinely nothing to do. */
  total: number;
}

/** An active trial whose end date has passed but whose status has not flipped. */
function lapsed(t: TrialLike, now: number): boolean {
  return t.trialStatus === "active" && daysUntil(t.trialEndDate, now) < 0;
}

export function actionBuckets<T extends TrialLike, H extends HospitalLike>(
  trials: T[],
  hospitals: H[],
  now: number = Date.now(),
): ActionBuckets<T, H> {
  // Bounded at BOTH ends: still running, and due within the window.
  const expiring = trials
    .filter((t) => {
      if (t.trialStatus !== "active") return false;
      const d = daysUntil(t.trialEndDate, now);
      return d >= 0 && d <= EXPIRY_WINDOW_DAYS;
    })
    .sort((a, b) => daysUntil(a.trialEndDate, now) - daysUntil(b.trialEndDate, now));

  // Lapsed trials join the expired list rather than falling off the page —
  // dropping them would be worse than the mislabelling this replaces.
  const expired = trials
    .filter((t) => t.trialStatus === "expired" || lapsed(t, now))
    .sort((a, b) => daysUntil(b.trialEndDate, now) - daysUntil(a.trialEndDate, now));

  // The DB status column is flipped lazily (at the tenant admin's next login,
  // or by the trial job), so subscriptionState is the truthful signal for a
  // tenant already past its grace window.
  const suspended = hospitals.filter((h) => h.status === "suspended" || h.subscriptionState === "suspended");
  const overdue = hospitals.filter((h) => h.subscriptionState === "overdue" && h.status !== "suspended");
  const incomplete = hospitals.filter(
    (h) => h.status === "active" && (!h.officialPhone || !h.addressLine1 || !h.registrationNumber),
  );

  // Distinct, because the buckets overlap by design.
  const trialIds = new Set([...expiring, ...expired].map((t) => t.hospitalTrialId));
  const hospitalIds = new Set([...suspended, ...overdue, ...incomplete].map((h) => h.hospitalId));

  return {
    expiring, expired, suspended, overdue, incomplete,
    trialCount: trialIds.size,
    hospitalCount: hospitalIds.size,
    total: trialIds.size + hospitalIds.size,
  };
}
