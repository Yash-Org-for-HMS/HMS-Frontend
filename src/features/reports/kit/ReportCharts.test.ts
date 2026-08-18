import { describe, it, expect } from "vitest";
import { hasPlottableData } from "./ReportCharts";

/**
 * The trend payloads are zero-filled across the whole selected range, so
 * `rows.length > 0` is always true and tells you nothing. Guarding on length
 * rendered an empty grid beside the report's own "No data for this period"
 * table; this is the test that actually distinguishes the two.
 */
describe("hasPlottableData", () => {
  it("is false for an all-zero zero-filled series", () => {
    const zeroFilled = [
      { date: "2026-08-01", amount: 0 },
      { date: "2026-08-02", amount: 0 },
      { date: "2026-08-03", amount: 0 },
    ];
    expect(zeroFilled.length > 0).toBe(true); // what the old guard checked
    expect(hasPlottableData(zeroFilled, ["amount"])).toBe(false);
  });

  it("is true as soon as one day has a value", () => {
    const rows = [
      { date: "2026-08-01", amount: 0 },
      { date: "2026-08-02", amount: 1200 },
    ];
    expect(hasPlottableData(rows, ["amount"])).toBe(true);
  });

  it("reads decimal strings, which is how money arrives", () => {
    expect(hasPlottableData([{ date: "d", amount: "0.00" }], ["amount"])).toBe(false);
    expect(hasPlottableData([{ date: "d", amount: "0.50" }], ["amount"])).toBe(true);
  });

  it("is true when any one of several series has data", () => {
    const rows = [{ date: "d", orders: 0, sales: 940 }];
    expect(hasPlottableData(rows, ["orders", "sales"])).toBe(true);
    expect(hasPlottableData(rows, ["orders"])).toBe(false);
  });

  it("counts a negative value as plottable — a refund day is not an empty day", () => {
    expect(hasPlottableData([{ date: "d", amount: -500 }], ["amount"])).toBe(true);
  });

  it("handles empty, null and undefined input", () => {
    expect(hasPlottableData([], ["amount"])).toBe(false);
    expect(hasPlottableData(null, ["amount"])).toBe(false);
    expect(hasPlottableData(undefined, ["amount"])).toBe(false);
  });

  it("is false when the key is absent from every row", () => {
    expect(hasPlottableData([{ date: "d", other: 5 }], ["amount"])).toBe(false);
  });
});
