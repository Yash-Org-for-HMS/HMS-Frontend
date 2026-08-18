import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

// BillingModal drags in the whole billing screen; this dialog only needs to know
// it exists, so stub it rather than mount it.
vi.mock("@/features/reception/BillingModal", () => ({ default: () => null }));

const get = vi.fn();
vi.mock("@/api/axios", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
  },
  API_URL: "http://localhost:5000/api",
}));

import CheckoutDialog from "./CheckoutDialog";

/**
 * Regression tests for OPD check-out dues.
 *
 * The bug: dues were computed as `netAmount - totalPaid` with no refunds term.
 * A fully-paid invoice that was later refunded therefore showed ZERO dues, and
 * the patient could be checked out owing the entire amount. Verified in the
 * browser at the time; these lock it in so it can't come back quietly.
 *
 * Amounts are decimal STRINGS because that is what the API sends.
 */
const invoice = (netAmount: string, payments: [string, string][] = [], refunds: [string, string][] = []) => ({
  status: "success",
  data: {
    data: {
      invoiceId: "inv-1",
      invoiceNumber: "INV-1",
      netAmount,
      Payment: payments.map(([paymentId, paidAmount]) => ({ paymentId, paidAmount })),
      Refund: refunds.map(([paymentId, refundAmount], i) => ({
        refundId: `r${i}`,
        paymentId,
        refundAmount,
        refundStatus: "COMPLETED",
      })),
    },
  },
});

const token = { queueTokenId: "t1", appointmentId: "appt-1", patientName: "Test Patient" };

const openDialog = () =>
  renderWithProviders(<CheckoutDialog open token={token} onClose={() => {}} onDone={() => {}} />);

describe("CheckoutDialog dues", () => {
  beforeEach(() => get.mockReset());

  it("shows no dues when the invoice is fully paid", async () => {
    get.mockResolvedValue(invoice("700.00", [["p1", "700.00"]]));
    openDialog();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Dues ₹/)).not.toBeInTheDocument());
    expect(screen.queryByText(/Outstanding balance/)).not.toBeInTheDocument();
  });

  it("shows the unpaid remainder as dues", async () => {
    get.mockResolvedValue(invoice("700.00", [["p1", "200.00"]]));
    openDialog();
    await waitFor(() => expect(screen.getByText(/Dues ₹500\.00/)).toBeInTheDocument());
  });

  // THE regression. Without the refunds term this renders no dues at all, and
  // the patient walks out owing Rs 700 with the screen saying they owe nothing.
  it("re-opens dues when the payment was refunded", async () => {
    get.mockResolvedValue(invoice("700.00", [["p1", "700.00"]], [["p1", "700.00"]]));
    openDialog();
    await waitFor(() => expect(screen.getByText(/Dues ₹700\.00/)).toBeInTheDocument());
    expect(screen.getByText(/Outstanding balance/)).toBeInTheDocument();
  });

  it("counts a partial refund against the balance", async () => {
    get.mockResolvedValue(invoice("700.00", [["p1", "700.00"]], [["p1", "250.00"]]));
    openDialog();
    await waitFor(() => expect(screen.getByText(/Dues ₹250\.00/)).toBeInTheDocument());
  });
});
