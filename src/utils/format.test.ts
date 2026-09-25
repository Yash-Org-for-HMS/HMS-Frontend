import { describe, it, expect } from "vitest";
import { axisINR } from "./format";

describe("axisINR — short enough for an axis gutter", () => {
  it("shortens into the units an Indian reader expects", () => {
    expect(axisINR(950)).toBe("₹950");
    expect(axisINR(9500)).toBe("₹9.5k");
    expect(axisINR(38000)).toBe("₹38k");
    expect(axisINR(100000)).toBe("₹1L");
    expect(axisINR(1351551)).toBe("₹13.5L");
    expect(axisINR(72003784)).toBe("₹7.2Cr");
  });

  it("drops a decimal that says nothing", () => {
    // 2.0k is noise; 1.5k is information.
    expect(axisINR(2000)).toBe("₹2k");
    expect(axisINR(1500)).toBe("₹1.5k");
  });

  it("keeps every label shorter than the gutter it has to fit", () => {
    // The bug this exists for: a label longer than the axis is CLIPPED by
    // Recharts, not overflowed — "₹38,000" arrived as "₹8000", which reads as
    // a real number and is wrong by 30,000.
    for (const v of [0, 999, 9500, 38000, 1351551, 72003784, -58522]) {
      expect(axisINR(v).length).toBeLessThanOrEqual(8);
    }
  });

  it("handles nothing, and negatives", () => {
    expect(axisINR(null)).toBe("₹0");
    expect(axisINR(undefined)).toBe("₹0");
    expect(axisINR(-9500)).toBe("₹-9.5k");
  });
});
