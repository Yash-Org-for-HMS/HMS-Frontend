import type { Money } from "@/types";

/**
 * Response shapes for the lab & radiology reports, mirrored from
 * backend/src/modules/lab/labReports.controller.ts.
 *
 * These live beside the feature rather than in the shared `@/types` barrel
 * because nothing else consumes them — a report row is not a domain entity, it
 * is one endpoint's projection, and pretending otherwise is how a shared types
 * file turns into a dumping ground.
 *
 * Money is `Money` (decimal string | number) wherever the controller passes a
 * Prisma Decimal through, and plain `number` where it calls `.toNumber()`
 * first. That distinction is not cosmetic: `Number.isFinite("120.50")` is
 * false, so a decimal string handed to arithmetic helpers silently misbehaves.
 */

/** Rows capped server-side carry the counts needed to say so in the UI. */
export interface Truncatable {
  truncated?: boolean;
  totalRows?: number;
  shownRows?: number;
}

export interface DateRangeEcho {
  from: string;
  to: string;
}

// ── Overview ────────────────────────────────────────────────────────────────

export interface LabOverviewSummary {
  totalOrders: number;
  pending: number;
  sampleCollected: number;
  completed: number;
  radiologyOrders: number;
  criticalResults: number;
  avgTurnaroundHours: number;
  /** `.toNumber()`d server-side, unlike the test-wise revenues below. */
  revenueEstimate: number;
}

export interface TopTestRow {
  testName: string;
  count: number;
}

export interface RadiologyStatusRow {
  status: string;
  count: number;
}

export interface LabOverviewResponse {
  summary: LabOverviewSummary;
  /** Prior comparable period, for the KPI delta chips. */
  previous?: Partial<LabOverviewSummary>;
  trend?: { date: string; orders?: number }[];
  topTests: TopTestRow[];
  radiologyStatusBreakdown: RadiologyStatusRow[];
}

// ── Test-wise ───────────────────────────────────────────────────────────────

export interface LabTestWiseRow {
  test: string;
  performed: number;
  completed: number;
  critical: number;
  revenue: Money;
  avgTatHours: number;
}

export interface RadiologyTypeRow {
  scanType: string;
  ordered: number;
  completed: number;
  revenue: Money;
  avgTatHours: number;
}

export interface TestWiseResponse {
  totals: {
    labTests: number;
    labPerformed: number;
    labRevenue: Money;
    radTypes: number;
    radScans: number;
    radRevenue: Money;
  };
  labRows: LabTestWiseRow[];
  radRows: RadiologyTypeRow[];
  labTruncated?: boolean;
  labTotalRows?: number;
  labShownRows?: number;
  radTruncated?: boolean;
  radTotalRows?: number;
  radShownRows?: number;
}

// ── Turnaround ──────────────────────────────────────────────────────────────

/** One modality's turnaround stats. `count: 0` means nothing to report. */
export interface TatStat {
  count: number;
  avg: number;
  median: number;
  p90: number;
  /** Percentage completed within the SLA hours the caller asked for. */
  slaPct: number;
}

export interface TatDistributionRow {
  bucket: string;
  count: number;
}

export interface SlowestRow {
  patient: string;
  uhid: string;
  modality: string;
  detail: string;
  doctor: string;
  tatHours: number;
  completedOn: string;
}

export interface TurnaroundResponse {
  range: DateRangeEcho;
  slaHours: number;
  lab: TatStat;
  radiology: TatStat;
  distribution: TatDistributionRow[];
  slowest: SlowestRow[];
  slowestShown: number;
  slowestTotal: number;
}

// ── Pending & backlog ───────────────────────────────────────────────────────

export interface PendingRow {
  patient: string;
  uhid: string;
  modality: string;
  stage: string;
  detail: string;
  doctor: string;
  ageHours: number;
  orderedOn: string;
}

export interface StageRow {
  stage: string;
  count: number;
  oldestHours: number;
}

export interface AgingRow {
  bucket: string;
  count: number;
}

export interface PendingResponse extends Truncatable {
  /** A live snapshot, not a date range — the UI says so. */
  asOf: string;
  lookbackDays: number;
  totals: {
    pendingLab: number;
    pendingRadiology: number;
    total: number;
    /** Past the SLA. */
    breaching: number;
    oldestHours: number;
  };
  byStage: StageRow[];
  aging: AgingRow[];
  rows: PendingRow[];
}

// ── Critical results ────────────────────────────────────────────────────────

export interface CriticalRow {
  date: string;
  patient: string;
  uhid: string;
  test: string;
  result: string;
  normalRange: string;
  doctor: string;
  /** "Verified" | "Unverified" — a display string, not a boolean. */
  verified: string;
  /** "Acknowledged" | "Unacknowledged". */
  acknowledged: string;
}

export interface CriticalResponse extends Truncatable {
  range: DateRangeEcho;
  totals: {
    critical: number;
    patients: number;
    unverified: number;
    unacknowledged: number;
  };
  rows: CriticalRow[];
}

// ── Order register ──────────────────────────────────────────────────────────

/**
 * One register line. Lab and radiology share this shape but not every field:
 * `tests`/`testCount`/`barcode`/`collectedOn`/`critical` are lab-only and
 * `scan` is radiology-only, so those are optional rather than split into two
 * near-identical interfaces the table would have to branch on.
 *
 * `tatHours` is null when the order has not been reported yet — that is the
 * distinction between "fast" and "never came back", so it must not collapse to 0.
 */
export interface RegisterRow {
  patient: string;
  uhid: string;
  doctor: string;
  orderedOn: string;
  status: string;
  verified: string;
  reportedOn: string;
  tatHours: number | null;
  amount: Money;
  paymentStatus: string;
  barcode?: string;
  tests?: string;
  testCount?: number;
  critical?: string;
  collectedOn?: string;
  scan?: string;
}

export interface RegisterResponse {
  lab: Truncatable & { rows: RegisterRow[] };
  radiology: Truncatable & { rows: RegisterRow[] };
}
