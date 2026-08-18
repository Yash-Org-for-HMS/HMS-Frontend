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
