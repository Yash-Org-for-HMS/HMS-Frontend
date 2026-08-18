import type { Invoice, Payment, Refund, RefundablePayment } from "@/types";

/**
 * The single definition of "how much has this invoice been paid, refunded and
 * what is still owed".
 *
 * This arithmetic was written out inline in seven places (BillingModal,
 * BillReceipt, InvoiceViewDialog, CheckoutDialog, LabReceiptDialog, PrintIpBill
 * and the IP bill print view), each with its own `(p: any) => Number(p.paidAmount)`
 * reduce. Seven copies of a money rule is seven chances for them to drift apart —
 * and because every copy typed the row as `any`, a backend field rename would
 * silently produce `Number(undefined)` → `NaN` → a total that reads as ₹0 rather
 * than failing loudly.
 *
 * Amounts arrive as decimal strings (Prisma `Decimal`), so everything goes
 * through `num()` before arithmetic.
 */

/** Decimal-string (or number, or missing) → number. Never NaN. */
export function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Gross collected — the sum of every payment row, before refunds. */
export function paidTotal(invoice?: { Payment?: Payment[] | null } | null): number {
  return (invoice?.Payment ?? []).reduce((s, p) => s + num(p.paidAmount), 0);
}

/** Everything returned to the payer against this invoice. */
export function refundedTotal(invoice?: { Refund?: Refund[] | null } | null): number {
  return (invoice?.Refund ?? []).reduce((s, r) => s + num(r.refundAmount), 0);
}

/** Money the hospital has actually kept: collected − refunded. */
export function netPaid(invoice?: { Payment?: Payment[] | null; Refund?: Refund[] | null } | null): number {
  return paidTotal(invoice) - refundedTotal(invoice);
}

/**
 * What the patient still owes. Refunds count against the invoice, so a refunded
 * payment re-opens the balance — that was the bug behind "dues ignoring refunds".
 */
export function balanceOf(invoice?: Pick<Invoice, "netAmount"> & { Payment?: Payment[] | null; Refund?: Refund[] | null } | null): number {
  return num(invoice?.netAmount) - netPaid(invoice);
}

/** Treat sub-paisa residue as settled — float subtraction leaves dust. */
const EPSILON = 0.005;

export function isSettled(invoice?: Pick<Invoice, "netAmount"> & { Payment?: Payment[] | null; Refund?: Refund[] | null } | null): boolean {
  return balanceOf(invoice) <= EPSILON;
}

/**
 * Payments that still have money left to return, each carrying its remaining
 * refundable amount. A payment already fully refunded drops out, so the refund
 * picker can never offer to return money twice.
 */
export function refundablePayments(
  invoice?: { Payment?: Payment[] | null; Refund?: Refund[] | null } | null,
): RefundablePayment[] {
  const refundedByPayment: Record<string, number> = {};
  for (const r of invoice?.Refund ?? []) {
    refundedByPayment[r.paymentId] = (refundedByPayment[r.paymentId] ?? 0) + num(r.refundAmount);
  }
  return (invoice?.Payment ?? [])
    .map((p) => ({ ...p, refundable: num(p.paidAmount) - (refundedByPayment[p.paymentId] ?? 0) }))
    .filter((p) => p.refundable > EPSILON);
}
