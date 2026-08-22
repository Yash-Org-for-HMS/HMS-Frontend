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
