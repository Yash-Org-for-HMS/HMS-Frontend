import { describe, it, expect } from "vitest";
import { computeDelta, MIN_PCT_BASELINE, DELTA_GOOD, DELTA_BAD, DELTA_FLAT } from "./delta";

describe("computeDelta", () => {
  it("reports a percentage against a large enough baseline", () => {
    const d = computeDelta(120, 100);
    expect(d.mode).toBe("pct");
    expect(d.pct).toBeCloseTo(20);
    expect(d.dir).toBe("up");
    expect(d.color).toBe(DELTA_GOOD);
  });

  // A percentage off a tiny baseline overstates the move: 2 -> 12 is "+500%",
  // which reads like a surge rather than ten extra orders.
  it("switches to an absolute change below the baseline floor", () => {
    const d = computeDelta(12, 2);
    expect(d.mode).toBe("abs");
    expect(d.abs).toBe(10);
    expect(MIN_PCT_BASELINE).toBeGreaterThan(2);
  });

  it("has no opinion without a comparable baseline", () => {
    for (const prev of [null, undefined, 0]) {
      const d = computeDelta(50, prev);
      expect(d.mode).toBe("none");
      expect(d.pct).toBeNull();
      expect(d.color).toBe(DELTA_FLAT);
    }
  });

  it("colours by whether the direction is good for this metric", () => {
    expect(computeDelta(50, 100, true).color).toBe(DELTA_BAD);
    // Falling wait times / cancellations are good news.
    expect(computeDelta(50, 100, false).color).toBe(DELTA_GOOD);
  });

  it("treats a negligible move as flat rather than a direction", () => {
    expect(computeDelta(100.01, 100).dir).toBe("flat");
  });

  /**
   * Money reaches the UI as a decimal STRING (Prisma Decimal serialises that
   * way). `Number.isFinite("120.50")` is false, so a string baseline used to
   * fall straight through the no-baseline guard and return mode "none" — the
   * delta chip silently vanished instead of anything failing.
   *
   * Every call site wraps in Number() today, so this was latent rather than
   * live; the coercion moved into the helper so the next one that forgets is
   * still correct.
   */
  describe("decimal-string input", () => {
    it("computes a delta from decimal strings", () => {
      const d = computeDelta("120.00", "100.00");
      expect(d.mode).toBe("pct");
      expect(d.pct).toBeCloseTo(20);
      expect(d.dir).toBe("up");
    });

    it("gives the same answer for strings as for numbers", () => {
      expect(computeDelta("7500.50", "5000.25")).toEqual(computeDelta(7500.5, 5000.25));
    });

    it("still reports no baseline for a string zero", () => {
      expect(computeDelta("120.00", "0.00").mode).toBe("none");
    });

    it("reports no delta rather than NaN for unparseable input", () => {
      expect(computeDelta("n/a", "100").mode).toBe("none");
      expect(computeDelta("100", "n/a").mode).toBe("none");
    });
  });
});
