import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Medical records. The MLC register: a case cannot be closed until the police
 * are told. Certificates: a death that is not natural asks for its MLC before
 * it can be issued. The printed certificate: a reprint says DUPLICATE, and a
 * cancelled one is never sent to the printer.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a), put: (...a: unknown[]) => api.put(...a) },
  API_URL: "http://localhost:5000/api",
}));
const printed = vi.hoisted(() => vi.fn());
vi.mock("@/utils/useAutoPrint", () => ({ useAutoPrint: (ready: boolean) => { if (ready) printed(); } }));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (v: unknown) => v }));

import MlcRegister from "./MlcRegister";
import Certificates from "./Certificates";
import PrintCertificate from "./PrintCertificate";

const mlc = (id: string, policePending: boolean) => ({
  mlcId: id, mlcNumber: `MLC/MAIN/2627/000${id}`, patientId: "p1", patientName: "Asha Rao", uhid: "UH-1", caseType: "ROAD_ACCIDENT",
  broughtAt: "2030-03-04T05:00:00.000Z", broughtBy: null, history: "Skid", policeStation: policePending ? null : "Kothrud PS",
  policeIntimatedAt: policePending ? null : "2030-03-04T06:00:00.000Z", policeOfficer: null, firNumber: null, status: "OPEN", closingNote: null, policePending,
});

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  printed.mockReset();
});

describe("Medical records", () => {
  it("a case is closed only once the police have been told", async () => {
    api.get.mockResolvedValue({ data: { data: [mlc("1", true), mlc("2", false)] } });
    renderWithProviders(<MlcRegister />);
    expect(await screen.findByText("Not told yet")).toBeInTheDocument();
    const [pending, told] = screen.getAllByRole("button", { name: "Close" });
    expect(pending).toBeDisabled();
    expect(told).toBeEnabled();
  });

  it("a death that is not natural cannot be issued without its medico-legal case", async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === "/mrd/certificates") return { data: { data: [] } };
      if (url === "/mrd/doctors") return { data: { data: [{ doctorId: "d1", name: "Dr. Iyer" }] } };
      if (url === "/mrd/mlc") return { data: { data: [mlc("1", false)] } };
      return { data: { data: [{ patientId: "p1", firstName: "Asha", lastName: "Rao", uhidNumber: "UH-1" }] } };
    });
    api.post.mockResolvedValue({ data: { data: { certificateId: "c1", certNumber: "DC/MAIN/2627/0001" } } });
    renderWithProviders(<Certificates />);
    fireEvent.click(await screen.findByRole("button", { name: /Issue certificate/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Death" }));
    // Patient, consultant, cause, manner.
    const search = within(dialog).getByLabelText(/^Patient/);
    search.focus();
    fireEvent.change(search, { target: { value: "Asha" } });
    fireEvent.click(await screen.findByText("Asha Rao"));
    fireEvent.mouseDown(within(dialog).getByLabelText(/Certifying consultant/));
    fireEvent.click(await screen.findByRole("option", { name: "Dr. Iyer" }));
    fireEvent.change(within(dialog).getByLabelText(/Immediate cause/), { target: { value: "Head injury" } });
    fireEvent.mouseDown(within(dialog).getByLabelText(/Manner of death/));
    fireEvent.click(await screen.findByRole("option", { name: "Accident" }));
    expect(within(dialog).getByRole("button", { name: "Issue" })).toBeDisabled();
    fireEvent.mouseDown(within(dialog).getByLabelText(/Medico-legal case/));
    fireEvent.click(await screen.findByRole("option", { name: "MLC/MAIN/2627/0001" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/mrd/certificates", expect.objectContaining({ certType: "DEATH", patientId: "p1", doctorId: "d1", mlcId: "1" })));
    expect(await within(dialog).findByText("DC/MAIN/2627/0001")).toBeInTheDocument();
  });

  const sheet = (status: string) => ({
    certificateId: "c1", certNumber: "MC/MAIN/2627/0001", certType: "MEDICAL", status, issuedAt: "2030-03-04T05:00:00.000Z", cancelReason: status === "CANCELLED" ? "Wrong dates" : null,
    mlcNumber: null, details: { diagnosis: "Gastroenteritis", restFrom: "2030-03-04", restTo: "2030-03-06" },
    hospital: { hospitalName: "Sanjeevani Hospital" }, patient: { name: "Asha Rao", uhid: "UH-1", dateOfBirth: "1980-01-01", gender: "Female", address: "Pune" },
    doctor: { name: "Dr. Iyer", registration: "MMC-1", qualification: "MD", department: "Medicine" },
  });
  const renderPrint = () => renderWithProviders(<></>, { wrapper: () => (
    <MemoryRouter initialEntries={["/reception/mrd/certificates/c1/print"]}>
      <Routes><Route path="/reception/mrd/certificates/:id/print" element={<PrintCertificate />} /></Routes>
    </MemoryRouter>
  ) });

  it("a reprint says DUPLICATE", async () => {
    api.get.mockResolvedValue({ data: { data: sheet("ISSUED") } });
    api.post.mockResolvedValue({ data: { data: { printCount: 2, duplicate: true } } });
    renderPrint();
    expect(await screen.findByText("Duplicate copy")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(printed).toHaveBeenCalled();
  });

  it("a cancelled certificate is shown as cancelled and never printed or counted", async () => {
    api.get.mockResolvedValue({ data: { data: sheet("CANCELLED") } });
    renderPrint();
    expect(await screen.findByText(/CANCELLED — not valid/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(printed).not.toHaveBeenCalled();
  });
});
