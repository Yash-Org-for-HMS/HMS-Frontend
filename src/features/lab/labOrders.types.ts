import type { Money } from "@/types";

/**
 * Order-queue shapes, mirrored from backend/src/modules/lab/lab.service.ts.
 *
 * `status` on an order is DERIVED, not stored: an order is complete once it has
 * reports and none are still blank. So it is a plain string here, not a union
 * over a column that does not exist.
 */

export interface OrderPatientRef {
  patientId: string;
  firstName?: string | null;
  lastName?: string | null;
  uhidNumber?: string | null;
  /** Detail endpoint only — the list payload stops at the name and UHID. */
  dateOfBirth?: string | null;
  genderId?: number | null;
}

export interface OrderDoctorRef {
  doctorId: string;
  qualification?: string | null;
  user?: { firstName?: string | null; lastName?: string | null } | null;
}

/** The catalog test a report is for — joined on, since LabReport stores only the id. */
export interface LabTestRef {
  labTestId: string;
  testCode?: string | null;
  testName?: string | null;
  unit?: string | null;
  defaultNormalRange?: string | null;
  isProfile?: boolean | null;
  chargeItemId?: string | null;
  /** Catalog list price. A Prisma Decimal — Number() it before arithmetic. */
  price?: Money | null;
}

/**
 * One test on a lab order, with its result once entered.
 *
 * The name/code/unit live on the joined `labTest`, not on the report itself,
 * and the range column is `normalRange` — the report row has neither a
 * `testName` nor a `status` of its own.
 */
export interface LabReportRow {
  labReportId: string;
  labOrderId?: string | null;
  labTestId?: string | null;
  labTest?: LabTestRef | null;
  resultValue?: string | null;
  normalRange?: string | null;
  remarks?: string | null;
  isCritical?: boolean | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

export interface LabOrderRow {
  labOrderId: string;
  hospitalId: string;
  branchId?: string | null;
  patientId?: string | null;
  doctorId?: string | null;
  /** Set when the order belongs to an inpatient stay — it bills at discharge. */
  admissionId?: string | null;
  admissionNumber?: string | null;
  sampleBarcode?: string | null;
  sampleCollectedAt?: string | null;
  priorityId?: number | null;
  /** "PAID" | "UNPAID" — gates collection when billing is pre-paid. */
  paymentStatus?: string | null;
  verified?: boolean | null;
  createdAt: string;
  /** Derived from the reports, not a stored column. */
  status?: string | null;
  patient?: OrderPatientRef | null;
  doctor?: OrderDoctorRef | null;
  /**
   * Computed server-side: this order must be paid before the sample can be
   * collected. Always false for an admission-linked order — an inpatient test
   * settles on the discharge bill, never pre-paid at the counter.
   */
  billingLockActive?: boolean;
  reports?: LabReportRow[];
}

/**
 * GET /lab/orders/:id — the queue row plus the pathologist sign-off details and
 * the joined test on every report, which the list path only gained recently.
 */
/** Letterhead fields for the printed report. */
export interface ReportHospitalRef {
  hospitalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  officialPhone?: string | null;
  officialEmail?: string | null;
  logoUrl?: string | null;
}

export interface LabOrderDetail extends LabOrderRow {
  reports: LabReportRow[];
  hospital?: ReportHospitalRef | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  verifiedByPathologistId?: string | null;
}

/** The radiologist's write-up. findings/impression live HERE, not on the order. */
export interface RadiologyReportRow {
  radiologyReportId: string;
  radiologyOrderId?: string | null;
  findings?: string | null;
  impression?: string | null;
  reportUrl?: string | null;
  reportDate?: string | null;
  status?: string | null;
  radiologistUserId?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | null;
}

export interface RadiologyOrderRow {
  radiologyOrderId: string;
  hospitalId: string;
  branchId?: string | null;
  patientId?: string | null;
  doctorId?: string | null;
  admissionId?: string | null;
  admissionNumber?: string | null;
  scanType?: string | null;
  priorityId?: number | null;
  paymentStatus?: string | null;
  orderDate: string;
  status?: string | null;
  radiologistNotes?: string | null;
  reportUrl?: string | null;
  chargeItemId?: string | null;
  consultationId?: string | null;
  /** Priced from the charge item; the endpoint sends it already as a number. */
  amount?: Money | null;
  updatedAt?: string | null;
  reports?: RadiologyReportRow[];
  patient?: OrderPatientRef | null;
  doctor?: OrderDoctorRef | null;
  /** Radiologist sign-off: who signed it and when. */
  verified?: boolean | null;
  verifiedByName?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | null;
  /**
   * Computed server-side: this order must be paid before the scan can be
   * done. Always false for an admission-linked order — an inpatient scan
   * settles on the discharge bill, never pre-paid at the counter.
   */
  billingLockActive?: boolean;
}

/** Priority resolved from the lookup table — null when the order has none. */
export interface OrderPriorityRef {
  code?: string | null;
  label?: string | null;
  color?: string | null;
}

/** A critical result the ordering doctor has not acknowledged yet. */
export interface CriticalAlertRow {
  labReportId: string;
  patientName: string;
  testName: string;
  resultValue?: string | null;
  ageHours: number;
}

/** A queue item on the lab dashboard's backlog list. */
export interface PendingLabRow {
  labOrderId: string;
  patientName: string;
  sampleBarcode?: string | null;
  /** "Awaiting sample" | "In process" — where the order sits on the bench. */
  status: string;
  ageHours: number;
  ageDays: number;
  priority?: OrderPriorityRef | null;
}

export interface PendingRadiologyRow {
  radiologyOrderId: string;
  patientName: string;
  scanType?: string | null;
  status?: string | null;
  ageHours: number;
  ageDays: number;
  priority?: OrderPriorityRef | null;
}

/** A priced row of the lab or radiology catalog, grouped by category. */
export interface CatalogRow {
  chargeItemId?: string | null;
  testCode?: string | null;
  testName?: string | null;
  /** A Prisma Decimal — Number() it before arithmetic. */
  price?: Money | null;
  category?: string | null;
}

export interface LabCatalogRow extends CatalogRow {
  labTestId: string;
  unit?: string | null;
}

export interface RadiologyCatalogRow extends CatalogRow {
  radiologyTestId: string;
}
