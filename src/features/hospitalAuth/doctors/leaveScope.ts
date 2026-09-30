/**
 * Where and when a doctor's leave applies: every branch or one, the whole day
 * or part of it. The form is LeaveScopeFields; these are its value and wording.
 */

export interface LeaveScope { branchId: string; partDay: boolean; startTime: string; endTime: string }
export const EMPTY_LEAVE_SCOPE: LeaveScope = { branchId: "", partDay: false, startTime: "09:00", endTime: "13:00" };

/** The request fields for a scope (empty branch = every branch; no times = the whole day). */
export function leaveScopeBody(s: LeaveScope) {
  return { branchId: s.branchId || null, startTime: s.partDay ? s.startTime : null, endTime: s.partDay ? s.endTime : null };
}

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** "10:00 AM – 12:00 PM · Main Branch", or "" for a whole day at every branch. */
export function leaveScopeLabel(
  leave: { branchId?: string | null; startTime?: string | null; endTime?: string | null },
  branchName: (id: string) => string | undefined,
): string {
  return [
    leave.startTime && leave.endTime ? `${fmt12(leave.startTime)} – ${fmt12(leave.endTime)}` : null,
    leave.branchId ? branchName(leave.branchId) ?? "One branch" : null,
  ].filter(Boolean).join(" · ");
}
