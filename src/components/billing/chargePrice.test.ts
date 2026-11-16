import { describe, it, expect } from "vitest";
import { chargePriceFor, sidedCharge } from "./chargePrice";

// The preview must price a charge the way the server bills it (soc/branchPrices priceAt).
describe("a picked charge's preview price", () => {
  const icu = {
    basePrice: 3000,
    roomPrices: [{ roomClassId: "PVT", price: 3600 }],
    listPrices: [
      { rateListId: "PAR", roomClassId: "", price: 4500 },
      { rateListId: "PAR", roomClassId: "ICU", price: 5000 },
    ],
  };

  it("takes an insured stay's list price for the room, then for every room", () => {
    expect(chargePriceFor(icu, "ICU", "PAR")).toBe(5000);
    expect(chargePriceFor(icu, "PVT", "PAR")).toBe(4500);
  });

  it("follows the room-class and base prices off the list", () => {
    expect(chargePriceFor(icu, "PVT", "MEDI")).toBe(3600);
    expect(chargePriceFor(icu, "PVT", null)).toBe(3600);
    expect(chargePriceFor(icu, "GEN", null)).toBe(3000);
  });
});

describe("a charge on each side (OP rate / IP rate)", () => {
  const base = { price: 1000, priceAtBilling: false };
  it("OPD is untouched; IPD with no IPD price is the same as OPD", () => {
    expect(sidedCharge({ ...base, ipdPrice: 1500 }, "OPD")).toMatchObject({ price: 1000, priceAtBilling: false });
    expect(sidedCharge(base, "IPD")).toMatchObject({ price: 1000, priceAtBilling: false });
    expect(sidedCharge({ price: 0, priceAtBilling: true }, "IPD")).toMatchObject({ priceAtBilling: true });
  });
  it("IPD takes its own price, or is typed at billing", () => {
    expect(sidedCharge({ ...base, ipdPrice: "1500.00" }, "IPD")).toMatchObject({ price: "1500.00", priceAtBilling: false });
    expect(sidedCharge({ ...base, ipdPriceAtBilling: true }, "IPD")).toMatchObject({ priceAtBilling: true });
    // Typed for OPD, fixed for IPD.
    expect(sidedCharge({ price: 0, priceAtBilling: true, ipdPrice: 500 }, "IPD")).toMatchObject({ price: 500, priceAtBilling: false });
  });
  it("a room-class price still beats the IPD price in the preview", () => {
    const c = sidedCharge({ ...base, ipdPrice: 1200, roomPrices: [{ roomClassId: "icu", price: 1500 }] }, "IPD");
    expect([chargePriceFor(c, "icu"), chargePriceFor(c, "gen")]).toEqual([1500, 1200]);
  });
});
