import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Bed reservations: each hold says who it is for and until when; a hold for a
 * named patient can be admitted straight from the list; extending asks the
 * server for a new hold from now.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...a: unknown[]) => api.get(...a), put: (...a: unknown[]) => api.put(...a) },
  API_URL: "http://localhost:5000/api",
}));
vi.mock("@/providers/ConfirmContext", () => ({ useConfirm: () => async () => true }));
vi.mock("@/components/ipd/AdmitDialog", () => ({ default: ({ prefilledPatientId }: { prefilledPatientId?: string }) => <div>Admitting {prefilledPatientId}</div> }));

import BedReservations from "./BedReservations";

const hold = (bedId: string, patient: { patientId: string; name: string; uhid: string } | null, endingSoon = false) => ({
  bedId, label: `General · ${bedId}`, wardName: "General", reservedUntil: "2030-03-04T15:00:00.000Z", reservedAt: "2030-03-04T05:00:00.000Z",
  reason: patient ? "Planned surgery" : "Held for ICU step-down", patient, endingSoon,
});

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.put.mockResolvedValue({ data: { data: {} } });
  api.get.mockResolvedValue({ data: { data: [hold("b1", { patientId: "p1", name: "Asha Rao", uhid: "UH-1" }, true), hold("b2", null)] } });
});

describe("Bed reservations", () => {
  it("shows who each bed is held for, and admits a named patient from the list", async () => {
    renderWithProviders(<BedReservations />);
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Held for ICU step-down")).toBeInTheDocument();
    expect(screen.getByText(/^Ends /)).toBeInTheDocument();
    // Only the hold with a patient can be admitted from here.
    const admits = screen.getAllByRole("button", { name: "Admit" });
    expect(admits).toHaveLength(1);
    fireEvent.click(admits[0]);
    expect(await screen.findByText("Admitting p1")).toBeInTheDocument();
  });

  it("extends a hold from now, and releases one", async () => {
    renderWithProviders(<BedReservations />);
    await screen.findByText("Asha Rao");
    fireEvent.click(screen.getAllByRole("button", { name: "Extend" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/ipd/beds/b1/reservation", { holdHours: 24 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Release" })[1]);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/ipd/beds/b2/status", { status: "AVAILABLE" }));
  });
});
