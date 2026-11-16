import { describe, it, expect } from "vitest";
import { offlineSave, pageWorksOffline } from "./offlineScope";
import { isNetworkFailure } from "./offlineState";

describe("what keeps working without the network", () => {
  it("marks the main desks' pages, and only those", () => {
    for (const p of ["/reception/billing", "/reception/patients/new", "/doctor/consultation/abc-123", "/nurse/chart/xyz", "/pharmacy/pos", "/hospital/ipd/beds", "/nurse/ipd/beds", "/reception/queue?tab=2"]) {
      expect(pageWorksOffline(p)).toBe(true);
    }
    for (const p of ["/hospital/reports", "/reception/claims", "/hospital/soc", "/pharmacy/inventory", "/reception/patients/abc"]) {
      expect(pageWorksOffline(p)).toBe(false);
    }
  });

  it("queues the main saves, and not their look-alikes", () => {
    expect(offlineSave("post", "/billing/invoices/p1")?.label).toBe("OPD bill");
    expect(offlineSave("POST", "/pharmacy/orders")?.label).toBe("Medicine sale");
    expect(offlineSave("post", "/ipd/admissions/a1/observations")?.label).toBe("Observations");
    expect(offlineSave("put", "/reception/appointments/a1/checkin")?.label).toBe("Check-in");
    // The preview is a read, a refund is money going back - neither waits.
    expect(offlineSave("post", "/billing/invoices/p1/preview")).toBeUndefined();
    expect(offlineSave("post", "/reception/billing/invoices/i1/refund")).toBeUndefined();
    expect(offlineSave("post", "/ipd/admissions/a1/discharge")).toBeUndefined();
    expect(offlineSave("get", "/reception/patients")).toBeUndefined();
  });

  it("tells a missing network from a refusal", () => {
    expect(isNetworkFailure({ code: "ERR_NETWORK" })).toBe(true);
    expect(isNetworkFailure({ response: { status: 503 } })).toBe(true);
    expect(isNetworkFailure({ response: { status: 400 } })).toBe(false);
    expect(isNetworkFailure({ code: "ERR_CANCELED" })).toBe(false);
  });
});
