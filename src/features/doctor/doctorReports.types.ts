/**
 * GET /doctor/reports — one payload sliced by every sub-report on the page,
 * mirrored from backend/src/modules/doctor/reports.controller.ts.
 *
 * The whole page shares a single fetch, so each report receives this object and
 * reads its own slice rather than fetching for itself.
 */

/** Headline counts for the range. `previous` is the same shape, for the deltas. */
export interface DoctorReportSummary {
  totalAppointments: number;
  completedAppointments: number;
  totalConsultations: number;
  uniquePatients: number;
  prescriptions: number;
  labOrders: number;
  radiologyOrders: number;
}

/** One consultation as the register lists it. */
export interface ConsultationRegisterRow {
  date: string;
  patientName: string;
  uhid: string;
  diagnosis?: string | null;
  /** How many medicines were written on it, not the medicines themselves. */
  prescriptions: number;
}

export interface DiagnosisCount {
  diagnosis: string;
  count: number;
}

export interface MedicineCount {
  medicineName: string;
  timesPrescribed: number;
  totalQuantity: number;
}

/** Order counts by status — the same shape for lab and radiology. */
export interface StatusCount {
  status: string;
  count: number;
}

/** `label` rather than `gender`: the server resolves the lookup before sending. */
export interface GenderSplitRow {
  label: string;
  count: number;
}

/** One day of the consultation trend. Zero-filled, so every day is present. */
export interface TrendPoint {
  date: string;
  count: number;
}

export interface DoctorReportsData {
  range: { from: string; to: string };
  summary: DoctorReportSummary;
  /** The preceding window of equal length, for period-on-period deltas. */
  previous?: DoctorReportSummary | null;
  consultationsList: ConsultationRegisterRow[];
  /** Set when the register hit the server's row cap; drives the truncation note. */
  truncated: boolean;
  totalRows: number;
  shownRows: number;
  topDiagnoses: DiagnosisCount[];
  topMedicines: MedicineCount[];
  labStatusBreakdown: StatusCount[];
  radStatusBreakdown: StatusCount[];
  genderSplit: GenderSplitRow[];
  trend: TrendPoint[];
}
