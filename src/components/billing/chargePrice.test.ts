import { describe, it, expect } from "vitest";
import { chargePriceFor } from "./chargePrice";

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
