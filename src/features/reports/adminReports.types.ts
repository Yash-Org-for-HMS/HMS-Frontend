import type { Money } from "@/types";

/**
 * Row shapes for the platform (super-admin) registers.
 *
 * These endpoints return whole records rather than report projections, so each
 * interface here covers the fields this screen actually reads — not the full
 * entity. Anything else stays off the type deliberately: a register that starts
 * claiming to describe the whole record is one that goes stale silently.
 */

/** A `_count` block as the list endpoints attach it. */
export interface WithBranchCount {
  _count?: { branches?: number } | null;
}

export interface HospitalRegisterRow extends WithBranchCount {
  hospitalId?: string;
  hospitalName?: string | null;
  hospitalCode?: string | null;
  /** "active" | "suspended" | ... — lookup data, not a compile-time union. */
  status?: string | null;
  createdAt?: string | null;
  branches?: { subscriptionPlan?: { planName?: string | null } | null }[] | null;
}

export interface LeadRegisterRow {
  leadId?: string;
  hospitalName?: string | null;
  contactPersonName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadStatus: string;
  assignedUser?: { firstName?: string | null; lastName?: string | null } | null;
  createdAt?: string | null;
}

export interface TrialRegisterRow {
  trialId?: string;
  lead?: { hospitalName?: string | null } | null;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialStatus: string;
  autoExpire?: boolean | null;
}

export interface PlanRegisterRow extends WithBranchCount {
  planId?: string;
  planName: string;
  monthlyPrice?: Money | null;
  annualPrice?: Money | null;
  maxDoctors?: number | null;
  maxBranches?: number | null;
  maxStorageGb?: number | null;
}

/** A plan row with the derived subscription figures the table shows. */
export interface PlanWithMrr extends PlanRegisterRow {
  branches: number;
  /** monthlyPrice x subscribed branches — the same basis as the dashboard. */
  mrr: number;
}

/**
 * An onboarding record. The gate booleans drive the "blocked on" column, and
 * the three payment flags are distinct states, not one tri-state: verified,
 * mismatched (paid amount disagrees), and paid-but-unverified all need
 * different handling.
 */
export interface OnboardingRegisterRow {
  hospitalOnboardingId?: string;
  onboardingStatus: string;
  hospital?: {
    hospitalName?: string | null;
    hospitalCode?: string | null;
    city?: string | null;
    planName?: string | null;
    createdAt?: string | null;
  } | null;
  primaryAdmin?: { name?: string | null; email?: string | null } | null;
  /** The whole billing block onboarding.service.ts attaches per hospital. */
  billing?: {
    totalPaid?: Money | null;
    paymentsCount?: number;
    lastPaymentAt?: string | null;
    lastPaymentMethod?: string | null;
    latestInvoiceStatus?: string | null;
    latestInvoiceAmount?: number | null;
    latestInvoiceDueDate?: string | null;
    /** UNPAID and past its due date — the only field that means chase them. */
    latestInvoiceOverdue?: boolean;
  } | null;
  tenantSetupCompleted?: boolean | null;
  defaultRolesSeeded?: boolean | null;
  paymentVerified?: boolean | null;
  paymentMismatch?: boolean | null;
  paymentUnverifiedButPaid?: boolean | null;
}

/** The setup steps a hospital must clear; drives the "blocked on" column. */
export type OnboardingGateKey = "tenantSetupCompleted" | "defaultRolesSeeded" | "paymentVerified";

// ── Platform dashboard ──────────────────────────────────────────────────────

export interface DashboardPlanRow {
  planName?: string;
  count?: number;
}

export interface DashboardStatusRow {
  /** Projected from leadStatus by dashboard.service.ts. */
  status?: string;
  count?: number;
}

export interface DashboardOnboardingRow {
  /** Projected from onboardingStatus by dashboard.service.ts. */
  status?: string;
  count?: number;
}

export interface AdminDashboardStats {
  totalHospitals?: number;
  activeHospitals?: number;
  expiredHospitals?: number;
  totalBranches?: number;
  totalDoctors?: number;
  totalPatients?: number;
  totalLeads?: number;
  convertedLeads?: number;
  activeTrials?: number;
  activePlans?: number;
  totalRevenue?: Money;
  hospitalsByPlan?: DashboardPlanRow[];
  leadsByStatus?: DashboardStatusRow[];
  onboardingProgress?: DashboardOnboardingRow[];
}

/**
 * Where a tenant stands on its subscription right now — derived on the server,
 * never stored, so it cannot go stale the way a status column does.
 *
 * TRIAL      inside a trial; not billed yet, so not overdue either
 * NO_PLAN    live tenant with no plan assigned — nothing to bill
 * AWAITING_FIRST invoiced for the first time, and that invoice is not due yet
 * NOT_INVOICED   on a plan but no invoice has ever been raised
 * PAST_GRACE overdue long enough that access is cut at next login
 * OVERDUE    past a due date, still inside the grace window
 * DUE_SOON   paid, but the paid-for period ends within a fortnight
 * ACTIVE     paid up with room to spare
 */
export type TenantSubscriptionState =
  | "TRIAL" | "NO_PLAN" | "AWAITING_FIRST" | "NOT_INVOICED" | "PAST_GRACE" | "OVERDUE" | "DUE_SOON" | "ACTIVE";

export interface TenantSubscriptionRow {
  hospitalId: string;
  hospitalName: string;
  hospitalCode: string | null;
  hospitalStatus: string;
  customerSince: string;
  planName: string | null;
  billingCycle: "MONTHLY" | "ANNUAL";
  /** What they pay per cycle — a year's price for an annual tenant. */
  price: Money | null;
  /** The same figure per month, so annual and monthly rows compare. */
  monthlyEquivalent: Money | null;
  /** End of the last period actually PAID for. Null = never paid. */
  paidUntil: string | null;
  /** Days from today to paidUntil. Null when there is nothing to count down to. */
  daysLeft: number | null;
  lastPaidAt: string | null;
  nextInvoiceNumber: string | null;
  nextAmount: Money | null;
  nextDueDate: string | null;
  daysOverdue: number;
  state: TenantSubscriptionState;
}

export interface TenantSubscriptionsResponse {
  rows: TenantSubscriptionRow[];
  totals: {
    tenants: number;
    withPlan: number;
    onTrial: number;
    noPlan: number;
    overdue: number;
    pastGrace: number;
    notInvoiced: number;
    expiringIn30Days: number;
    annual: number;
    monthly: number;
    mrr: Money;
  };
}
