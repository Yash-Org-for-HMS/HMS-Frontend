import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScheduleWeekView, { type WeekWindow } from "./ScheduleWeekView";

/**
 * The doctor's week, drawn from the hours being edited: one block per session
 * at its branch, the weekly hours at each branch, and a clash made visible.
 */

const names: Record<string, string> = { k: "Kothrud", w: "Wakad", "": "Every branch" };
const colours: Record<string, string> = { k: "#2563EB", w: "#0D9488", "": "#64748B" };
const view = (windows: WeekWindow[]) =>
  render(<ScheduleWeekView windows={windows} colourOf={(b) => colours[b]} nameOf={(b) => names[b]} />);

describe("ScheduleWeekView", () => {
  it("adds up each branch's hours for the week", () => {
    view([
      { dayOfWeek: 1, startTime: "09:30", endTime: "13:30", branchId: "k" },
      { dayOfWeek: 1, startTime: "16:30", endTime: "20:00", branchId: "w" },
      { dayOfWeek: 3, startTime: "09:30", endTime: "13:30", branchId: "k" },
    ]);
    expect(screen.getByText("8 h a week")).toBeInTheDocument();      // Kothrud: 4 h + 4 h
    expect(screen.getByText("3 h 30 m a week")).toBeInTheDocument(); // Wakad
  });

  it("labels each session with its branch and time", () => {
    view([{ dayOfWeek: 2, startTime: "17:00", endTime: "19:30", branchId: "k" }]);
    expect(screen.getByText("Kothrud · 5 pm–7:30 pm")).toBeInTheDocument();
  });

  it("outlines sessions that run into each other", () => {
    view([
      { dayOfWeek: 2, startTime: "10:00", endTime: "14:00", branchId: "w" },
      { dayOfWeek: 2, startTime: "13:00", endTime: "19:30", branchId: "k" },
      { dayOfWeek: 4, startTime: "10:00", endTime: "14:00", branchId: "w" },
    ]);
    const outlined = (el: HTMLElement) => el.parentElement!.hasAttribute("data-clash");
    // Drawn Monday first, so Tuesday's Wakad block comes before Thursday's.
    const [tuesday, thursday] = screen.getAllByText("Wakad · 10 am–2 pm");
    expect(outlined(tuesday)).toBe(true);
    expect(outlined(screen.getByText("Kothrud · 1 pm–7:30 pm"))).toBe(true);
    // Thursday's lone session is fine.
    expect(outlined(thursday)).toBe(false);
  });

  it("says so when no day is open", () => {
    view([]);
    expect(screen.getByText(/No hours yet/)).toBeInTheDocument();
  });
});
