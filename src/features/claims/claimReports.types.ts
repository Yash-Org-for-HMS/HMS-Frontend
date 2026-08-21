import type { Money } from "@/types";

/**
 * Claim analytics response, mirrored from
 * backend/src/modules/claims/claimReports.service.ts.
 *
 * Every money field is a Prisma Decimal passed through, so it arrives as a
 * decimal string. Summary KPIs and all breakdowns are computed over the FULL
 * claim set; only `register` is capped, which is why the truncation counts sit
 * at the top level rather than beside the rows.
 */

export interface ClaimSummary {
  totalClaims: number;
  open: number;
  settled: number;
  rejected: number;
  totalBilled: Money;
  totalApproved: Money;
  totalSettled: Money;
  /** Approved but not yet received from the payer. */
  outstandingFromPayer: Money;
  /** Billed minus approved — what the patient is left carrying. */
  patientShortfall: Money;
}

export interface ClaimStatusRow {
  status: string;
  label: string;
  count: number;
}

export interface ClaimPayerRow {
  payerName: string;
  count: number;
  billed: Money;
  approved: Money;
  settled: Money;
  outstanding: Money;
}

export interface ClaimSchemeRow {
  scheme: string;
  count: number;
  billed: Money;
  approved: Money;
  settled: Money;
}

/** Pre-authorisation turnaround: only claims with both timestamps appear. */
export interface PreAuthTatRow {
  claimNumber: string;
  patientName: string;
  submittedAt: string;
  approvedAt: string;
  days: number;
}

export interface ClaimAgingBucket {
  label: string;
  count: number;
  amount: Money;
}

export interface ClaimAgingRow {
  claimNumber: string;
  patientName: string;
  payerName: string;
  submittedAt: string | null;
  ageDays: number;
  outstanding: Money;
}

export interface ClaimRejectionRow {
  claimNumber: string;
  patientName: string;
  payerName: string;
  status: string;
  billed: Money;
  at: string;
}

export interface ClaimRegisterRow {
  claimNumber: string;
  patientName: string;
  uhid: string;
  payerName: string;
  scheme: string;
  status: string;
  billed: Money;
  approved: Money;
  settled: Money;
  registeredAt: string;
}

export interface ClaimReportsResponse {
  range: { from: string; to: string };
  summary: ClaimSummary;
  /**
   * The same summary for the equal-length window immediately before this one,
   * so each card can show which way it is moving. Optional because a client
   * built against the older response shape must keep working.
   */
  previous?: ClaimSummary;
  statusBreakdown: ClaimStatusRow[];
  payerWise: ClaimPayerRow[];
  schemeWise: ClaimSchemeRow[];
  preAuthTat: { avgDays: number; rows: PreAuthTatRow[] };
  aging: { buckets: ClaimAgingBucket[]; rows: ClaimAgingRow[] };
  rejections: ClaimRejectionRow[];
  /** The only capped list; the counts below describe it. */
  register: ClaimRegisterRow[];
  truncated?: boolean;
  totalRows?: number;
  shownRows?: number;
}
