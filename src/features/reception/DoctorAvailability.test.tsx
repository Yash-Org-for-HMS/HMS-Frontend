import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

// The booking dialog and the bill are other screens; the cards only open them.
vi.mock("./AppointmentForm", () => ({ default: () => null }));
vi.mock("./BillingModal", () => ({ default: () => null }));

const get = vi.fn();
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...args: unknown[]) => get(...args), post: vi.fn() },
  API_URL: "http://localhost:5000/api",
}));

import DoctorAvailability from "./DoctorAvailability";

/**
 * The badge on each doctor's card says what reception can do with them now —
 * the same thing the card says under it. It said "Available" for anyone
 * working at this branch today, over "Day finished" and "Book anyway", and
 * "Elsewhere" without saying where.
 */
const base = {
  department: "General Medicine", qualification: "MBBS, MD", consultationFee: 600,
  schedule: { startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15 },
  windows: [{ startTime: "10:00", endTime: "14:00", slotDurationMinutes: 15 }],
  elsewhere: [], partLeave: [], usingDefaultHours: false, onLeave: false, leaveReason: null,
  appointmentCount: 2, slotsTotal: 16, slotsBooked: 2, nextFreeSlot: null, dayState: "IN_CLINIC", status: "AVAILABLE",
};
// "All day" elsewhere, so the test does not depend on the clock.
const allDay = (branchName: string) => [{ branchName, startTime: "00:00", endTime: "23:59" }];
const doctors = [
  { ...base, doctorId: "d1", name: "Dr. Free Here", nextFreeSlot: "19:00" },
  { ...base, doctorId: "d2", name: "Dr. Booked Out", slotsBooked: 16, elsewhere: [{ branchName: "Kothrud", startTime: "10:00", endTime: "14:00" }] },
  { ...base, doctorId: "d3", name: "Dr. Done Here", dayState: "FINISHED", elsewhere: allDay("Kothrud") },
  { ...base, doctorId: "d4", name: "Dr. Done Today", dayState: "FINISHED" },
  { ...base, doctorId: "d5", name: "Dr. Not Here", status: "NOT_HERE", windows: [], schedule: null, slotsTotal: 0, elsewhere: [{ branchName: "Hadapsar", startTime: "10:00", endTime: "14:00" }] },
  { ...base, doctorId: "d6", name: "Dr. On Leave", status: "ON_LEAVE", onLeave: true, leaveReason: "Conference" },
];
get.mockResolvedValue({ data: { data: { summary: { total: 6, available: 4, onLeave: 1, noHoursSet: 0, fullyBooked: 3, inClinicNow: 2 }, doctors } } });

// The doctor's card (the banner above the grid names the earliest-free doctor too).
const card = async (name: string) => {
  const papers = (await screen.findAllByText(name)).map((el) => el.closest(".MuiPaper-root") as HTMLElement | null);
  return within(papers.find((p) => p?.querySelector(".MuiAvatar-root"))!);
};

describe("DoctorAvailability badges", () => {
  it("says Available only where there is a free slot, and otherwise says why not", async () => {
    renderWithProviders(<DoctorAvailability />);
    expect((await card("Dr. Free Here")).getByText("Available")).toBeInTheDocument();
    expect((await card("Dr. Booked Out")).getByText("Booked out")).toBeInTheDocument();
    expect((await card("Dr. Done Here")).getByText("Done here")).toBeInTheDocument();
    expect((await card("Dr. Done Today")).getByText("Done for today")).toBeInTheDocument();
    expect((await card("Dr. Not Here")).getByText("At Hadapsar")).toBeInTheDocument();
    expect((await card("Dr. On Leave")).getByText("On leave")).toBeInTheDocument();
    // No green "Available" over a doctor who cannot be booked now.
    for (const name of ["Dr. Booked Out", "Dr. Done Here", "Dr. Done Today", "Dr. Not Here", "Dr. On Leave"]) {
      expect((await card(name)).queryByText("Available")).not.toBeInTheDocument();
    }
  });

  it("says where a doctor who is done here is now, and where a split day continues", async () => {
    renderWithProviders(<DoctorAvailability />);
    const done = await card("Dr. Done Here");
    expect(done.getByText("Done here for today")).toBeInTheDocument();
    expect(done.getByText(/Now at Kothrud until 11:59 PM/)).toBeInTheDocument();
    expect((await card("Dr. Done Today")).getByText("Day finished")).toBeInTheDocument();
    expect((await card("Dr. Booked Out")).getByText(/Also at Kothrud 10:00 AM – 2:00 PM/)).toBeInTheDocument();
  });

  it("counts doctors with no free slot as that, not as booked out", async () => {
    renderWithProviders(<DoctorAvailability />);
    expect(await screen.findByText("3 no free slots")).toBeInTheDocument();
  });
});
