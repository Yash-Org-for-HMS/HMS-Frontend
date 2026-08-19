import { describe, it, expect } from "vitest";
import { actionBuckets, daysUntil, EXPIRY_WINDOW_DAYS } from "./actionNeeded";

// A fixed "now" so the boundary cases are exact rather than dependent on the
// hour the suite happens to run.
const NOW = new Date("2026-08-19T12:00:00.000Z").getTime();
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const trial = (id: string, status: string, endsInDays: number) => ({
  hospitalTrialId: id, trialStatus: status, trialEndDate: inDays(endsInDays),
});
const hospital = (id: string, o: Partial<{ status: string; subscriptionState: string; officialPhone: string; addressLine1: string; registrationNumber: string }> = {}) => ({
  hospitalId: id,
  status: o.status ?? "active",
  subscriptionState: o.subscriptionState,
  // Complete by default; a test opts into missing fields explicitly.
  officialPhone: "officialPhone" in o ? o.officialPhone : "9999999999",
  addressLine1: "addressLine1" in o ? o.addressLine1 : "1 Main St",
  registrationNumber: "registrationNumber" in o ? o.registrationNumber : "REG-1",
});

describe("trial buckets", () => {
  it("lists a trial ending inside the window as expiring", () => {
    const r = actionBuckets([trial("t1", "active", 3)], [], NOW);
    expect(r.expiring.map((t) => t.hospitalTrialId)).toEqual(["t1"]);
    expect(r.expired).toEqual([]);
  });

  it("includes the window boundary and excludes beyond it", () => {
    const r = actionBuckets(
      [trial("edge", "active", EXPIRY_WINDOW_DAYS), trial("beyond", "active", EXPIRY_WINDOW_DAYS + 1)],
      [], NOW,
    );
    expect(r.expiring.map((t) => t.hospitalTrialId)).toEqual(["edge"]);
  });

  it("treats a trial ending today as expiring, not expired", () => {
    const r = actionBuckets([trial("today", "active", 0)], [], NOW);
    expect(r.expiring.map((t) => t.hospitalTrialId)).toEqual(["today"]);
    expect(r.expired).toEqual([]);
  });

  // THE regression. The status flip is a job, so an active trial can sit past
  // its end date. With no lower bound it appeared under "expiring soon", where
  // the row template renders any non-positive day count as "Expires today" —
  // a trial that lapsed a month ago read as expiring today.
  it("puts a lapsed-but-still-active trial in expired, not expiring", () => {
    const r = actionBuckets([trial("lapsed", "active", -30)], [], NOW);
    expect(r.expiring).toEqual([]);
    expect(r.expired.map((t) => t.hospitalTrialId)).toEqual(["lapsed"]);
  });

  // Bounding the window above must not make these vanish — off the page is
  // worse than mislabelled.
  it("never drops a lapsed trial from both buckets", () => {
    const r = actionBuckets([trial("lapsed", "active", -1)], [], NOW);
    expect(r.expiring.length + r.expired.length).toBe(1);
  });

  it("keeps genuinely expired trials", () => {
    const r = actionBuckets([trial("e1", "expired", -10)], [], NOW);
    expect(r.expired.map((t) => t.hospitalTrialId)).toEqual(["e1"]);
  });

  it("orders expiring soonest-first and expired most-recent-first", () => {
    const r = actionBuckets(
      [trial("a", "active", 5), trial("b", "active", 1), trial("c", "expired", -20), trial("d", "expired", -2)],
      [], NOW,
    );
    expect(r.expiring.map((t) => t.hospitalTrialId)).toEqual(["b", "a"]);
    expect(r.expired.map((t) => t.hospitalTrialId)).toEqual(["d", "c"]);
  });

  it("ignores a trial that is neither active nor expired", () => {
    const r = actionBuckets([trial("conv", "converted", -3)], [], NOW);
    expect(r.expiring).toEqual([]);
    expect(r.expired).toEqual([]);
  });
});

describe("tenant buckets", () => {
  it("catches a tenant suspended only by computed state", () => {
    // The DB column flips lazily, so status can still read "active".
    const r = actionBuckets([], [hospital("h1", { status: "active", subscriptionState: "suspended" })], NOW);
    expect(r.suspended.map((h) => h.hospitalId)).toEqual(["h1"]);
  });

  it("does not list a suspended tenant as merely overdue", () => {
    const r = actionBuckets([], [hospital("h1", { status: "suspended", subscriptionState: "overdue" })], NOW);
    expect(r.suspended.map((h) => h.hospitalId)).toEqual(["h1"]);
    expect(r.overdue).toEqual([]);
  });

  it("flags an incomplete profile on any one missing field", () => {
    const r = actionBuckets([], [
      hospital("noPhone", { officialPhone: "" }),
      hospital("noAddr", { addressLine1: "" }),
      hospital("noReg", { registrationNumber: "" }),
      hospital("complete"),
    ], NOW);
    expect(r.incomplete.map((h) => h.hospitalId).sort()).toEqual(["noAddr", "noPhone", "noReg"]);
  });
});

describe("distinct counting", () => {
  // THE other regression. One tenant, two problems, was counted twice.
  it("counts a tenant once when it is both suspended and incomplete", () => {
    const r = actionBuckets([], [
      hospital("h1", { status: "active", subscriptionState: "suspended", officialPhone: "" }),
    ], NOW);
    expect(r.suspended).toHaveLength(1);
    expect(r.incomplete).toHaveLength(1);
    // The naive sum would be 2.
    expect(r.hospitalCount).toBe(1);
    expect(r.total).toBe(1);
  });

  it("counts a tenant once when it is both overdue and incomplete", () => {
    const r = actionBuckets([], [
      hospital("h1", { status: "active", subscriptionState: "overdue", addressLine1: "" }),
    ], NOW);
    expect(r.overdue).toHaveLength(1);
    expect(r.incomplete).toHaveLength(1);
    expect(r.hospitalCount).toBe(1);
  });

  it("still counts genuinely separate tenants separately", () => {
    const r = actionBuckets([], [
      hospital("h1", { status: "suspended" }),
      hospital("h2", { status: "active", subscriptionState: "overdue" }),
      hospital("h3", { status: "active", registrationNumber: "" }),
    ], NOW);
    expect(r.hospitalCount).toBe(3);
  });

  it("adds trials and tenants into the total", () => {
    const r = actionBuckets(
      [trial("t1", "active", 2), trial("t2", "expired", -5)],
      [hospital("h1", { status: "suspended" })],
      NOW,
    );
    expect(r.trialCount).toBe(2);
    expect(r.hospitalCount).toBe(1);
    expect(r.total).toBe(3);
  });

  // The total gates the "All clear" panel, so a false non-zero would hide it.
  it("is zero when nothing needs attention", () => {
    const r = actionBuckets([trial("t1", "active", 90)], [hospital("h1")], NOW);
    expect(r.total).toBe(0);
  });
});

describe("daysUntil", () => {
  it("is positive in the future, negative in the past, zero today", () => {
    expect(daysUntil(inDays(3), NOW)).toBe(3);
    expect(daysUntil(inDays(-3), NOW)).toBe(-3);
    expect(daysUntil(inDays(0), NOW)).toBe(0);
  });
});
