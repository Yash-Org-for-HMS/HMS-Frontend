import type { Money } from "@/types";

/**
 * Response shapes for the finance reports, mirrored from
 * backend/src/modules/reception/billingReports.controller.ts.
 *
 * Nearly every amount here is a Prisma Decimal passed straight through, so it
 * arrives as a decimal STRING and must go through Number() before arithmetic or
 * comparison — the controller only calls `.toNumber()` in a few places, and
 * those are typed `number` deliberately.
 */

export interface DateRangeEcho {
  from: string;
  to: string;
}

/** Rows capped server-side carry the counts needed to say so in the UI. */
export interface Truncatable {
  truncated?: boolean;
  totalRows?: number;
  shownRows?: number;
}

// ── Day Book (cash book) ────────────────────────────────────────────────────

export interface DayBookTotals {
  cashIn: Money;
  cashOut: Money;
  net: Money;
  /** Counter collections (OPD + pharmacy). */
  inPatient: Money;
  /** TPA / government settlements against claims. */
  inPayer: Money;
  inAdvance: Money;
  outRefund: Money;
  outDepRefund: Money;
  movements: number;
}

export interface DayBookModeRow {
  mode: string;
  in: Money;
  out: Money;
  net: Money;
  count: number;
}

export interface DayBookSourceRow {
  source: string;
  in: Money;
  out: Money;
}

export interface DayBookCollectorRow {
  collector: string;
  in: Money;
  out: Money;
  net: Money;
}

/** One money movement. Exactly one of inAmount/outAmount is non-zero. */
export interface DayBookRow {
  at: string | null;
  /** "Payment" | "Payer settlement" | "IPD advance" | "Refund" | "Deposit refund". */
  type: string;
  patientName: string;
  /** Invoice number, or "Advance"/"Deposit" for non-invoice movements. */
  ref: string;
  mode: string;
  inAmount: Money;
  outAmount: Money;
}

export interface DayBookResponse extends Truncatable {
  range: DateRangeEcho;
  totals: DayBookTotals;
  previous: Pick<DayBookTotals, "cashIn" | "cashOut" | "net">;
  byMode: DayBookModeRow[];
  bySource: DayBookSourceRow[];
  byCollector: DayBookCollectorRow[];
  trend: { date: string; in: number; out: number }[];
  rows: DayBookRow[];
}

// ── Revenue analytics ───────────────────────────────────────────────────────

export interface RevenueTotals {
  invoices: number;
  gross: Money;
  discount: Money;
  tax: Money;
  net: Money;
}

export interface RevenueCategoryRow {
  category: string;
  amount: Money;
}

export interface RevenueDoctorRow {
  doctor: string;
  amount: Money;
}

export interface RevenueDepartmentRow {
  department: string;
  amount: Money;
}

export interface RevenueResponse {
  range: DateRangeEcho;
  totals: RevenueTotals;
  previous: RevenueTotals;
  byCategory: RevenueCategoryRow[];
  byDoctor: RevenueDoctorRow[];
  byDepartment: RevenueDepartmentRow[];
  trend?: { date: string; amount: number }[];
}

// ── Refund register ─────────────────────────────────────────────────────────

export interface RefundRow {
  date: string | null;
  patientName: string;
  uhid: string;
  invoiceNumber: string;
  amount: Money;
  reason: string;
  processedBy: string;
  status: string;
}

export interface RefundRegisterResponse extends Truncatable {
  range: DateRangeEcho;
  totals: { count: number; total: Money };
  byReason: { reason: string; count: number; amount: Money }[];
  byProcessor: { processor: string; count: number; amount: Money }[];
  rows: RefundRow[];
}

// ── Discount register ───────────────────────────────────────────────────────

export interface DiscountRow {
  date: string;
  invoiceNumber: string;
  patientName: string;
  uhid: string;
  gross: Money;
  discount: Money;
  net: Money;
  /** Already a percentage number, computed server-side. */
  discountPct: number;
  appliedBy: string;
  reason: string;
}

export interface DiscountRegisterResponse extends Truncatable {
  range: DateRangeEcho;
  totals: { count: number; totalDiscount: Money; avgPct: number };
  byUser: { user: string; count: number; amount: Money }[];
  rows: DiscountRow[];
}

// ── Cancelled invoices ──────────────────────────────────────────────────────

export interface CancelledInvoiceRow {
  invoiceNumber: string;
  patientName: string;
  uhid: string;
  invoiceDate: string;
  cancelledOn: string;
  amount: Money;
  cancelledBy: string;
  reason: string;
}

export interface CancelledInvoiceResponse extends Truncatable {
  range: DateRangeEcho;
  totals: { count: number; totalValue: Money };
  byUser: { user: string; count: number; amount: Money }[];
  rows: CancelledInvoiceRow[];
}

// ── Doctor productivity ─────────────────────────────────────────────────────

export interface DoctorProductivityRow {
  /** "Unassigned" for invoices with no attributable doctor. */
  doctor: string;
  appointments: number;
  completed: number;
  /** Percentage, one decimal — computed server-side. */
  completionRate: number;
  consultations: number;
  revenue: Money;
}

export interface DoctorProductivityResponse extends Truncatable {
  range: DateRangeEcho;
  totals: {
    doctors: number;
    appointments: number;
    consultations: number;
    revenue: Money;
  };
  rows: DoctorProductivityRow[];
}
