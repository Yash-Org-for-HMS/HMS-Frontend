import { describe, it, expect } from "vitest";
import { num, paidTotal, refundedTotal, netPaid, balanceOf, isSettled, refundablePayments } from "./invoiceMoney";
import type { Invoice, Payment, Refund } from "@/types";

// Amounts arrive from the API as decimal STRINGS, so every fixture uses strings —
// testing with numbers would pass while the real payload silently coerced badly.
const pay = (paymentId: string, paidAmount: string): Payment => ({ paymentId, paidAmount });
const ref = (refundId: string, paymentId: string, refundAmount: string): Refund =>
  ({ refundId, paymentId, refundAmount, refundStatus: "COMPLETED" });

const invoice = (netAmount: string, Payment: Payment[] = [], Refund: Refund[] = []) =>
  ({ invoiceId: "i1", invoiceNumber: "INV-1", netAmount, Payment, Refund }) as unknown as Invoice;

describe("num", () => {
  it("parses decimal strings", () => expect(num("1234.56")).toBe(1234.56));
  it("treats null/undefined as zero", () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
  });
  // The whole reason this helper exists: an `any`-typed row with a renamed field
  // used to yield NaN, which then poisoned every total it touched.
  it("never returns NaN", () => {
    expect(num("not-a-number")).toBe(0);
    expect(num({})).toBe(0);
  });
});

describe("paidTotal / refundedTotal / netPaid", () => {
  it("sums payments", () => {
    expect(paidTotal(invoice("1000", [pay("p1", "600"), pay("p2", "400")]))).toBe(1000);
  });
  it("sums refunds", () => {
    expect(refundedTotal(invoice("1000", [], [ref("r1", "p1", "150")]))).toBe(150);
  });
  it("nets refunds off collections", () => {
    const inv = invoice("1000", [pay("p1", "1000")], [ref("r1", "p1", "250")]);
    expect(netPaid(inv)).toBe(750);
  });
  it("handles a missing invoice and empty relations", () => {
    expect(paidTotal(null)).toBe(0);
    expect(refundedTotal(undefined)).toBe(0);
    expect(netPaid(invoice("500"))).toBe(0);
  });
});

describe("balanceOf", () => {
  it("is the unpaid remainder", () => {
    expect(balanceOf(invoice("1000", [pay("p1", "400")]))).toBe(600);
  });

  // The regression this helper is named for: a fully-paid invoice that is then
  // refunded is NOT settled — the money went back, so the balance re-opens.
  // Any implementation that ignores refunds returns 0 here and reports the
  // invoice as paid while the hospital is owed the money again.
  it("re-opens the balance when a payment is refunded", () => {
    const inv = invoice("1000", [pay("p1", "1000")], [ref("r1", "p1", "1000")]);
    expect(balanceOf(inv)).toBe(1000);
    expect(isSettled(inv)).toBe(false);
  });

  it("treats sub-paisa float dust as settled", () => {
    const inv = invoice("100.10", [pay("p1", "33.36"), pay("p2", "33.37"), pay("p3", "33.37")]);
    expect(Math.abs(balanceOf(inv))).toBeLessThan(0.005);
    expect(isSettled(inv)).toBe(true);
  });

  it("goes negative on an over-collection rather than clamping", () => {
    expect(balanceOf(invoice("500", [pay("p1", "600")]))).toBe(-100);
  });
});

describe("refundablePayments", () => {
  it("reports each payment's remaining refundable amount", () => {
    const inv = invoice("1000", [pay("p1", "600"), pay("p2", "400")], [ref("r1", "p1", "100")]);
    const rows = refundablePayments(inv);
    expect(rows.map((r) => [r.paymentId, r.refundable])).toEqual([["p1", 500], ["p2", 400]]);
  });

  // Without this, the refund picker would keep offering a payment that has
  // already been returned in full — the over-refunding shape.
  it("drops a payment that has been fully refunded", () => {
    const inv = invoice("1000", [pay("p1", "600"), pay("p2", "400")], [ref("r1", "p1", "600")]);
    expect(refundablePayments(inv).map((r) => r.paymentId)).toEqual(["p2"]);
  });

  it("aggregates multiple partial refunds against one payment", () => {
    const inv = invoice("1000", [pay("p1", "600")], [ref("r1", "p1", "200"), ref("r2", "p1", "150")]);
    expect(refundablePayments(inv)[0].refundable).toBe(250);
  });

  it("returns nothing when there are no payments", () => {
    expect(refundablePayments(invoice("1000"))).toEqual([]);
  });
});
