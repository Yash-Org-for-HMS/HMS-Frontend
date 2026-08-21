import { describe, it, expect } from "vitest";
import {
  num, paidTotal, refundedTotal, pendingRefundTotal, netPaid, balanceOf, isSettled,
  refundablePayments, balanceFromRefunds, totalRefundable,
} from "./invoiceMoney";
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

// ── Refunds awaiting approval ────────────────────────────────────────────────
// A refund at or above the hospital's threshold is raised PENDING and returns
// nothing until an admin releases it. That creates two different questions about
// the same rows, and answering either with the other is a money bug:
//   - "how much came back?"      -> COMPLETED only
//   - "what can still be raised?" -> COMPLETED *and* PENDING
const refStatus = (refundId: string, paymentId: string, refundAmount: string, refundStatus: string): Refund =>
  ({ refundId, paymentId, refundAmount, refundStatus });

describe("refunds awaiting approval", () => {
  const withPending = invoice(
    "1000.00",
    [pay("p1", "1000.00")],
    [refStatus("r1", "p1", "600.00", "PENDING")],
  );

  it("a pending refund is NOT money returned", () => {
    expect(refundedTotal(withPending)).toBe(0);
    expect(netPaid(withPending)).toBe(1000);
    // The patient is not owed anything yet — nothing has been handed back.
    expect(balanceOf(withPending)).toBe(0);
    expect(isSettled(withPending)).toBe(true);
  });

  it("but a pending refund HAS spoken for the money", () => {
    // ₹600 of the ₹1,000 is claimed, so only ₹400 can still be raised. Counting
    // COMPLETED alone here would offer the full ₹1,000 twice over.
    expect(refundablePayments(withPending).map((p) => p.refundable)).toEqual([400]);
    expect(pendingRefundTotal(withPending)).toBe(600);
  });

  it("approving it turns the claim into real money", () => {
    const approved = invoice("1000.00", [pay("p1", "1000.00")], [refStatus("r1", "p1", "600.00", "COMPLETED")]);
    expect(refundedTotal(approved)).toBe(600);
    expect(netPaid(approved)).toBe(400);
    expect(balanceOf(approved)).toBe(600); // refunding re-opens what is owed
    expect(refundablePayments(approved).map((p) => p.refundable)).toEqual([400]);
  });

  it("rejecting it releases the money for a fresh refund", () => {
    const rejected = invoice("1000.00", [pay("p1", "1000.00")], [refStatus("r1", "p1", "600.00", "REJECTED")]);
    expect(refundedTotal(rejected)).toBe(0);
    expect(pendingRefundTotal(rejected)).toBe(0);
    // The whole payment is claimable again — a rejected refund must not sit on it.
    expect(refundablePayments(rejected).map((p) => p.refundable)).toEqual([1000]);
  });

  it("mixes the three states without letting any leak into the others", () => {
    const mixed = invoice("1000.00", [pay("p1", "1000.00")], [
      refStatus("r1", "p1", "200.00", "COMPLETED"),
      refStatus("r2", "p1", "300.00", "PENDING"),
      refStatus("r3", "p1", "400.00", "REJECTED"),
    ]);
    expect(refundedTotal(mixed)).toBe(200);        // only the completed one
    expect(pendingRefundTotal(mixed)).toBe(300);
    expect(netPaid(mixed)).toBe(800);
    expect(refundablePayments(mixed).map((p) => p.refundable)).toEqual([500]); // 1000 − 200 − 300
  });

  it("treats status case-insensitively — the API is the source of that string", () => {
    const lower = invoice("1000.00", [pay("p1", "1000.00")], [refStatus("r1", "p1", "250.00", "completed")]);
    expect(refundedTotal(lower)).toBe(250);
  });
});

describe("balanceFromRefunds", () => {
  // The distinction the invoice dialog needs: a bill paid and then refunded shows
  // the same "Balance Due" as one nobody ever paid, and the screen offered both
  // the same one-click "Pay full balance".
  it("attributes the whole balance to the refund when the bill was paid in full", () => {
    const i = invoice("850.00", [pay("p1", "850.00")], [ref("r1", "p1", "850.00")]);
    expect(balanceOf(i)).toBe(850);
    expect(balanceFromRefunds(i)).toBe(850);
  });

  it("is zero when nothing was ever collected", () => {
    const i = invoice("850.00", [], []);
    expect(balanceOf(i)).toBe(850);
    expect(balanceFromRefunds(i)).toBe(0);
  });

  it("splits a balance that is part never-collected and part refunded", () => {
    // 1000 billed, 500 taken, 200 handed back: 500 was never collected.
    const i = invoice("1000.00", [pay("p1", "500.00")], [ref("r1", "p1", "200.00")]);
    expect(balanceOf(i)).toBe(700);
    expect(balanceFromRefunds(i)).toBe(200);
  });

  it("ignores a refund still awaiting approval — no money has moved yet", () => {
    const i = invoice("850.00", [pay("p1", "850.00")], [refStatus("r1", "p1", "850.00", "PENDING")]);
    expect(balanceOf(i)).toBe(0);
    expect(balanceFromRefunds(i)).toBe(0);
  });

  it("never exceeds the balance it is explaining", () => {
    // Overpaid then refunded in full: the refund is larger than what is outstanding.
    const i = invoice("500.00", [pay("p1", "800.00")], [ref("r1", "p1", "800.00")]);
    expect(balanceOf(i)).toBe(500);
    expect(balanceFromRefunds(i)).toBe(500);
  });
});

describe("totalRefundable", () => {
  it("sums what is left across every payment", () => {
    const i = invoice("1000.00", [pay("p1", "600.00"), pay("p2", "400.00")], [ref("r1", "p1", "100.00")]);
    expect(totalRefundable(i)).toBe(900);
  });

  it("is zero once every payment is fully claimed, pending included", () => {
    const i = invoice("1000.00", [pay("p1", "1000.00")], [
      ref("r1", "p1", "400.00"),
      refStatus("r2", "p1", "600.00", "PENDING"),
    ]);
    // Pending counts: the desk must not be offered money already spoken for.
    expect(totalRefundable(i)).toBe(0);
  });
});
