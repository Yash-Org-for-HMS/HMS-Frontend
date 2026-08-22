import type { Money } from "@/types";

/**
 * Response shapes for the IPD screens, mirrored from
 * backend/src/modules/ipd/admissions.service.ts.
 *
 * Money is `Money` (decimal string | number) wherever a Prisma Decimal passes
 * through — Number() it before arithmetic.
 */

/** Bed, room and ward resolved into one label for display. */
export interface BedRef {
  bedNumber?: string | null;
  bedType?: string | null;
  dailyCharge?: Money | null;
  roomNumber?: string | null;
  wardName?: string | null;
  /** "Ward · Room · Bed 3" — what the list and the bill both print. */
  label?: string | null;
}

/**
 * One row of GET /ipd/admissions: the Admission spread whole, plus the patient,
 * doctor and bed resolved and the deposit balance summed.
 */
export interface AdmissionRow {
  admissionId: string;
  hospitalId: string;
  branchId?: string | null;
  patientId?: string | null;
  doctorId?: string | null;
  bedId?: string | null;
  admissionNumber?: string | null;
  admittingDiagnosis?: string | null;
  reason?: string | null;
  notes?: string | null;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  dischargeSummary?: string | null;
  /** Why a leftover advance was kept at discharge. Null = nobody said. */
  advanceHoldReason?: string | null;
  status: string;
  patientName: string;
  uhid: string;
  doctorName?: string | null;
  bed?: BedRef | null;
  /** Whole days of stay so far, or null before admission. */
  days?: number | null;
  /** COLLECTED − APPLIED − REFUNDED. Positive on a closed admission = owed back. */
  depositBalance: Money;
}

/** One bed the patient occupied, and what it costs — the discharge bill's basis. */
export interface BedSegment {
  bedId?: string | null;
  label: string;
  dailyCharge: Money;
  from: string;
  to: string;
  days: number;
  amount: Money;
}

/** A clinical charge accrued during the stay, waiting to roll onto the bill. */
export interface PendingCharge {
  description: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  category?: string | null;
  taxPercent?: Money;
  taxAmount?: Money;
  hsnCode?: string | null;
  chargeItemId?: string | null;
  itemDate?: string | null;
}

/** GET /ipd/admissions/:id — the row above plus everything discharge needs. */
export interface AdmissionDetail extends AdmissionRow {
  bedSegments: BedSegment[];
  /** Bed charge for the whole stay, summed across segments. */
  estimatedBedCharge: Money;
  pendingCharges: PendingCharge[];
  pendingChargesTotal: Money;
  roomClassId?: string | null;
  roomClassName?: string | null;
  deposits?: { entryType: string; amount: Money; createdAt?: string }[];
}

/**
 * The slice of a claim the discharge dialog reads — enough to show what the
 * payer has approved against this admission before the bill is raised.
 */
export interface AdmissionClaimRef {
  claimId: string;
  claimNumber?: string | null;
  status?: string | null;
  /** Approved at pre-authorisation; what the payer is expected to cover. */
  preAuthApprovedAmount?: Money | null;
}

/** A room class the discharge bill can be priced against. */
export interface RoomClassRef {
  roomClassId: string;
  name: string;
  isActive: boolean;
}

/**
 * Chart shapes for the treatment chart / ward file, mirrored from
 * backend/src/modules/ipd/{observations,fluidBalance,handover}.controller.ts.
 */

/**
 * A hospital-defined observation column, on top of the fixed vitals.
 *
 * `dataType` decides how a reading is stored and whether the normal range
 * applies at all — only NUMBER fields can fall outside normalLow/normalHigh.
 */
export interface ObservationFieldDef {
  observationFieldId: string;
  fieldKey: string;
  label: string;
  dataType: string;
  unit?: string | null;
  minValue: number | null;
  maxValue: number | null;
  normalLow: number | null;
  normalHigh: number | null;
  choices: string[] | null;
  wardTypes: string[] | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * One set of vitals. A correction never overwrites: it writes a new row and
 * points the old one at it via supersededByObservationId, so the chart filters
 * superseded rows out rather than the server deleting them.
 */
export interface ObservationRow {
  observationId: string;
  observedAt: string;
  temperature?: number | null;
  temperatureUnit?: string | null;
  pulseRate?: number | null;
  respiratoryRate?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  spo2?: number | null;
  bloodSugar?: number | null;
  painScore?: number | null;
  remark?: string | null;
  recordedAt?: string | null;
  recordedBy?: string | null;
  correctsId?: string | null;
  correctionReason?: string | null;
  supersededByObservationId?: string | null;
  /** Values for the hospital's own fields, keyed by observationFieldId. */
  extras?: Record<string, string | number | null>;
}

export interface ObservationsResponse {
  from: string;
  to: string;
  observations: ObservationRow[];
  /** Live columns first, then any retired one this window still needs. */
  fields: ObservationFieldDef[];
}

/** One intake or output event. Corrections supersede, as with observations. */
export interface FluidEntryRow {
  fluidEntryId: string;
  occurredAt: string;
  direction: string;
  fluidType?: string | null;
  label?: string | null;
  volumeMl: number;
  occurrences?: number | null;
  notes?: string | null;
  recordedBy?: string | null;
  correctsId?: string | null;
  correctionReason?: string | null;
  supersededByEntryId?: string | null;
}

export interface FluidTotals {
  intakeMl: number;
  outputMl: number;
  balanceMl: number;
  medicationIntakeMl: number;
  previousBalanceMl: number;
  runningBalanceMl: number;
}

/** A doctor's round on this admission. `charge` is what the visit bills at. */
export interface DoctorVisitRow {
  visitId: string;
  admissionId?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  visitDate: string;
  notes?: string | null;
  status?: string | null;
  charge?: Money | null;
  recordedBy?: string | null;
  createdAt?: string | null;
}

export interface NursingNoteRow {
  nursingNoteId: string;
  noteText: string;
  author?: string | null;
  createdAt: string;
  /** True when the signed-in nurse wrote it — gates the edit affordance. */
  mine?: boolean;
}

export interface HandoverNote {
  handoverEntryId: string;
  noteText: string;
  author?: string | null;
  createdAt: string;
}

/** One role's sign-off. `by`/`at` are null until it is signed. */
export interface HandoverSignOff {
  role: string;
  signed: boolean;
  by?: string | null;
  at?: string | null;
}

export interface HandoverShift {
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  handoverId?: string | null;
  notes: HandoverNote[];
  signOffs: HandoverSignOff[];
  fullySigned: boolean;
}
