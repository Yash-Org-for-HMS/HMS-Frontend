import { describe, it, expect } from "vitest";
import { windowsFor, slotsOf, isBusy, elsewhereOn, overlappingWindows } from "./doctorSlots";

const DEF = { startTime: "09:00", endTime: "19:30", slotDurationMinutes: 30 };
const split = [
  { dayOfWeek: 1, startTime: "16:00", endTime: "17:00", slotDurationMinutes: 15 },
  { dayOfWeek: 1, startTime: "10:00", endTime: "11:00", slotDurationMinutes: 30 },
];
const at = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return new Date(2026, 9, 5, h, m).toISOString(); };

describe("booking form slots", () => {
  it("offers every window of the day, in order, each at its own length", () => {
    const slots = slotsOf(windowsFor(split, 1, DEF));
    expect(slots.map((s) => s.time)).toEqual(["10:00", "10:30", "16:00", "16:15", "16:30", "16:45"]);
    expect(slots.find((s) => s.time === "16:15")?.minutes).toBe(15);
  });

  it("uses the default day when the weekday has no hours", () => {
    const slots = slotsOf(windowsFor(split, 2, DEF));
    expect(slots[0].time).toBe("09:00");
    expect(slots.at(-1)?.time).toBe("19:00");
  });

  it("hides slots a booking overlaps, not only the same minute", () => {
    const busy = [{ at: at("10:15"), minutes: 30 }];
    expect(isBusy("10:00", 30, busy)).toBe(true);
    expect(isBusy("10:30", 30, busy)).toBe(true);
    expect(isBusy("11:00", 30, busy)).toBe(false);
  });
});

describe("booking form slots at a branch", () => {
  // Monday: Branch A 10–14, Branch B 14–19.
  const sharma = [
    { dayOfWeek: 1, startTime: "10:00", endTime: "14:00", slotDurationMinutes: 30, branchId: "A" },
    { dayOfWeek: 1, startTime: "14:00", endTime: "19:00", slotDurationMinutes: 30, branchId: "B" },
  ];
  it("offers each branch only its own hours", () => {
    const atB = slotsOf(windowsFor(sharma, 1, DEF, "B")).map((s) => s.time);
    expect(atB[0]).toBe("14:00");
    expect(atB.at(-1)).toBe("18:30");
    expect(slotsOf(windowsFor(sharma, 1, DEF, "A")).map((s) => s.time).at(-1)).toBe("13:30");
  });
  it("offers nothing at a branch the doctor is not at that day, and says where they are", () => {
    expect(windowsFor(sharma, 1, DEF, "C")).toEqual([]);
    expect(elsewhereOn(sharma, 1, "C").map((w) => w.branchId)).toEqual(["A", "B"]);
    // No windows that weekday at all: the default day, wherever.
    expect(windowsFor(sharma, 2, DEF, "C")).toEqual([DEF]);
  });
  it("catches overlapping windows across branches", () => {
    expect(overlappingWindows(sharma)).toBeNull();
    expect(overlappingWindows([...sharma, { dayOfWeek: 1, startTime: "13:00", endTime: "15:00", slotDurationMinutes: 30, branchId: "C" }])).not.toBeNull();
  });
});
