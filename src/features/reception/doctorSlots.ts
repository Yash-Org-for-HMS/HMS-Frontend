/**
 * The times a doctor can be booked on a day — the browser's copy of the rules
 * in HMS-Backend/src/modules/reception/doctorSlots.ts, which the server checks
 * every booking against. Keep the two in step.
 *
 * - Every window of the weekday counts (10:00–14:00 and 16:00–19:00), each at
 *   its own slot length. No window that weekday → the default working day.
 * - A slot is taken when any of the doctor's bookings — at any branch — overlaps
 *   it, not only one starting the same minute.
 */
export interface HoursWindow { startTime: string; endTime: string; slotDurationMinutes: number }
export interface ScheduleRow extends HoursWindow { doctorId?: string | null; dayOfWeek: number }
export interface Busy { at: string; minutes: number }

const mins = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 0;
};
const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

/** The doctor's windows on that weekday, earliest first, or the default day. */
export function windowsFor(rows: ScheduleRow[], dayOfWeek: number, fallback: HoursWindow): HoursWindow[] {
  const own = rows.filter((r) => r.dayOfWeek === dayOfWeek).sort((a, b) => mins(a.startTime) - mins(b.startTime));
  return own.length ? own : [fallback];
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

/** Does a slot starting at `time` for `minutes` overlap any booking? */
export function isBusy(time: string, minutes: number, busy: Busy[]): boolean {
  const t = mins(time);
  return busy.some((b) => {
    const d = new Date(b.at);
    const s = d.getHours() * 60 + d.getMinutes();
    return t < s + (Number(b.minutes) || 30) && s < t + minutes;
  });
}
