import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The bar across the top of every hospital panel: which hospital, which
 * branch, who is signed in and as what — always in view — with search,
 * announcements and the account menu (switch panel, sign out).
 */

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => auth.value }));

import TopBar from "./TopBar";

const logout = vi.fn();
const held = (code: string, primary = true) => ({ code, name: code, branchId: null, branchName: null, primary, pages: null, home: null, actions: [] });
const signedIn = (roles = [held("NURSE")]) => {
  auth.value = {
    user: { firstName: "Manisha", lastName: "Kamble", email: "manisha@zz.test", role: roles[0].code, roleName: "Nurse", roles },
    hospital: { name: "Sanjeevani Multispeciality Hospital", logoUrl: null },
    logout,
    availableBranches: [{ branchId: "b1", branchName: "Hadapsar", branchCode: "HDP" }],
    activeBranchId: "b1",
    isOrgAdmin: false,
    setActiveBranch: vi.fn(),
  };
};

beforeEach(() => { logout.mockReset(); signedIn(); });

describe("TopBar", () => {
  it("names the hospital, the branch, the person and their role", () => {
    renderWithProviders(<TopBar drawerWidth={260} onMenu={() => {}} announcements={{ count: 0, onOpen: () => {} }} />);
    expect(screen.getByText("Sanjeevani Multispeciality Hospital")).toBeTruthy();
    expect(screen.getByText("Hadapsar")).toBeTruthy(); // one branch: named, not a picker
    expect(screen.getByText("Manisha Kamble")).toBeTruthy();
    expect(screen.getByText("Nurse")).toBeTruthy();
  });

  it("opens announcements from the bell, with the unread count", () => {
    const onOpen = vi.fn();
    renderWithProviders(<TopBar drawerWidth={260} onMenu={() => {}} announcements={{ count: 3, onOpen }} />);
    expect(screen.getByText("3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Announcements" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("the account menu signs out, and offers other panels only to someone who has them", () => {
    renderWithProviders(<TopBar drawerWidth={260} onMenu={() => {}} announcements={{ count: 0, onOpen: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByText("manisha@zz.test")).toBeTruthy();
    expect(screen.queryByText(/Switch to/)).toBeNull();
    fireEvent.click(screen.getByText("Sign out"));
    expect(logout).toHaveBeenCalled();
  });

  it("someone who also holds a reception role can switch to that panel", () => {
    signedIn([held("NURSE"), held("RECEPTIONIST", false)]);
    renderWithProviders(<TopBar drawerWidth={260} onMenu={() => {}} announcements={{ count: 0, onOpen: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByText(/Switch to Reception/)).toBeTruthy();
  });
});
