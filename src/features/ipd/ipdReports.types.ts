/**
 * The six IPD report payloads, mirrored from
 * backend/src/modules/ipd/reports.controller.ts.
 *
 * Shared by the IPD reports page and the nurse's copies of the same three
 * registers, so both read one declaration of each shape.
 *
 * Every windowed report follows the same envelope: `range`, `totals`, its own
 * `previous` totals for the period-on-period delta, a zero-filled `trend`, and
 * `rows` with a truncation triple. Zero-filled means a quiet day is a row with
 * a zero in it, not a gap — the charts depend on that.
 */

export interface ReportRange {
  from: string;
  to: string;
}

/** Set when the server capped the rows; drives the "showing N of M" note. */
export interface Truncation {
  truncated: boolean;
  totalRows: number;
  shownRows: number;
}

// ── In-patients (as of a date, not a range) ─────────────────────────────────

export interface InPatientRow {
  admissionId: string;
  patientName: string;
  uhid: string;
  bed?: string | null;
  admissionDate: string;
  days: number;
}

export interface InPatientsReport extends Truncation {
  asOf: string;
  totals: { inpatients: number };
  byWard: { ward: string; count: number }[];
  rows: InPatientRow[];
}

// ── Discharges ─────────────────────────────────────────────────────────────

export interface DischargeRow {
  admissionId: string;
  patientName: string;
  uhid: string;
  bed?: string | null;
  admissionDate: string;
  dischargeDate: string;
  lengthOfStay: number;
}

export interface DischargesReport extends Truncation {
  range: ReportRange;
  /** avgStay is in days. */
  totals: { discharges: number; avgStay: number };
  previous?: { discharges: number; avgStay: number } | null;
  trend: { date: string; discharges: number }[];
  rows: DischargeRow[];
}

// ── IP registrations (admissions raised in the window) ──────────────────────

export interface IpRegistrationRow {
  patientName: string;
  uhid: string;
  bed?: string | null;
  admissionDate: string;
  status: string;
}

export interface IpRegistrationsReport extends Truncation {
  range: ReportRange;
  totals: { admissions: number };
  previous?: { admissions: number } | null;
  trend: { date: string; admissions: number }[];
  rows: IpRegistrationRow[];
}

// ── IP advances (deposits taken) ───────────────────────────────────────────

export interface IpAdvanceRow {
  patientName: string;
  uhid: string;
  date: string;
  /** A Prisma Decimal on the wire — Number() before arithmetic. */
  amount: string | number;
  method?: string | null;
}

export interface IpAdvancesReport extends Truncation {
  range: ReportRange;
  totals: { count: number; total: string | number };
  previous?: { count: number; total: string | number } | null;
  trend: { date: string; amount: string | number }[];
  rows: IpAdvanceRow[];
}

// ── Occupancy ──────────────────────────────────────────────────────────────

/**
 * No truncation triple here: `rows` is one entry per day of the window, so its
 * length is the window, not a page of records.
 */
export interface OccupancyReport {
  range: ReportRange;
  totals: {
    totalBeds: number;
    avgOccupancy: number;
    peakOccupied: number;
    /** Average length of stay, in days. */
    alos: number;
    discharges: number;
    /** Discharges per bed over the window. */
    turnover: number;
  };
  previous?: { alos: number; discharges: number } | null;
  rows: { date: string; occupied: number; occupancyRate: number }[];
}

// ── Overdue medication doses (live, not windowed) ──────────────────────────

export interface OverdueDoseRow {
  patientName: string;
  uhid: string;
  bed?: string | null;
  medicine: string;
  dosage?: string | null;
  route?: string | null;
  scheduledAt: string;
  hoursOverdue: number;
  /** The admission's status — a dose can outlive the stay it belongs to. */
  admissionStatus?: string | null;
}

export interface OverdueDosesReport extends Truncation {
  asOf: string;
  /** Minutes past the scheduled time before a dose counts as overdue. */
  graceMins: number;
  totals: { overdueDoses: number; patients: number };
  rows: OverdueDoseRow[];
}
