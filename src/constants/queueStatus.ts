/**
 * Live-queue status codes, exactly as seeded into `queueStatuses`
 * (backend `prisma/seedQueueStates.ts`) and returned by `GET /reception/queue`
 * as each token's `statusCode`.
 *
 * Named because the Nursing Station filtered on codes that do not exist
 * ("WAITING", "IN_PROGRESS"). Nothing errored — the filters simply never
 * matched, so the vitals worklist sat empty while patients waited. Compare
 * against these rather than a bare string.
 */
export const QUEUE_STATUS = {
  WAITING_FOR_VITALS: "WAITING_FOR_VITALS",
  READY_FOR_DOCTOR: "READY_FOR_DOCTOR",
  IN_CONSULTATION: "IN_CONSULTATION",
  PHARMACY_PENDING: "PHARMACY_PENDING",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
  CANCELLED: "CANCELLED",
} as const;

export type QueueStatusCode = (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS];

/** Nothing further happens to a token in these states. */
export const TERMINAL_QUEUE_STATUSES: string[] = [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED];

/** Before the doctor — still on the nurse's / front desk's plate. */
export const WAITING_QUEUE_STATUSES: string[] = [
  QUEUE_STATUS.WAITING_FOR_VITALS,
  QUEUE_STATUS.READY_FOR_DOCTOR,
  QUEUE_STATUS.SKIPPED,
];

/**
 * The one definition of "this patient still needs vitals", shared by the
 * Nursing Station dashboard and the nurse queue so a count on one screen can
 * never disagree with the list on the other.
 *
 * `vitalsRecorded` is returned by the queue endpoint per token, so there is no
 * need to ask the API once per patient to find out.
 */
export const needsVitals = (t: any): boolean =>
  !!t?.appointmentId && !t.vitalsRecorded && !TERMINAL_QUEUE_STATUSES.includes(t.statusCode);

/** Vitals are on file for this token's appointment. */
export const hasVitals = (t: any): boolean => !!t?.appointmentId && !!t.vitalsRecorded;

/** Waiting to be seen (pre-consultation, including skipped). */
export const isWaitingForCare = (t: any): boolean => WAITING_QUEUE_STATUSES.includes(t?.statusCode);

/** With the doctor right now. */
export const isInConsultation = (t: any): boolean => t?.statusCode === QUEUE_STATUS.IN_CONSULTATION;
