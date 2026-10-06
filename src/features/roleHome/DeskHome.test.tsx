import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * My desk: each desk role held gets its section; someone at no desk in
 * particular sees all four; a section whose figures failed is left out — never
 * drawn empty, which would read as "nothing to do".
 */

const auth = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/useSocket", () => ({ useLiveConnected: () => true }));
const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a) }, API_URL: "http://localhost:5000/api" }));

import DeskHome from "./DeskHome";

const short = { count: 0, rows: [] };
const DATA: Record<string, unknown> = {
  "/role-home/admission-desk": { beds: { total: 4, free: 1, occupied: 2, turnaround: 1 }, waitingForBed: short, reservationsEndingToday: short, dischargesStarted: short },
  "/role-home/billing": { collectedToday: 1200, unpaidBills: { count: 0, totalDue: 0, rows: [] }, finalBillsToMake: short, staysWithoutAdvance: short },
  "/role-home/tpa": { queried: short, preAuthPending: short, ageing: short, insuredWithoutClaim: short, roomsOverLimit: short },
  "/role-home/mrd": { summariesMissing: short, consentsMissing: short, dischargedThisWeek: 0 },
};
const role = (code: string) => ({ role: code, roles: [{ code, name: code, branchId: null, branchName: null, primary: true }] });
const headings = () => ["Admission desk", "Billing", "TPA / insurance desk", "Medical records"].filter((t) => screen.queryByText(t));

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => ({ data: { data: DATA[url] } }));
});

describe("My desk", () => {
  it("a Billing login sees its own desk only, and asks only for it", async () => {
    auth.user = role("BILLING");
    renderWithProviders(<DeskHome />);
    expect(await screen.findByText("Collected today")).toBeInTheDocument();
    expect(headings()).toEqual(["Billing"]);
    expect(get.mock.calls.map(([u]) => u)).toEqual(["/role-home/billing"]);
  });

  it("someone at no desk in particular sees all four", async () => {
    auth.user = role("RECEPTIONIST");
    renderWithProviders(<DeskHome />);
    await waitFor(() => expect(headings()).toHaveLength(4));
  });

  it("a section that failed is left out, with the error saying so", async () => {
    auth.user = role("BILLING");
    get.mockRejectedValue(Object.assign(new Error("boom"), { response: { data: { message: "Database unavailable" } } }));
    renderWithProviders(<DeskHome />);
    expect(await screen.findByText("Couldn't load your desk")).toBeInTheDocument();
    expect(screen.queryByText("Every bill is paid.")).not.toBeInTheDocument();
    expect(headings()).toEqual([]);
  });
});
