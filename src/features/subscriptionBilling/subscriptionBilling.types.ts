/** Money crosses the wire as a decimal string; `Number()` it before arithmetic. */
export type Money = string | number;

/**
 * A row of the platform's subscription-invoice register, as
 * `GET /subscription-billing/invoices` returns it.
 *
 * `hospitalName`, `phase`, `graceEndsAt` and `graceDaysLeft` are derived
 * server-side and have no column behind them: `phase` folds status and due date
 * into one lifecycle value, and the grace fields are null on anything that is
 * not currently running its clock (paid, void, or not yet due).
 */
export interface SubscriptionInvoiceListRow {
  subscriptionInvoiceId: string;
  invoiceNumber: string;
  hospitalId: string;
  hospitalName: string;
  planId: string | null;
  planName: string | null;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  amount: Money;
  status: string;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  /** PAID | PENDING | OVERDUE | SUSPENDED | VOID */
  phase: string;
  graceEndsAt: string | null;
  /** Whole days left, floored. 0 = today; negative = the window already closed. */
  graceDaysLeft: number | null;
}
