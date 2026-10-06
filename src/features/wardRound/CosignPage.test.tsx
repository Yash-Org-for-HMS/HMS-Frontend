import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Co-signing: a consultant chooses and co-signs; a resident sees the same list
 * of their own, with nothing to press — only the consultant co-signs.
 */

const auth = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/useSocket", () => ({ useLiveConnected: () => true }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) }, API_URL: "http://localhost:5000/api" }));

import CosignPage from "./CosignPage";

const role = (...codes: string[]) => ({ role: codes[0], roles: codes.map((code, i) => ({ code, name: code, branchId: null, branchName: null, primary: i === 0 })) });
const item = (id: string, kind: string, summary: string, overdue = false) => ({
  cosignId: id, kind, summary, admissionId: "a1", patientId: "p1", patientName: "Asha Rao", uhid: "UH-1", residentName: "Dr. Ravi K",
  createdAt: new Date(Date.now() - 3_600_000).toISOString(), dueAt: new Date(Date.now() + (overdue ? -1 : 20) * 3_600_000).toISOString(), cosignedAt: null, overdue,
});

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: { data: { pending: [item("c1", "MEDICATION", "Medicine: Paracetamol 500 · TDS"), item("c2", "NOTE", "Note: Afebrile", true)], signedToday: [] } } });
  api.post.mockResolvedValue({ data: { data: { signed: 2 } } });
});

describe("Co-sign", () => {
  it("a consultant chooses all and co-signs them in one go", async () => {
    auth.user = role("DOCTOR");
    renderWithProviders(<CosignPage />);
    expect(await screen.findByText("Medicine: Paracetamol 500 · TDS")).toBeInTheDocument();
    expect(screen.getByText("To co-sign")).toBeInTheDocument();
    expect(screen.getByText(/^Overdue/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Choose all"));
    fireEvent.click(screen.getByRole("button", { name: /Co-sign 2/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/ward-round/cosign", { cosignIds: ["c1", "c2"] }));
  });

  it("a resident sees what is waiting, with nothing to press", async () => {
    auth.user = role("DOCTOR_RESIDENT");
    renderWithProviders(<CosignPage />);
    expect(await screen.findByText("Note: Afebrile")).toBeInTheDocument();
    expect(screen.getByText("Waiting for co-sign")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Co-sign/ })).not.toBeInTheDocument();
  });

  it("a resident who is also a consultant co-signs, as the server lets them", async () => {
    auth.user = role("DOCTOR_RESIDENT", "DOCTOR");
    renderWithProviders(<CosignPage />);
    expect(await screen.findByText("Note: Afebrile")).toBeInTheDocument();
    expect(screen.getByText("To co-sign")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Co-sign$/ })).toHaveLength(2);
  });
});
