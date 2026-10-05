import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The hospital admin dashboard refreshes itself every few minutes instead of
 * every minute, so it says how old its figures are and has a Refresh button.
 * Refresh must reach the database: the server holds each answer for a minute,
 * and `fresh=1` is what tells it to ask again.
 */

const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a) }, API_URL: "http://localhost:5000/api" }));
vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ user: { firstName: "Rajendra", lastName: "Bhide" }, isOrgAdmin: true, activeBranchId: null, availableBranches: [{ branchId: "a", branchName: "Kothrud" }] }),
}));

import HospitalDashboard from "./HospitalDashboard";

const stats = {
  activePlanName: "Growth", profileCompletionPercentage: 100, totalStaff: 4, activeUsers: 4, totalDoctors: 2,
  totalDepartments: 3, enabledModules: 5, todayAppointments: 1, activeAdmissions: 0,
  pendingTasks: [], recentActivities: [], departmentDistribution: [],
};
const ops = {
  asOf: "2026-10-05T09:00:00Z", comparedTo: "last Monday",
  money: { collectedToday: 1200, collectedPrevious: 900, outstandingCount: 0, outstandingAmount: 0, trend: [] },
  capacity: { totalBeds: 10, occupied: 2, available: 8, occupancyPct: 20 },
  flow: { appointmentsToday: 1, appointmentsPrevious: 1, admissionsToday: 0, dischargesToday: 0 },
  attention: [],
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith("/stats") ? stats : ops } }));
});

const calls = (path: string) => get.mock.calls.filter(([u]) => u === path);

describe("HospitalDashboard — how fresh the figures are", () => {
  it("says when it was updated, and Refresh asks the database for every part", async () => {
    renderWithProviders(<HospitalDashboard />);
    expect(await screen.findByText(/Updated just now/)).toBeInTheDocument();
    // An ordinary load takes the server's held answer.
    expect(calls("/hospital/dashboard/stats")[0][1]).toEqual({ params: undefined });
    expect(calls("/hospital/dashboard/operations")[0][1]).toEqual({ params: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Refresh the dashboard" }));
    await waitFor(() => expect(calls("/hospital/dashboard/operations")).toHaveLength(2));
    expect(calls("/hospital/dashboard/stats").at(-1)![1]).toEqual({ params: { fresh: 1 } });
    expect(calls("/hospital/dashboard/operations").at(-1)![1]).toEqual({ params: { fresh: 1 } });
  });
});
