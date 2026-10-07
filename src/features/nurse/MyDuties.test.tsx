import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * A nurse's own shifts: the next two weeks, day by day, from /roster/mine —
 * the shift, its hours and the ward, or "Off".
 */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => api.get(...a) }, API_URL: "http://localhost:5000/api" }));

import MyDuties from "./MyDuties";

const today = dayjs().format("YYYY-MM-DD");
const inDays = (n: number) => dayjs(today).add(n, "day").format("YYYY-MM-DD");

beforeEach(() => {
  api.get.mockReset();
  api.get.mockResolvedValue({ data: { data: [
    { dutyDate: today, shiftName: "Morning", shiftStart: "07:00", shiftEnd: "14:00", wardName: "General Ward" },
    { dutyDate: inDays(2), shiftName: "Night", shiftStart: "20:00", shiftEnd: "08:00", wardName: "ICU" },
  ] } });
});

describe("My duties", () => {
  it("asks for two weeks from today and lists each day's shift, or Off", async () => {
    renderWithProviders(<MyDuties />);
    expect(await screen.findByText("Morning · 07:00–14:00 · General Ward")).toBeTruthy();
    expect(screen.getByText("Night · 20:00–08:00 · ICU")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getAllByText("Off")).toHaveLength(12); // 14 days, 2 on duty
    expect(api.get).toHaveBeenCalledWith("/roster/mine", { params: { from: today, days: 14 } });
  });

  it("says so when nothing is planned", async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<MyDuties />);
    expect(await screen.findByText(/No shifts on the roster for you/)).toBeTruthy();
  });
});
