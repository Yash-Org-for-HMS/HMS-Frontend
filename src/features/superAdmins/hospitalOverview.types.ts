import type { Money } from "@/types";

/**
 * GET /hospitals/:id/overview — the platform's view of one tenant, mirrored
 * from backend/src/modules/hospitals/hospitals.service.ts.
 *
 * The endpoint spreads the whole Hospital row and decorates it; declared here
 * are the fields this screen reads, not all sixty columns.
 */

export interface OverviewBranch {
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status?: string | null;
  subscriptionPlanId?: string | null;
  subscriptionPlan?: { planName?: string | null } | null;
}

export interface OverviewUser {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: { roleName?: string | null; roleCode?: string | null } | null;
  status?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
}

/** The tenant's own subscription invoice — not a patient bill. */
export interface SubscriptionInvoiceRow {
  subscriptionInvoiceId: string;
  invoiceNumber?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount: Money;
  status?: string | null;
  dueDate?: string | null;
  /** Where the invoice sits in its cycle (PENDING, CURRENT, PAST…). Keys the phase chip map. */
  phase: string;
}

export interface OverviewBilling {
  cycle?: string | null;
  /** Keys the billing-state chip map — always set by the server. */
  state: string;
  /** Billed per cycle; `mrr` normalises an annual plan to a month. */
  cycleAmount: Money;
  mrr: Money;
  outstanding: Money;
  /** Grace-period countdown; all three null unless the tenant is overdue. */
  oldestDueDate?: string | null;
  graceEndsAt?: string | null;
  /** Whole days left, floored. 0 = today; negative = the window already closed. */
  graceDaysLeft?: number | null;
  currentPlanId?: string | null;
  pendingPlanId?: string | null;
  pendingPlanName?: string | null;
  invoices: SubscriptionInvoiceRow[];
}

/** `limit` null means unmetered, which is not the same as a limit of zero. */
export interface QuotaUsage {
  used: number | null;
  limit: number | null;
}

export interface OverviewQuotas {
  doctors: QuotaUsage;
  branches: QuotaUsage;
  users: QuotaUsage;
  storageGb: QuotaUsage;
}

export interface HospitalTrialRow {
  hospitalTrialId: string;
  hospitalLeadId?: string | null;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialStatus?: string | null;
  subscriptionPlanId?: string | null;
  autoExpire?: boolean | null;
}

/** Present only for a hospital that came in through Sales Leads. */
export interface OverviewLead {
  hospitalLeadId: string;
  hospitalName?: string | null;
  contactPersonName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadStatus?: string | null;
  assignedSalesAdminId?: string | null;
  trials?: HospitalTrialRow[];
}

export interface OverviewOnboarding {
  hospitalOnboardingId: string;
  onboardingStatus?: string | null;
  defaultRolesSeeded?: boolean | null;
  tenantSetupCompleted?: boolean | null;
  paymentVerified?: boolean | null;
  primaryAdminUserId?: string | null;
}

export interface HospitalOverviewData {
  hospitalId: string;
  hospitalCode?: string | null;
  hospitalName?: string | null;
  legalBusinessName?: string | null;
  registrationNumber?: string | null;
  gstNumber?: string | null;
  accreditationType?: string | null;
  licenseExpiryDate?: string | null;
  ownershipType?: string | null;
  bedCapacity?: number | null;
  officialEmail?: string | null;
  officialPhone?: string | null;
  emergencyPhone?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  websiteUrl?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string | null;
  postalCode?: string | null;
  timezone?: string | null;
  currencyCode?: string | null;
  languageCode?: string | null;
  status?: string | null;
  createdAt?: string | null;
  branches?: OverviewBranch[];
  users?: OverviewUser[];
  onboarding?: OverviewOnboarding[];
  lead?: OverviewLead | null;
  admin?: { firstName?: string | null; lastName?: string | null; email?: string | null; mustChangePassword?: boolean | null } | null;
  billing: OverviewBilling;
  quotas: OverviewQuotas;
  _count?: { patients?: number; doctors?: number; users?: number };
}

/** A subscription plan, as the plan picker lists it. */
export interface PlanRow {
  planId: string;
  planName?: string | null;
  monthlyPrice: Money;
  annualPrice: Money;
  maxBranches?: number | null;
  maxDoctors?: number | null;
  maxStorageGb?: number | null;
}
