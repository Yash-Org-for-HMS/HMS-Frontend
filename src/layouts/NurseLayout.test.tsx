import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The nurse's worklists (dashboard and queue) are refreshed through the
 * layout's one live connection. They read the outpatient queue: an outpatient
 * change refreshes both, a lab or radiology change neither, and a connect
 * re-asks only what is not already fresh.
 */

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...a: unknown[]) => void> }));
const badge = vi.hoisted(() => ({ onAnnouncement: vi.fn(), onConnect: vi.fn() }));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: (map: Record<string, (...a: unknown[]) => void>) => { socket.handlers = map; return { connected: true }; },
}));
vi.mock("@/features/announcements/useAnnouncementBadge", () => ({ useAnnouncementBadge: () => ({ unread: 0, ...badge }) }));
vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ user: { firstName: "Sunita", lastName: "F", role: "NURSE" }, hospital: { id: "h", name: "Sanjeevani" }, logout: vi.fn(), availableBranches: [], activeBranchId: null, isOrgAdmin: false }),
}));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: async () => ({ data: { data: {} } }) }, API_URL: "http://localhost:5000/api" }));
vi.mock("@/hooks/useEnabledModules", () => ({ useEnabledModules: () => ({ isModuleEnabled: () => true, loaded: true }) }));

import NurseLayout from "./NurseLayout";

beforeEach(() => {
  badge.onAnnouncement.mockClear();
  badge.onConnect.mockClear();
});

const invalidated = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

describe("NurseLayout — live refresh of the worklists", () => {
  it("an outpatient change refreshes the dashboard and the queue; a lab change does not", async () => {
    const { queryClient } = renderWithProviders(<NurseLayout />);
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    act(() => socket.handlers.QUEUE_UPDATED({ area: "lab" }));
    expect(spy).not.toHaveBeenCalled();

    act(() => socket.handlers.QUEUE_UPDATED({ area: "opd" }));
    expect(invalidated(spy)).toEqual(['["nurse-dashboard-queue"]', '["nurse-queue"]']);

    // An untagged event (an older server) counts as outpatient.
    spy.mockClear();
    act(() => socket.handlers.QUEUE_UPDATED());
    expect(invalidated(spy)).toHaveLength(2);
  });

  it("a connect still serves the announcement badge, and re-asks the worklists", () => {
    const { queryClient } = renderWithProviders(<NurseLayout />);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => socket.handlers.connect());
    expect(badge.onConnect).toHaveBeenCalledTimes(1);
    // Nothing on screen yet holds them, so both are asked for.
    expect(invalidated(spy)).toEqual(expect.arrayContaining(['["nurse-dashboard-queue"]', '["nurse-queue"]']));
    // And the screens that refresh only when told (bed board, indents, co-sign…):
    // whatever changed while the connection was down is fetched again.
    expect(invalidated(spy)).toEqual(expect.arrayContaining(['["ipd-structure"]', '["ward-indents"]', '["ward-round-cosign"]']));
    act(() => socket.handlers.ANNOUNCEMENT_PUBLISHED());
    expect(badge.onAnnouncement).toHaveBeenCalledTimes(1);
  });
});
