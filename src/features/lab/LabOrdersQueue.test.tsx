import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The lab queue asks the server again when its work changes: a lab or
 * radiology event, or a test paid for at another counter ("billing" — which
 * releases a pre-paid sample). An outpatient event (a check-in, vitals) and the
 * first connect do not; a reconnect after a while does. Both the list and the
 * backlog count follow.
 */

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...a: unknown[]) => void> }));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: (map: Record<string, (...a: unknown[]) => void>) => { socket.handlers = map; return { connected: true }; },
}));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ user: { role: "LAB_TECH" }, hospital: { id: "h" } }) }));
const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a), post: vi.fn() }, API_URL: "http://localhost:5000/api" }));

import LabOrdersQueue from "./LabOrdersQueue";

const asks = (bucket: string) =>
  get.mock.calls.filter(([u, cfg]) => u === "/lab/orders" && (cfg as { params?: { bucket?: string } })?.params?.bucket === bucket).length;

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: [], pagination: { total: 0, totalPages: 1 } } });
});

describe("LabOrdersQueue — live updates", () => {
  it("lab and billing events refresh the list and the backlog; outpatient ones and the first connect do not", async () => {
    renderWithProviders(<LabOrdersQueue />);
    await waitFor(() => { expect(asks("today_pending")).toBe(1); expect(asks("past_pending")).toBe(1); });

    act(() => socket.handlers.connect());
    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(asks("today_pending")).toBe(1);

    act(() => socket.handlers.QUEUE_UPDATED({ area: "billing" }));
    await waitFor(() => { expect(asks("today_pending")).toBe(2); expect(asks("past_pending")).toBe(2); });
    act(() => socket.handlers.QUEUE_UPDATED({ area: "lab" }));
    await waitFor(() => expect(asks("today_pending")).toBe(3));
  });

  it("a reconnect after a while asks again", async () => {
    renderWithProviders(<LabOrdersQueue />);
    await waitFor(() => expect(asks("today_pending")).toBe(1));
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try {
      act(() => socket.handlers.connect());
      await waitFor(() => expect(asks("today_pending")).toBe(2));
    } finally {
      spy.mockRestore();
    }
  });
});
