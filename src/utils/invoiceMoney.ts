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

/**
 * A refund only counts as money once an administrator has released it.
 *
 * Refunds at or above the hospital's approval threshold are raised PENDING and
 * return nothing until approved, so there are two different questions here and
 * conflating them would either credit a patient before they were handed anything
 * (counting PENDING as returned) or let three pending refunds each claim the
 * same payment (ignoring PENDING entirely). They get separate functions.
 */
const isCompleted = (r: Refund): boolean => String(r.refundStatus).toUpperCase() === "COMPLETED";

/** Still awaiting an administrator — no money has moved. */
export const isPendingRefund = (r: Refund): boolean => String(r.refundStatus).toUpperCase() === "PENDING";

/**
 * Money actually returned to the payer: COMPLETED refunds only.
 *
 * This is the one that feeds balances, dues and "has this been settled" — it
 * must never include a refund that is still waiting on approval.
 */
export function refundedTotal(invoice?: { Refund?: Refund[] | null } | null): number {
  return (invoice?.Refund ?? []).filter(isCompleted).reduce((s, r) => s + num(r.refundAmount), 0);
}

/** Raised but not yet released — shown to explain why a payment isn't refundable. */
export function pendingRefundTotal(invoice?: { Refund?: Refund[] | null } | null): number {
  return (invoice?.Refund ?? []).filter(isPendingRefund).reduce((s, r) => s + num(r.refundAmount), 0);
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
 *
 * Counts PENDING refunds against the payment as well as COMPLETED ones — the
 * opposite of `refundedTotal`, and deliberately. A pending refund has not
 * returned any money, but it has SPOKEN FOR it; leaving it out here would let
 * the desk raise a second refund for the same payment while the first is still
 * waiting, and an admin would then approve both. The backend enforces the same
 * rule, so this only keeps the UI from offering what the server will refuse.
 */
/**
 * How much of the outstanding balance exists only because money was handed back.
 *
 * A fully refunded invoice reads as "Balance Due ₹850" — arithmetically true
 * (nothing is paid any more) but indistinguishable on screen from a bill that
 * was never paid at all, so the desk is invited to collect it again. Splitting
 * the two lets the UI say WHY the balance is there.
 */
export function balanceFromRefunds(
  invoice?: Pick<Invoice, "netAmount"> & { Payment?: Payment[] | null; Refund?: Refund[] | null } | null,
): number {
  const refunded = refundedTotal(invoice);
  if (refunded <= EPSILON) return 0;
  return Math.min(refunded, Math.max(0, balanceOf(invoice)));
}

/** Total still returnable across every payment on the invoice. */
export function totalRefundable(
  invoice?: { Payment?: Payment[] | null; Refund?: Refund[] | null } | null,
): number {
  return refundablePayments(invoice).reduce((s, p) => s + p.refundable, 0);
}

export function refundablePayments(
  invoice?: { Payment?: Payment[] | null; Refund?: Refund[] | null } | null,
): RefundablePayment[] {
  const refundedByPayment: Record<string, number> = {};
  for (const r of invoice?.Refund ?? []) {
    if (!isCompleted(r) && !isPendingRefund(r)) continue; // REJECTED frees the money again
    refundedByPayment[r.paymentId] = (refundedByPayment[r.paymentId] ?? 0) + num(r.refundAmount);
  }
  return (invoice?.Payment ?? [])
    .map((p) => ({ ...p, refundable: num(p.paidAmount) - (refundedByPayment[p.paymentId] ?? 0) }))
    .filter((p) => p.refundable > EPSILON);
}
