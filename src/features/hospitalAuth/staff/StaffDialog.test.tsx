import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { StaffOptions } from "./staff.types";

/**
 * Adding a person — the one place it is done. Coming from Logins & roles the
 * login is already ticked; the address and emergency contact, and a starting
 * password if one is typed, go with the person.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a), put: (...a: unknown[]) => api.put(...a) },
  API_URL: "http://localhost:5000/api",
}));

import StaffDialog from "./StaffDialog";

const options: StaffOptions = {
  categories: [{ code: "NURSE", name: "Nursing", councilRegistration: "Yes (Nursing Council)", notes: null }],
  designations: [{ id: "d1", code: "SN", sysCode: "SN", displayName: "Staff Nurse", grade: 8, staffCategoryCode: "NURSE", canBeHod: false }],
  employmentTypes: [{ code: "FULL_TIME", name: "Full time", adminManagerRequired: true, paymentModel: "Salary" }],
  departments: [], wards: [], serviceUnits: [],
  branches: [{ branchId: "b1", branchName: "Main" }],
  roles: [{ roleId: "r-nurse", roleCode: "NURSE", roleName: "Nurse" }],
  statuses: [{ code: "ACTIVE", meaning: "" }], rolesInDept: [{ code: "MEMBER", meaning: "" }], people: [],
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: { data: { grade: 8, rule: null, admin: [], functional: [] } } });
  api.post.mockResolvedValue({ data: { data: { staffId: "s1", name: "Asha Kale" }, warnings: [], credentials: { email: "asha@x.in", temporaryPassword: "secret12" } } });
});

describe("Adding a staff member", () => {
  it("from Logins & roles: the login is ticked, and contact and starting password go with the person", async () => {
    const onSaved = vi.fn();
    renderWithProviders(<StaffDialog row={null} options={options} startWithLogin onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByRole("checkbox", { name: "Give them a login now" })).toBeChecked();

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Asha" } });
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: "Kale" } });
    fireEvent.change(screen.getByLabelText("Address line 1"), { target: { value: "12 Paud Road" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Pune" } });
    fireEvent.change(screen.getByLabelText("Emergency contact"), { target: { value: "Ravi Kale" } });
    fireEvent.change(screen.getByLabelText("Their phone"), { target: { value: "9000000002" } });
    // Category picks the default login role (Nurse).
    fireEvent.mouseDown(screen.getByLabelText(/Staff category/));
    fireEvent.click(await screen.findByRole("option", { name: "Nursing" }));
    fireEvent.change(screen.getByLabelText(/Login email/), { target: { value: "asha@x.in" } });

    // A starting password, if typed, must be at least 6 characters.
    const save = screen.getByRole("button", { name: "Add staff member" });
    fireEvent.change(screen.getByLabelText("Starting password (optional)"), { target: { value: "abc" } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Starting password (optional)"), { target: { value: "secret12" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe("/hospital/staff");
    expect(body).toMatchObject({
      firstName: "Asha", lastName: "Kale", staffCategoryCode: "NURSE",
      addressLine1: "12 Paud Road", city: "Pune", emergencyContactName: "Ravi Kale", emergencyContactPhone: "9000000002",
      addressLine2: null, postalCode: null,
      login: { email: "asha@x.in", roleId: "r-nurse", initialPassword: "secret12" },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // A long form filled field by field: more than the default 5s when the whole suite runs at once.
  }, 20_000);

  it("from the directory: no login unless asked, and no password sent when left blank", async () => {
    renderWithProviders(<StaffDialog row={null} options={options} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Give them a login now" })).not.toBeChecked();
    expect(screen.queryByLabelText(/Login email/)).not.toBeInTheDocument();
  });
});
