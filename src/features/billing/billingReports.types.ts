import type { Money, Patient } from "@/types";
import type { DateRangeEcho, Truncatable } from "./financeReports.types";

/**
 * Response shapes for the billing registers, mirrored from
 * backend/src/modules/reception/billingReports.controller.ts (and
 * billing.service.ts for the patient statement).
 *
 * As elsewhere in billing, amounts are Prisma Decimals passed straight through,
 * so they arrive as decimal STRINGS.
 */

export type { DateRangeEcho, Truncatable };

// ── Receipts register ───────────────────────────────────────────────────────

export interface ReceiptRow {
  paymentId: string;
  date: string;
  invoiceNumber: string;
  patientName: string;
  uhid: string;
  /** "Patient" | "Payer" — a payer settlement is not counter cash. */
  source: string;
  /** Tender; payer settlements carry the payer tender label, not a cash method. */
  method: string;
  reference: string;
  /** "—" for payer settlements, which have no cashier. */
  collector: string;
  amount: Money;
}

export interface ReceiptsResponse extends Truncatable {
  totals: {
    count: number;
    gross: Money;
    fromPatient: Money;
    fromPayer: Money;
    payerCount: number;
  };
  previous: { count: number; gross: Money };
  byMethod: { method: string; amount: Money }[];
  trend?: { date: string; amount: number }[];
  rows: ReceiptRow[];
}

// ── Outstanding dues ────────────────────────────────────────────────────────

export interface OutstandingRow {
  invoiceNumber: string;
  invoiceDate: string;
  patientName: string;
  uhid: string;
  netAmount: Money;
  paidAmount: Money;
  balance: Money;
  statusLabel: string;
  statusColor: string;
}

export interface OutstandingResponse extends Truncatable {
  totals: { invoices: number; totalDues: Money; totalBilled: Money };
  rows: OutstandingRow[];
}

// ── Unreturned advances ─────────────────────────────────────────────────────

export interface UnreturnedAdvanceRow {
  admissionId: string;
  admissionNumber: string;
  admissionStatus: string;
  patientName: string;
  uhid: string;
  closedOn: string;
  collected: Money;
  refunded: Money;
  amountOwed: Money;
  /** "Pending" | "Partially refunded" | "Refunded". */
  refundStatus: string;
}

export interface UnreturnedAdvancesResponse extends Truncatable {
  totals: { pending: number; refunded: number; totalOwed: Money };
  rows: UnreturnedAdvanceRow[];
}

// ── Service-wise revenue ────────────────────────────────────────────────────

export interface ServiceWiseRow {
  service: string;
  quantity: number;
  amount: Money;
}

/** Not capped: the service list is bounded by the charge catalog. */
export interface ServiceWiseResponse {
  totals: { services: number; total: Money };
  rows: ServiceWiseRow[];
}

// ── Pharmacy expense (procurement) ──────────────────────────────────────────

export interface PharmacyExpenseRow {
  orderDate: string;
  supplier: string;
  status: string;
  amount: Money;
}

export interface PharmacyExpenseResponse extends Truncatable {
  totals: { purchaseOrders: number; total: Money };
  previous: { purchaseOrders: number; total: Money };
  trend?: { date: string; amount: number }[];
  rows: PharmacyExpenseRow[];
}

// ── Patient account statement ───────────────────────────────────────────────

export interface PatientStatementInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  appointmentId: string | null;
  netAmount: Money;
  /** Payments MINUS completed refunds — not gross collections. */
  paidAmount: Money;
  balance: Money;
  invoiceStatus: string;
  statusLabel: string;
  statusColor: string;
}

export interface PatientStatementResponse {
  totals: {
    totalBilled: Money;
    totalPaid: Money;
    totalDues: Money;
    /** Advance held: COLLECTED − APPLIED − REFUNDED. */
    totalDeposit: Money;
    invoiceCount: number;
  };
  invoices: PatientStatementInvoice[];
}

/** The patient picker searches the ordinary patient list endpoint. */
export type PatientSearchRow = Pick<Patient, "patientId" | "firstName" | "lastName" | "uhidNumber">;
