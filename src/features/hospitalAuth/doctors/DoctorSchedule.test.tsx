import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Which branch each session of a doctor's week is at. A doctor at two or more
 * branches names the branch of every session — "Every branch" let each branch
 * book the same hours and nobody knew where the doctor would be. A doctor at
 * one branch has nothing to choose, and a one-branch hospital is as before.
 */

const branches = { k: { branchId: "k", branchName: "Kothrud" }, w: { branchId: "w", branchName: "Wakad" } };
let hospitalBranches = [branches.k, branches.w];
let doctorBranches: string[] = ["k", "w"];
let schedules: { dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; branchId: string | null }[] = [];

vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useParams: () => ({ id: "doc1" }), useNavigate: () => vi.fn() }));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ availableBranches: hospitalBranches }) }));
const put = vi.fn().mockResolvedValue({ data: { success: true } });
vi.mock("@/api/axios", () => ({
  axiosInstance: {
    get: async (url: string) => (url.endsWith("/branches")
      ? { data: { data: doctorBranches } }
      : { data: { data: { user: { firstName: "Anand", lastName: "Kulkarni" }, schedules } } }),
    put: (...args: unknown[]) => put(...args),
  },
  API_URL: "http://localhost:5000/api",
}));

import DoctorSchedule from "./DoctorSchedule";

const monday = () => screen.getByText("Monday").closest(".MuiBox-root")!.parentElement!.parentElement as HTMLElement;
const save = () => userEvent.click(screen.getByRole("button", { name: /Save Schedule/ }));
const saved = () => (put.mock.calls[0][1] as { schedules: typeof schedules }).schedules;

beforeEach(() => {
  put.mockClear();
  hospitalBranches = [branches.k, branches.w];
  doctorBranches = ["k", "w"];
  schedules = [];
});

describe("DoctorSchedule — the branch of each session", () => {
  it("a doctor at two branches: no 'Every branch', and a session without one must be given one", async () => {
    schedules = [
      { dayOfWeek: 1, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: null }, // saved before branches
      { dayOfWeek: 2, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: "w" },
    ];
    renderWithProviders(<DoctorSchedule />);
    expect(await screen.findByText(/1 session does not say which branch/)).toBeInTheDocument();
    expect(within(monday()).getByText("Choose a branch")).toBeInTheDocument();
    expect(screen.queryByText("Every branch")).not.toBeInTheDocument();

    await save();
    expect(await screen.findByText(/Monday 10:00–14:00: choose the branch/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("once the session names its branch, it saves there", async () => {
    schedules = [{ dayOfWeek: 1, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: null }];
    const user = userEvent.setup();
    renderWithProviders(<DoctorSchedule />);
    await user.click(await within(await waitFor(monday)).findByText("Choose a branch"));
    const list = await screen.findByRole("listbox");
    expect(within(list).queryByText("Every branch")).not.toBeInTheDocument();
    await user.click(within(list).getByText("Kothrud"));
    await save();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(saved()).toEqual([expect.objectContaining({ dayOfWeek: 1, branchId: "k" })]);
  });

  it("a doctor at one branch: nothing to choose, and the session is saved at that branch", async () => {
    doctorBranches = ["k"];
    schedules = [{ dayOfWeek: 1, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: null }];
    renderWithProviders(<DoctorSchedule />);
    expect(await screen.findByText(/all at Kothrud/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    await save();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(saved()).toEqual([expect.objectContaining({ branchId: "k" })]);
  });

  it("keeps a session at a branch this login cannot see", async () => {
    // A branch admin at Kothrud editing a doctor who also works at Wakad.
    hospitalBranches = [branches.k, { branchId: "h", branchName: "Hadapsar" }];
    doctorBranches = ["k", "w"];
    schedules = [{ dayOfWeek: 2, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: "w" }];
    renderWithProviders(<DoctorSchedule />);
    await screen.findByText(/all at Kothrud/);
    await save();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(saved()).toEqual([expect.objectContaining({ branchId: "w" })]);
  });

  it("a one-branch hospital saves exactly as before", async () => {
    hospitalBranches = [branches.k];
    doctorBranches = [];
    schedules = [{ dayOfWeek: 1, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15, branchId: null }];
    renderWithProviders(<DoctorSchedule />);
    await screen.findByText("Monday");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    await save();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(saved()).toEqual([expect.objectContaining({ branchId: null })]);
  });
});
