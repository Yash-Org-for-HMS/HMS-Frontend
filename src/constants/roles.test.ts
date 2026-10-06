import { describe, it, expect } from "vitest";
import { menuPathsFor, pageOpenFor, homeForUser, panelHomeForUser, hasAction, featuresFor, type RoleHolder } from "./roles";

/**
 * What each role opens — decided on the server (backend lib/roleCatalog.ts) and
 * sent with the login and on every load. The app only applies it: the menu, the
 * pages that open, where a role lands, and the things only some roles may do.
 */

const BILLING_PAGES = ["/reception/dashboard", "/reception/patients", "/reception/ipd/admissions", "/reception/billing", "/reception/reports", "/reception/notifications"];
const held = (code: string, extra: Partial<{ pages: string[] | null; home: string | null; actions: string[] }> = {}, primary = true) =>
  ({ code, name: code, branchId: null, branchName: null, primary, ...extra });

const billing: RoleHolder = { role: "BILLING", roles: [held("BILLING", { pages: BILLING_PAGES, home: null, actions: [] })] };
const receptionist: RoleHolder = { role: "RECEPTIONIST", roles: [held("RECEPTIONIST", { pages: null, home: null, actions: [] })] };

describe("a desk role sees and opens only its desk", () => {
  it("the menu is its pages", () => {
    expect([...menuPathsFor(billing, "reception")!]).toEqual(BILLING_PAGES);
  });

  it("its pages open, with the pages under them; others do not; announcements always do", () => {
    expect(pageOpenFor(billing, "reception", "/reception/billing")).toBe(true);
    expect(pageOpenFor(billing, "reception", "/reception/billing/invoices/i1/ip-bill/print")).toBe(true);
    expect(pageOpenFor(billing, "reception", "/reception/patients/p1/edit")).toBe(true);
    expect(pageOpenFor(billing, "reception", "/reception/claims")).toBe(false);
    expect(pageOpenFor(billing, "reception", "/reception/queue")).toBe(false);
    // A prefix is a whole segment: "/reception/billing" is not "/reception/billing-x".
    expect(pageOpenFor(billing, "reception", "/reception/billing-x")).toBe(false);
    expect(pageOpenFor(billing, "reception", "/reception/announcements")).toBe(true);
  });

  it("lands on its panel's dashboard, which is one of its pages", () => {
    expect(homeForUser(billing)).toBe("/reception/dashboard");
    expect(pageOpenFor(billing, "reception", homeForUser(billing))).toBe(true);
  });
});

describe("everyone else is as before", () => {
  it("an original role has its whole panel", () => {
    expect(menuPathsFor(receptionist, "reception")).toBeNull();
    expect(pageOpenFor(receptionist, "reception", "/reception/claims")).toBe(true);
  });

  it("holding Receptionist as well lifts a desk role's limits", () => {
    const both: RoleHolder = { role: "BILLING", roles: [billing.roles![0], held("RECEPTIONIST", { pages: null, home: null, actions: [] }, false)] };
    expect(menuPathsFor(both, "reception")).toBeNull();
    expect(pageOpenFor(both, "reception", "/reception/claims")).toBe(true);
  });

  it("an admin opens everything and may do everything", () => {
    const admin: RoleHolder = { role: "H_ADMIN", roles: [held("H_ADMIN", { pages: null, home: null, actions: [] })] };
    expect(pageOpenFor(admin, "hospital", "/hospital/audit-logs")).toBe(true);
    expect(hasAction(admin, "anything")).toBe(true);
  });

  it("a session from before roles had features keeps its whole panel until the next load", () => {
    const old: RoleHolder = { role: "BILLING", roles: [held("BILLING")] };
    expect(featuresFor(old, "BILLING")).toBeUndefined();
    expect(menuPathsFor(old, "reception")).toBeNull();
    const older: RoleHolder = { role: "BILLING" };
    expect(menuPathsFor(older, "reception")).toBeNull();
  });
});

describe("what the server sends on load wins over what came with the login", () => {
  it("features from the load replace the login's", () => {
    const u: RoleHolder = { ...billing, features: { BILLING: { pages: ["/reception/dashboard", "/reception/billing"], home: null, actions: ["bill.close"] } } };
    expect(pageOpenFor(u, "reception", "/reception/reports")).toBe(false);
    expect(hasAction(u, "bill.close")).toBe(true);
    expect(hasAction(billing, "bill.close")).toBe(false);
  });

  it("a role's own home is where it lands, in its panel", () => {
    const hr: RoleHolder = { role: "HR_ADMIN", features: { HR_ADMIN: { pages: ["/hospital/staff"], home: "/hospital/staff", actions: [] } } };
    expect(homeForUser(hr)).toBe("/hospital/staff");
    expect(panelHomeForUser(hr, "hospital")).toBe("/hospital/staff");
    expect(pageOpenFor(hr, "hospital", "/hospital/dashboard")).toBe(false);
  });
});
