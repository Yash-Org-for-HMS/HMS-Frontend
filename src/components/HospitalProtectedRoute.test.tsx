import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * The page guard: within a panel, a role opens only its pages. A Billing login
 * that types the claims address lands on its dashboard; a Receptionist opens
 * claims as always.
 */

const auth = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ isAuthenticated: true, loading: false, user: auth.user, activeBranchId: "k" }),
}));

import { HospitalProtectedRoute } from "./HospitalProtectedRoute";

const pages = ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/billing", "/reception/reports", "/reception/notifications"];
const role = (code: string, p: string[] | null) => ({ code, name: code, branchId: null, branchName: null, primary: true, pages: p, home: null, actions: [] });

function open(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<HospitalProtectedRoute panel="reception" />}>
          <Route path="/reception/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/reception/claims" element={<div>Claims page</div>} />
          <Route path="/reception/billing" element={<div>Billing page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("HospitalProtectedRoute — pages within a panel", () => {
  it("a Billing login typing the claims address lands on its dashboard", () => {
    auth.user = { role: "BILLING", roles: [role("BILLING", pages)] };
    open("/reception/claims");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("Claims page")).not.toBeInTheDocument();
  });

  it("its own pages open", () => {
    auth.user = { role: "BILLING", roles: [role("BILLING", pages)] };
    open("/reception/billing");
    expect(screen.getByText("Billing page")).toBeInTheDocument();
  });

  it("a Receptionist opens claims as always", () => {
    auth.user = { role: "RECEPTIONIST", roles: [role("RECEPTIONIST", null)] };
    open("/reception/claims");
    expect(screen.getByText("Claims page")).toBeInTheDocument();
  });
});
