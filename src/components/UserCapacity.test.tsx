import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Where people are added: the logins in use against the hospital's capacity,
 * and — once it is reached — the super admin's message, word for word.
 */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => api.get(...a) }, API_URL: "http://localhost:5000/api" }));

import { UserCapacityChip, UserLimitNotice } from "./UserCapacity";

const capacity = (used: number, limit: number) => ({ data: { data: { used, limit, remaining: Math.max(0, limit - used), source: "plan", planLimit: limit, planName: "FULL PLAN" } } });

beforeEach(() => api.get.mockReset());

describe("user capacity", () => {
  it("shows the logins in use against the limit, and nothing more while there is room", async () => {
    api.get.mockResolvedValue(capacity(35, 50));
    renderWithProviders(<><UserCapacityChip /><UserLimitNotice /></>);
    expect(await screen.findByText("Logins 35 of 50")).toBeTruthy();
    expect(screen.queryByText(/User limit reached/)).toBeNull();
    expect(api.get).toHaveBeenCalledWith("/hospital/users/capacity");
  });

  it("at the limit, says to contact the Super Admin", async () => {
    api.get.mockResolvedValue(capacity(50, 50));
    renderWithProviders(<><UserCapacityChip /><UserLimitNotice /></>);
    expect(await screen.findByText("User limit reached. Please contact your Super Admin to increase your user capacity.")).toBeTruthy();
    expect(screen.getByText("Logins 50 of 50")).toBeTruthy();
  });
});
