import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The branch a hospital admin is looking at survives a refresh — including
 * "All branches", which used to fall back to their home branch on reload.
 */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => api.get(...a), post: vi.fn() }, API_URL: "http://localhost:5000/api" }));

import { HospitalAuthProvider, useHospitalAuth } from "./HospitalAuthContext";

function Probe() {
  const { activeBranchId, availableBranches } = useHospitalAuth();
  return <div>{availableBranches.length ? `branch:${activeBranchId ?? "all"}` : "loading"}</div>;
}

const signedIn = (role: string) => {
  sessionStorage.clear();
  sessionStorage.setItem("hospitalAccessToken", "t");
  sessionStorage.setItem("hospitalUser", JSON.stringify({ id: "u1", role, firstName: "A", lastName: "B", email: "a@b.in" }));
  sessionStorage.setItem("hospitalInfo", JSON.stringify({ id: "h1", name: "H", code: "H" }));
};
const myBranches = (isOrgAdmin: boolean) => api.get.mockResolvedValue({
  data: { data: { branches: [{ branchId: "kothrud", branchName: "Kothrud" }, { branchId: "wakad", branchName: "Wakad" }], isOrgAdmin, activeBranchId: "kothrud" } },
});
const reload = () => renderWithProviders(<HospitalAuthProvider><Probe /></HospitalAuthProvider>);

beforeEach(() => api.get.mockReset());

describe("the branch picked, across a refresh", () => {
  it("an org admin who chose All branches is still on All branches", async () => {
    signedIn("H_ADMIN");
    sessionStorage.setItem("activeBranchAll", "1");
    myBranches(true);
    reload();
    await waitFor(() => expect(screen.getByText("branch:all")).toBeInTheDocument());
    expect(sessionStorage.getItem("activeBranchId")).toBeNull();
  });

  it("a branch they chose is kept", async () => {
    signedIn("H_ADMIN");
    sessionStorage.setItem("activeBranchId", "wakad");
    myBranches(true);
    reload();
    await waitFor(() => expect(screen.getByText("branch:wakad")).toBeInTheDocument());
  });

  it("with nothing chosen, they start at their home branch", async () => {
    signedIn("H_ADMIN");
    myBranches(true);
    reload();
    await waitFor(() => expect(screen.getByText("branch:kothrud")).toBeInTheDocument());
  });

  it("someone who is not an org admin never lands on All branches", async () => {
    signedIn("NURSE");
    sessionStorage.setItem("activeBranchAll", "1");
    myBranches(false);
    reload();
    await waitFor(() => expect(screen.getByText("branch:kothrud")).toBeInTheDocument());
  });
});
