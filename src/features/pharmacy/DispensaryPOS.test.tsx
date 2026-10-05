import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The pharmacy counter re-reads its lists when the pharmacy's own work changes
 * — a prescription written, a sale or stock movement at another counter, a sale
 * paid for at reception. Lab work, the outpatient flow and lab payments change
 * nothing here, and the first connect no longer repeats the screen's own load.
 */

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...a: unknown[]) => void> }));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: (map: Record<string, (...a: unknown[]) => void>) => { socket.handlers = map; return { connected: true }; },
}));
vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ activeBranchId: "k", availableBranches: [{ branchId: "k", branchName: "Kothrud" }], setActiveBranch: vi.fn() }),
}));
vi.mock("@/providers/ConfirmContext", () => ({ useConfirm: () => async () => true }));
const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a), post: vi.fn(), put: vi.fn() }, API_URL: "http://localhost:5000/api" }));

import DispensaryPOS from "./DispensaryPOS";

const asks = (prefix: string) => get.mock.calls.filter(([u]) => String(u).startsWith(prefix)).length;

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: [] } });
});

describe("DispensaryPOS — live updates", () => {
  it("a pharmacy event re-reads the work and the stock; other kinds and the first connect do not", async () => {
    renderWithProviders(<DispensaryPOS />);
    await waitFor(() => {
      expect(asks("/pharmacy/medicines")).toBe(1);
      expect(asks("/pharmacy/prescriptions/pending")).toBe(1);
    });

    act(() => socket.handlers.connect());
    for (const area of ["opd", "lab", "billing"]) act(() => socket.handlers.QUEUE_UPDATED({ area }));
    await new Promise((r) => setTimeout(r, 30));
    expect(asks("/pharmacy/prescriptions/pending")).toBe(1);
    expect(asks("/pharmacy/medicines")).toBe(1);

    act(() => socket.handlers.QUEUE_UPDATED({ area: "pharmacy" }));
    await waitFor(() => {
      expect(asks("/pharmacy/prescriptions/pending")).toBe(2);
      expect(asks("/pharmacy/orders")).toBe(2);
      expect(asks("/pharmacy/medicines")).toBe(2);
      expect(asks("/pharmacy/inventory")).toBe(2);
    });
  });

  it("a reconnect after a while re-reads both", async () => {
    renderWithProviders(<DispensaryPOS />);
    await waitFor(() => expect(asks("/pharmacy/prescriptions/pending")).toBe(1));
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try {
      act(() => socket.handlers.connect());
      await waitFor(() => {
        expect(asks("/pharmacy/prescriptions/pending")).toBe(2);
        expect(asks("/pharmacy/medicines")).toBe(2);
      });
    } finally {
      spy.mockRestore();
    }
  });
});
