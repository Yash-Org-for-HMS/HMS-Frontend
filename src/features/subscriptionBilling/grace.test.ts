import { describe, it, expect } from "vitest";
import { graceText, graceShort } from "./grace";

describe("graceText", () => {
  it("counts the days down and singularises one", () => {
    expect(graceText(5)).toBe("suspends in 5 days");
    expect(graceText(1)).toBe("suspends in 1 day");
  });

  // Zero is today, not "in 0 days" — the server floors the remainder, so a
  // tenant with hours left reads as 0.
  it("says today at zero", () => {
    expect(graceText(0)).toBe("suspends today");
  });

  // Past the grace window a tenant stays listed until their next sign-in flips
  // them, so the row has to explain why it is still here.
  it("explains a tenant whose grace has already run out", () => {
    expect(graceText(-1)).toBe("grace ended 1 day ago — access blocked at next sign-in");
    expect(graceText(-3)).toBe("grace ended 3 days ago — access blocked at next sign-in");
  });

  // A tenant with no overdue invoice carries no countdown, and neither does a
  // payload from before the server sent one.
  it("falls back when there is no countdown to show", () => {
    expect(graceText(null)).toBe("suspends after the grace period");
    expect(graceText(undefined)).toBe("suspends after the grace period");
  });
});

describe("graceShort", () => {
  it("is null with nothing to count, so the caller renders no chip", () => {
    expect(graceShort(null)).toBeNull();
    expect(graceShort(undefined)).toBeNull();
  });

  it("shortens to the number and its unit", () => {
    expect(graceShort(5)).toBe("5 days left");
    expect(graceShort(1)).toBe("1 day left");
    expect(graceShort(0)).toBe("last day");
    expect(graceShort(-2)).toBe("grace ended");
  });
});
