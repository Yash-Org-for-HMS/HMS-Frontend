import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The duty roster: a planner puts a nurse on a shift with one click; a shift
 * the nurse works on another ward cannot be taken; someone only looking sees
 * the roster with nothing to press.
 */

const auth = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ user: auth.user }) }));
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...a: unknown[]) => api.get(...a), put: (...a: unknown[]) => api.put(...a), post: (...a: unknown[]) => api.post(...a) },
  API_URL: "http://localhost:5000/api",
}));

import DutyRoster from "./DutyRoster";

const plannerRole = (code: string, actions: string[]) => ({ role: code, roles: [{ code, name: code, branchId: null, branchName: null, primary: true, pages: null, home: null, actions }] });
const shifts = [{ name: "Morning", startTime: "08:00", endTime: "14:00" }, { name: "Evening", startTime: "14:00", endTime: "20:00" }, { name: "Night", startTime: "20:00", endTime: "08:00" }];

function week(canPlan: boolean) {
  return {
    ward: { wardId: "w1", wardName: "General" }, canPlan, shifts,
    days: ["2030-03-04", "2030-03-05", "2030-03-06", "2030-03-07", "2030-03-08", "2030-03-09", "2030-03-10"],
    occupied: 4, plannedRatio: "1:2", neededPerShift: 2,
    nurses: [{ staffId: "n1", name: "Asha K", posted: true, status: "ACTIVE" }],
    duties: [{ staffId: "n1", dutyDate: "2030-03-04", shiftName: "Morning" }],
    elsewhere: [{ staffId: "n1", dutyDate: "2030-03-04", shiftName: "Evening", wardName: "ICU" }],
  };
}

function serve(canPlan: boolean) {
  api.get.mockImplementation(async (url: string) => {
    if (url === "/roster/wards") return { data: { data: [{ wardId: "w1", wardName: "General", wardCode: "GEN", canPlan }] } };
    if (url === "/roster/nurses") return { data: { data: [] } };
    return { data: { data: week(canPlan) } };
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.post.mockReset();
  api.put.mockResolvedValue({ data: { data: { on: true, changed: true } } });
});

describe("Duty roster", () => {
  it("a planner puts a nurse on a shift with one click; a shift on another ward cannot be taken", async () => {
    auth.user = plannerRole("NURSE_INCHARGE", ["nurse.roster"]);
    serve(true);
    renderWithProviders(<DutyRoster />);
    const night = await screen.findByRole("button", { name: "Asha K, Mon 4 Mar, Night: off" });
    expect(screen.getByRole("button", { name: "Asha K, Mon 4 Mar, Morning: on duty" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Asha K, Mon 4 Mar, Evening: on ICU" })).toBeDisabled();
    expect(screen.getByText(/planning ratio 1:2 → 2 nurses a shift/)).toBeInTheDocument();
    fireEvent.click(night);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/roster/duty", { wardId: "w1", staffId: "n1", dutyDate: "2030-03-04", shiftName: "Night", on: true }));
  });

  it("someone only looking sees the roster with nothing to press", async () => {
    auth.user = plannerRole("NURSE", []);
    serve(false);
    renderWithProviders(<DutyRoster />);
    expect(await screen.findByLabelText("Asha K, Mon 4 Mar, Morning: on duty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Asha K/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy last week/ })).not.toBeInTheDocument();
  });
});
