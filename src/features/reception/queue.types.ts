/**
 * A live queue token as GET /reception/queue returns it: the QueueToken row
 * spread whole, plus the status lookup resolved and patient/doctor names
 * denormalised (backend/src/modules/reception/queue.controller.ts).
 *
 * Statuses are lookup rows carrying their own label and colour, which the UI
 * renders directly — that is why `statusCode` is a plain string here rather
 * than a union: the set is data, not a compile-time constant.
 */
export interface QueueTokenRow {
  queueTokenId: string;
  hospitalId: string;
  branchId?: string | null;
  appointmentId: string | null;
  doctorId: string | null;
  /** The token number shown to the patient. */
  displayNumber: number;
  queueStatusId?: number | null;
  vitalsTakenAt?: string | null;
  consultationStartedAt?: string | null;
  consultationEndedAt?: string | null;
  checkedOutAt?: string | null;
  checkedOutBy?: string | null;
  checkoutNote?: string | null;
  createdAt: string;
  updatedAt: string;

  // ── Resolved server-side ──
  /** WAITING_FOR_VITALS | READY_FOR_DOCTOR | IN_CONSULTATION | PHARMACY_PENDING
   *  | COMPLETED | SKIPPED | CANCELLED — "UNKNOWN" when the lookup is missing. */
  statusCode: string;
  statusLabel: string;
  statusColor: string;
  patientId: string | null;
  /** "Walk-in Patient" when the token has no linked appointment. */
  patientName: string;
  doctorName: string;
  /** "First visit" | "Repeat" | "Follow-up". */
  visitType: string;
  vitalsRecorded: boolean;
}

/**
 * What the billing/vitals dialogs are handed off a selected token.
 * appointmentId and patientId are nullable because a walk-in token has no
 * appointment behind it — the dialogs are gated on the id, not on the object.
 */
export interface QueueAppointmentRef {
  appointmentId: string | null;
  patientId: string | null;
  patientName: string;
  /** The token's creation time, used as the receipt's visit date. */
  appointmentDate: string;
}
