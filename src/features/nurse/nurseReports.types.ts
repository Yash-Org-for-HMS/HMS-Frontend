/**
 * GET /nurse/reports — one payload sliced by every sub-report on the page,
 * mirrored from backend/src/modules/nurse/reports.controller.ts.
 *
 * The IPD registers this page also shows (in-patients, discharges, IP
 * registrations) come from the IPD endpoints and are typed in
 * features/ipd/ipdReports.types.ts, not here.
 */

export interface NurseReportSummary {
  totalVitalsRecorded: number;
  abnormalReadings: number;
  uniquePatients: number;
  /** Distinct staff who recorded at least one reading in the window. */
  staffRecording: number;
}

/**
 * One vitals reading. `flags` names the values that fell outside their normal
 * range — it is what makes a row "abnormal", so the abnormal register is the
 * same shape, already filtered.
 */
export interface VitalsRow {
  date: string;
  patientName: string;
  uhid: string;
  temperatureC?: number | null;
  pulse?: number | null;
  /** Pre-joined "120/80" — systolic and diastolic are not sent separately. */
  bp?: string | null;
  oxygenSaturation?: number | null;
  bloodSugarLevel?: number | null;
  painScale?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  recordedBy?: string | null;
  flags?: string[] | null;
}

export interface NurseReportsData {
  range: { from: string; to: string };
  summary: NurseReportSummary;
  previous?: NurseReportSummary | null;
  /** Zero-filled, so a day with no readings is a zero rather than a gap. */
  trend: { date: string; count: number }[];
  vitalsList: VitalsRow[];
  /** The same rows, narrowed to those carrying a flag. */
  abnormalList: VitalsRow[];
  byStaff: { staffName: string; count: number }[];
  truncated: boolean;
  totalRows: number;
  shownRows: number;
}
