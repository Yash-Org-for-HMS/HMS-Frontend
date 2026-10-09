import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The doctor's queue asks the server again only when something it shows has
 * changed: an outpatient event yes, a lab or radiology one no (the queue holds
 * no lab data — the results badge and dashboard pick those up), the first
 * connect no, a reconnect yes.
 */

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...a: unknown[]) => void> }));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: (map: Record<string, (...a: unknown[]) => void>) => { socket.handlers = map; return { connected: true }; },
}));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ user: { id: "me", role: "DOCTOR" }, hospital: { id: "h" } }) }));
const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a) }, API_URL: "http://localhost:5000/api" }));

import DoctorQueue from "./DoctorQueue";

const asks = () => get.mock.calls.filter(([u]) => u === "/doctor/queue").length;

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: [] } });
});

describe("DoctorQueue — live updates", () => {
  it("an outpatient change asks again; a lab change and the first connect do not", async () => {
    renderWithProviders(<DoctorQueue />);
    await waitFor(() => expect(asks()).toBe(1));
    act(() => socket.handlers.connect());
    act(() => socket.handlers.QUEUE_UPDATED({ area: "lab" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(asks()).toBe(1);
    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd" }));
    await waitFor(() => expect(asks()).toBe(2));
  });

  it("another doctor's patient does not move this queue; this doctor's, or an unaddressed change, does", async () => {
    renderWithProviders(<DoctorQueue />);
    await waitFor(() => expect(asks()).toBe(1));
    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd", doctorUserId: "someone-else" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(asks()).toBe(1);
    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd", doctorUserId: "me" }));
    await waitFor(() => expect(asks()).toBe(2));
    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd" }));
    await waitFor(() => expect(asks()).toBe(3));
  });

  it("a reconnect after a while asks", async () => {
    renderWithProviders(<DoctorQueue />);
    await waitFor(() => expect(asks()).toBe(1));
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try {
      act(() => socket.handlers.connect());
      await waitFor(() => expect(asks()).toBe(2));
    } finally {
      spy.mockRestore();
    }
  });
});
