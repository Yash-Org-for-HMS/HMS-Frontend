/**
 * The times a doctor can be booked on a day — the browser's copy of the rules
 * in HMS-Backend/src/modules/reception/doctorSlots.ts, which the server checks
 * every booking against. Keep the two in step.
 *
 * - Every window of the weekday counts (10:00–14:00 and 16:00–19:00), each at
 *   its own slot length. No window that weekday → the default working day.
 * - A window can name its branch. At a branch, the day is that branch's windows
 *   (and any at every branch); windows only at other branches mean the doctor is
 *   not here that day.
 * - A slot is taken when any of the doctor's bookings — at any branch — overlaps
 *   it, or part-day leave does, not only one starting the same minute.
 */
export interface HoursWindow { startTime: string; endTime: string; slotDurationMinutes: number }
export interface ScheduleRow extends HoursWindow { doctorId?: string | null; dayOfWeek: number; branchId?: string | null }
export interface Busy { at: string; minutes: number; leave?: boolean }

const mins = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 0;
};
const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const earliestFirst = (a: HoursWindow, b: HoursWindow) => mins(a.startTime) - mins(b.startTime);

/**
 * The doctor's windows on that weekday at a branch, earliest first, or the
 * default day when they have none that weekday. Empty when their windows that
 * day are all at other branches (`branchId` null/undefined = anywhere).
 */
export function windowsFor(rows: ScheduleRow[], dayOfWeek: number, fallback: HoursWindow, branchId?: string | null): HoursWindow[] {
  const day = rows.filter((r) => r.dayOfWeek === dayOfWeek);
  if (!day.length) return [fallback];
  if (!branchId) return [...day].sort(earliestFirst);
  return day.filter((r) => !r.branchId || r.branchId === branchId).sort(earliestFirst);
}

/** The doctor's windows that day at other branches — where they are instead. */
export function elsewhereOn(rows: ScheduleRow[], dayOfWeek: number, branchId?: string | null): ScheduleRow[] {
  if (!branchId) return [];
  return rows.filter((r) => r.dayOfWeek === dayOfWeek && r.branchId && r.branchId !== branchId).sort(earliestFirst);
}

/** Every slot the windows yield, as { time: "HH:mm", minutes: slot length }. */
export function slotsOf(windows: HoursWindow[]): { time: string; minutes: number }[] {
  const out = new Map<number, number>();
  for (const w of windows) {
    const step = Number(w.slotDurationMinutes) || 30;
    for (let t = mins(w.startTime); t < mins(w.endTime); t += step) if (!out.has(t)) out.set(t, step);
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([t, minutes]) => ({ time: hhmm(t), minutes }));
}

/** Does a slot starting at `time` for `minutes` overlap any booking (or part-day leave)? */
export function isBusy(time: string, minutes: number, busy: Busy[]): boolean {
  const t = mins(time);
  return busy.some((b) => {
    const d = new Date(b.at);
    const s = d.getHours() * 60 + d.getMinutes();
    return t < s + (Number(b.minutes) || 30) && s < t + minutes;
  });
}

/** Two windows on the same day that overlap, whatever their branches (the schedule editor's check). */
export function overlappingWindows<T extends ScheduleRow>(rows: T[]): [T, T] | null {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.dayOfWeek === b.dayOfWeek && mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime)) return [a, b];
    }
  }
  return null;
}
