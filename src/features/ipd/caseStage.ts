/**
 * What stage a case has reached.
 *
 * Split out from the component so the rule about one-export-per-file is
 * satisfied, and because this is a fact about the case rather than a way of
 * drawing it — the operating list may well want to read it too.
 */
export type CaseStage = "BOOKED" | "IN_THEATRE" | "IN_RECOVERY" | "BACK_IN_BED" | "CANCELLED";

export interface JourneyInput {
  status: string;
  patientLocation: string | null;
  bedNumber: string | null;
  theatreName: string | null;
  wheeledInAt?: string | null;
  wheeledOutAt?: string | null;
  signInAt?: string | null;
  signOutAt?: string | null;
}

/**
 * The stage, read from where the patient IS rather than from the case status.
 *
 * Status says what the paperwork thinks; location says where the person is.
 * When they disagree the person wins, because that is the fact a nurse can
 * verify by looking.
 */
export function stageOf(j: JourneyInput): CaseStage {
  if (j.status === "CANCELLED") return "CANCELLED";
  if (j.patientLocation === "OT" || j.patientLocation === "PRE_OP") return "IN_THEATRE";
  if (j.patientLocation === "RECOVERY") return "IN_RECOVERY";
  // A day case has no ward location at all; fall back to the times.
  if (!j.patientLocation) {
    if (j.wheeledOutAt) return "BACK_IN_BED";
    if (j.wheeledInAt) return "IN_THEATRE";
    return "BOOKED";
  }
  return j.wheeledOutAt ? "BACK_IN_BED" : "BOOKED";
}
