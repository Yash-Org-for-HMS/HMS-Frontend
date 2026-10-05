import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The reception queue is told about each change over the socket, so it asks
 * the server only when something it shows changed: an outpatient event yes, a
 * lab or radiology one no (it never touches this queue), a reconnect yes, the
 * first connect no (the screen has only just asked).
 */

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...a: unknown[]) => void>, connected: true }));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: (map: Record<string, (...a: unknown[]) => void>) => { socket.handlers = map; return { connected: socket.connected }; },
}));
vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ user: { role: "RECEPTIONIST" }, hospital: { id: "h" }, activeBranchId: "k", availableBranches: [] }),
}));
const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a), put: vi.fn() }, API_URL: "http://localhost:5000/api" }));
vi.mock("@/api/client", () => ({
  apiGetList: async (url: string) => { get(url); return { rows: [] }; },
}));

import QueueDashboard from "./QueueDashboard";

const queueAsks = () => get.mock.calls.filter(([u]) => u === "/reception/queue").length;

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: {} } });
  socket.connected = true;
});

describe("QueueDashboard — live updates", () => {
  it("an outpatient change asks again; a lab change and the first connect do not", async () => {
    renderWithProviders(<QueueDashboard />);
    await waitFor(() => expect(queueAsks()).toBe(1));

    act(() => socket.handlers.connect());
    act(() => socket.handlers.QUEUE_UPDATED({ area: "lab" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(queueAsks()).toBe(1);

    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd" }));
    await waitFor(() => expect(queueAsks()).toBe(2));
    // An event from a server that does not tag them still counts.
    act(() => socket.handlers.QUEUE_UPDATED());
    await waitFor(() => expect(queueAsks()).toBe(3));
  });

  it("a reconnect after a while asks — changes may have been missed", async () => {
    renderWithProviders(<QueueDashboard />);
    await waitFor(() => expect(queueAsks()).toBe(1));
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try {
      act(() => socket.handlers.connect());
      await waitFor(() => expect(queueAsks()).toBe(2));
    } finally {
      spy.mockRestore();
    }
  });
});
