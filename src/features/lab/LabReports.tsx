import { useState } from "react";
import { apiGet } from "@/api/client";
import type {
  LabOverviewResponse, TopTestRow, RadiologyStatusRow,
  TestWiseResponse, LabTestWiseRow, RadiologyTypeRow,
  TurnaroundResponse, TatStat, TatDistributionRow, SlowestRow,
  PendingResponse, PendingRow, StageRow, AgingRow,
  CriticalResponse, CriticalRow, RegisterRow,
} from "./labReports.types";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, Grid, TextField, MenuItem, Typography, Alert } from "@mui/material";
import {
  ScienceRounded, CheckCircleRounded, HourglassEmptyRounded, BiotechRounded,
  MonitorHeartRounded, WarningAmberRounded, AccessTimeRounded, CurrencyRupeeRounded,
  SpeedRounded, VerifiedRounded, PendingActionsRounded, TimelapseRounded,
  CrisisAlertRounded, PersonRounded, ReportProblemRounded, } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportFilterSelect, ReportTable, ReportNavLayout, useReportFilterOptions, type DateRange, type ReportGroup } from "@/features/reports/kit";
import dayjs from "dayjs";

const inr = formatINRAuto;
const initialRange = (): DateRange => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const cell = (r: unknown, key: string): unknown => (r as Record<string, unknown>)?.[key];
const money = (key: string, label: string) =>
  ({ key, label, align: "right" as const, format: (v: unknown) => inr(v as number), value: (r: unknown) => Number(cell(r, key) ?? 0) });
const num = (key: string, label: string) =>
  ({ key, label, align: "right" as const, value: (r: unknown) => Number(cell(r, key) ?? 0) });

// The lab/radiology aggregate dashboard (also the "Overview" tab and the hub item).
export function LabOverview() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-reports", range.from, range.to],
    queryFn: () => apiGet<LabOverviewResponse>("/lab/reports", { params: { from: range.from, to: range.to } }),
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const p = data?.previous;
  const topTests: TopTestRow[] = data?.topTests || [];
  const radiologyStatusBreakdown: RadiologyStatusRow[] = data?.radiologyStatusBreakdown || [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Lab orders" value={s?.totalOrders || 0} current={s?.totalOrders} previous={p?.totalOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<HourglassEmptyRounded />} accent={SEMANTIC.warning} label="Pending" value={s?.pending || 0} current={s?.pending} previous={p?.pending} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<BiotechRounded />} accent={SEMANTIC.info} label="Sample collected" value={s?.sampleCollected || 0} current={s?.sampleCollected} previous={p?.sampleCollected} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CheckCircleRounded />} accent={SEMANTIC.success} label="Completed" value={s?.completed || 0} current={s?.completed} previous={p?.completed} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology orders" value={s?.radiologyOrders || 0} current={s?.radiologyOrders} previous={p?.radiologyOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Critical results" value={s?.criticalResults || 0} current={s?.criticalResults} previous={p?.criticalResults} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent={BRAND.actionDark} label="Avg time to result" value={`${s?.avgTurnaroundHours || 0} hrs`} current={s?.avgTurnaroundHours} previous={p?.avgTurnaroundHours} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Lab billed value" value={inr(s?.revenueEstimate)} sub="Priced per order" current={s?.revenueEstimate} previous={p?.revenueEstimate} /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Top tests" filename={`lab_top_tests_${range.from}_${range.to}`}
                columns={[{ key: "testName", label: "Test" }, { key: "count", label: "Times ordered", align: "right" }]} rows={topTests} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Radiology status" filename={`radiology_status_${range.from}_${range.to}`}
                columns={[{ key: "status", label: "Status" }, { key: "count", label: "Count", align: "right" }]} rows={radiologyStatusBreakdown} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// Per-test / per-scan drill-down: volume, revenue, turnaround, critical results.
export function TestWise() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-test-wise", range.from, range.to, doctorId],
    queryFn: () => apiGet<TestWiseResponse>("/lab/reports/test-wise", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } }),
  });
  const labRows: LabTestWiseRow[] = data?.labRows ?? [];
  const radRows: RadiologyTypeRow[] = data?.radRows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Lab tests performed" value={String(data.totals.labPerformed)} sub={`${data.totals.labTests} distinct`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Lab value by test" value={inr(data.totals.labRevenue)} sub="Priced per test" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology scans" value={String(data.totals.radScans)} sub={`${data.totals.radTypes} types`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.info} label="Radiology value by scan" value={inr(data.totals.radRevenue)} sub="Priced per scan (est.)" /></Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <ReportTable
              title="Lab tests"
              filename={`lab_test_wise_${range.from}_${range.to}`}
              columns={[
                { key: "test", label: "Test" },
                num("performed", "Performed"),
                num("completed", "Completed"),
                num("critical", "Critical"),
                { key: "avgTatHours", label: "Avg hours to result", align: "right", value: (r) => Number(r.avgTatHours) },
                money("revenue", "Revenue"),
              ]}
              rows={labRows}
              truncated={data.labTruncated} totalRows={data.labTotalRows} shownRows={data.labShownRows}
            />
          </Box>

          <ReportTable
            title="Radiology by scan type"
            filename={`radiology_scan_wise_${range.from}_${range.to}`}
            emptyText="No radiology orders in this period."
            columns={[
              { key: "scanType", label: "Scan type" },
              num("ordered", "Ordered"),
              num("completed", "Reported"),
              { key: "avgTatHours", label: "Avg TAT (h)", align: "right", value: (r) => Number(r.avgTatHours) },
              money("revenue", "Revenue (est.)"),
            ]}
            rows={radRows}
            truncated={data.radTruncated} totalRows={data.radTotalRows} shownRows={data.radShownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Turnaround & SLA ──────────────────────────────────────────────────────────
// TAT distribution, SLA compliance, avg/median/p90, and the slowest orders — the
// core lab quality view, for lab and radiology side by side.

// With no completed orders the API still returns zeros, and "0 hrs / 0%" reads
// as "instant, and failing every target" — the opposite of "nothing to report".
// So every card falls back to an em dash + a plain sentence when count is 0.
// Sub-hour figures are worded, not printed: a real median can round to 0.0 and
// "half are ready within 0 hrs" is nonsense to read.
const hoursText = (v: unknown) => { const n = Number(v) || 0; return n < 1 ? "under an hour" : `${n} hrs`; };
const avgText = (d?: TatStat) => (!d?.count ? "—" : Number(d.avg) < 1 ? "< 1 hr" : `${d.avg} hrs`);
const spreadText = (d?: TatStat) => (d?.count
  ? `Half are ready within ${hoursText(d.median)} · 9 in 10 within ${hoursText(d.p90)}`
  : "Nothing completed in this period");
const onTimeAccent = (d?: TatStat) => (!d?.count ? NEUTRAL.muted
  : d.slaPct >= 90 ? SEMANTIC.success : d.slaPct >= 75 ? SEMANTIC.warning : SEMANTIC.danger);

export function Turnaround() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const [sla, setSla] = useState("24");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-turnaround", range.from, range.to, doctorId, sla],
    queryFn: () => apiGet<TurnaroundResponse>("/lab/reports/turnaround", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined, slaHours: sla } }),
  });
  const dist: TatDistributionRow[] = data?.distribution ?? [];
  const slowest: SlowestRow[] = data?.slowest ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <TextField select size="small" label="On-time target" value={sla} onChange={(e) => setSla(e.target.value)} sx={{ minWidth: 150 }}
          helperText="Results are counted on-time if ready within this">
          {["12", "24", "48", "72"].map((h) => <MenuItem key={h} value={h}>Within {h} hours</MenuItem>)}
        </TextField>
      </ReportFilters>

      {/* The two modalities are timed from DIFFERENT starting points, so the
          figures below are not directly comparable. Saying so beats letting
          someone conclude radiology is "slower" when it simply starts counting
          earlier — it includes the wait for the patient to attend. */}
      <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
        <strong>How this is measured.</strong> For lab tests, the clock starts when the{" "}
        <strong>sample is collected</strong> and stops when results are entered. For radiology, it starts
        when the scan is <strong>ordered</strong> and stops when the report is filed — so radiology also
        includes the time waiting for the patient to come in. Compare each against its own target rather
        than against the other.
      </Alert>
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {/* Plain words instead of TAT / SLA / p90. "p90" in particular is
                meaningless outside analytics — "9 in 10 within Xh" says the
                same thing and needs no explaining. */}
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SpeedRounded />} accent={BRAND.action}
              label="Lab — average time to result" value={avgText(data.lab)} sub={spreadText(data.lab)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<VerifiedRounded />} accent={onTimeAccent(data.lab)}
              label={`Lab — ready within ${sla} hrs`} value={data.lab.count ? `${data.lab.slaPct}%` : "—"}
              sub={data.lab.count ? `of ${data.lab.count} completed test${data.lab.count === 1 ? "" : "s"}` : "No completed tests in this period"} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.actionDark}
              label="Radiology — average time to report" value={avgText(data.radiology)} sub={spreadText(data.radiology)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<VerifiedRounded />} accent={onTimeAccent(data.radiology)}
              label={`Radiology — ready within ${sla} hrs`} value={data.radiology.count ? `${data.radiology.slaPct}%` : "—"}
              sub={data.radiology.count ? `of ${data.radiology.count} reported scan${data.radiology.count === 1 ? "" : "s"}` : "No reported scans in this period"} /></Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <ReportTable title="How long results took" filename={`lab_tat_distribution_${range.from}_${range.to}`}
              columns={[
                { key: "bucket", label: "Time taken" },
                num("lab", "Lab tests"),
                num("radiology", "Radiology scans"),
              ]} rows={dist} />
          </Box>

          <ReportTable
            title={`Took the longest${data.slowestTotal > data.slowestShown ? ` (slowest ${data.slowestShown} of ${data.slowestTotal})` : ""}`}
            filename={`lab_slowest_${range.from}_${range.to}`}
            emptyText="No completed orders with a measurable turnaround in this period."
            columns={[
              { key: "patient", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "modality", label: "Lab / Radiology" },
              { key: "detail", label: "Test / scan" },
              { key: "doctor", label: "Ordering doctor" },
              { key: "tatHours", label: "Hours taken", align: "right", value: (r) => Number(r.tatHours) },
              { key: "completedOn", label: "Completed" },
            ]}
            rows={slowest}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Pending & Backlog (live snapshot) ─────────────────────────────────────────
// What's open right now: lab orders awaiting collection / in process and
// radiology awaiting a report, with aging buckets and the oldest offenders.
export function Pending() {
  const [doctorId, setDoctorId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-pending", doctorId],
    queryFn: () => apiGet<PendingResponse>("/lab/reports/pending", { params: { doctorId: doctorId || undefined } }),
  });
  const rows: PendingRow[] = data?.rows ?? [];
  const byStage: StageRow[] = data?.byStage ?? [];
  const aging: AgingRow[] = data?.aging ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        {data && <Typography variant="caption" sx={{ color: "text.secondary" }}>Live snapshot as of {data.asOf} · open orders from the last {data.lookbackDays} days</Typography>}
      </Box>
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PendingActionsRounded />} accent={SEMANTIC.warning} label="Lab pending" value={String(data.totals.pendingLab)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology pending" value={String(data.totals.pendingRadiology)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Breaching (> 48h)" value={String(data.totals.breaching)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TimelapseRounded />} accent={BRAND.actionDark} label="Oldest pending" value={`${data.totals.oldestHours}h`} /></Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="By stage" filename="lab_pending_by_stage"
                columns={[{ key: "stage", label: "Stage" }, num("count", "Orders"), { key: "oldestHours", label: "Oldest (h)", align: "right", value: (r) => Number(r.oldestHours) }]}
                rows={byStage} emptyText="Nothing pending — the queue is clear." />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Aging" filename="lab_pending_aging"
                columns={[{ key: "bucket", label: "Age" }, num("lab", "Lab"), num("radiology", "Radiology")]}
                rows={aging} />
            </Grid>
          </Grid>

          <ReportTable title="Oldest pending orders" filename="lab_pending_detail"
            emptyText="Nothing pending — the queue is clear."
            columns={[
              { key: "patient", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "modality", label: "Modality" },
              { key: "stage", label: "Stage" },
              { key: "detail", label: "Test / scan" },
              { key: "doctor", label: "Ordering doctor" },
              { key: "ageHours", label: "Age (h)", align: "right", value: (r) => Number(r.ageHours) },
              { key: "orderedOn", label: "Ordered" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Critical Results register (patient safety) ────────────────────────────────
export function CriticalResults() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-critical", range.from, range.to, doctorId],
    queryFn: () => apiGet<CriticalResponse>("/lab/reports/critical", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } }),
  });
  const rows: CriticalRow[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CrisisAlertRounded />} accent={SEMANTIC.danger} label="Critical results" value={String(data.totals.critical)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonRounded />} accent={BRAND.action} label="Patients affected" value={String(data.totals.patients)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReportProblemRounded />} accent={SEMANTIC.warning} label="Unacknowledged" value={String(data.totals.unacknowledged ?? 0)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReportProblemRounded />} accent={SEMANTIC.info} label="Unverified" value={String(data.totals.unverified)} /></Grid>
          </Grid>
          <ReportTable title="Critical results" filename={`lab_critical_${range.from}_${range.to}`}
            emptyText="No critical results flagged in this period."
            columns={[
              { key: "date", label: "Date" },
              { key: "patient", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "test", label: "Test" },
              { key: "result", label: "Result" },
              { key: "normalRange", label: "Reference range" },
              { key: "doctor", label: "Ordering doctor" },
              { key: "acknowledged", label: "Acknowledged" },
              { key: "verified", label: "Verified" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}


// ── Order Register (every order, line by line) ────────────────────────────────
// The other detail tables here are all filtered slices — slowest N, oldest
// pending, critical only. This is the plain list: every lab order and every
// scan in the period, with patient names, downloadable as-is.
export function OrderRegister() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-register", range.from, range.to, doctorId, status],
    queryFn: async () =>
      (await axiosInstance.get("/lab/reports/register", {
        params: { from: range.from, to: range.to, doctorId: doctorId || undefined, status: status || undefined },
      })).data.data,
    placeholderData: keepPreviousData,
  });
  const labRows: RegisterRow[] = data?.lab?.rows ?? [];
  const radRows: RegisterRow[] = data?.radiology?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="Awaiting collection">Awaiting collection (lab)</MenuItem>
          <MenuItem value="In process">In process (lab)</MenuItem>
          <MenuItem value="Completed">Completed (lab)</MenuItem>
          <MenuItem value="Reported">Reported (radiology)</MenuItem>
        </TextField>
      </ReportFilters>
      {isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : isLoading || !data ? <ReportSkeleton /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Lab orders" value={String(data.totals.labOrders)} sub={`${data.totals.labCompleted} completed`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology orders" value={String(data.totals.radOrders)} sub={`${data.totals.radReported} reported`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Order value" value={inr(Number(data.totals.labValue) + Number(data.totals.radValue))} sub={`${data.totals.unpaid} unpaid`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="With a critical result" value={String(data.totals.labCritical)} /></Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <ReportTable
              title="Lab order register"
              filename={`lab_order_register_${range.from}_${range.to}`}
              emptyText="No lab orders in this period."
              columns={[
                { key: "orderedOn", label: "Ordered" },
                { key: "patient", label: "Patient" },
                { key: "uhid", label: "UHID" },
                { key: "barcode", label: "Barcode" },
                { key: "tests", label: "Tests" },
                num("testCount", "No. of tests"),
                { key: "status", label: "Status" },
                { key: "critical", label: "Critical" },
                { key: "collectedOn", label: "Sample collected" },
                { key: "reportedOn", label: "Reported" },
                { key: "tatHours", label: "Turnaround (h)", align: "right", value: (r) => (r.tatHours == null ? "" : Number(r.tatHours)) },
                { key: "doctor", label: "Ordering doctor" },
                { key: "verified", label: "Verified" },
                money("amount", "Amount"),
                { key: "paymentStatus", label: "Payment" },
              ]}
              rows={labRows}
              truncated={data.lab.truncated} totalRows={data.lab.totalRows} shownRows={data.lab.shownRows}
            />
          </Box>

          <ReportTable
            title="Radiology order register"
            filename={`radiology_order_register_${range.from}_${range.to}`}
            emptyText="No radiology orders in this period."
            columns={[
              { key: "orderedOn", label: "Ordered" },
              { key: "patient", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "scan", label: "Scan" },
              { key: "status", label: "Status" },
              { key: "reportedOn", label: "Reported" },
              { key: "tatHours", label: "Turnaround (h)", align: "right", value: (r) => (r.tatHours == null ? "" : Number(r.tatHours)) },
              { key: "doctor", label: "Ordering doctor" },
              { key: "verified", label: "Verified" },
              money("amount", "Amount"),
              { key: "paymentStatus", label: "Payment" },
            ]}
            rows={radRows}
            truncated={data.radiology.truncated} totalRows={data.radiology.totalRows} shownRows={data.radiology.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// The lab panel's reports page: aggregate Overview + the test-wise drill-down.
const GROUPS: ReportGroup[] = [
  { heading: "Overview", items: [{ key: "overview", label: "Lab & Radiology Overview", Comp: LabOverview }] },
  {
    heading: "Volume",
    items: [
      { key: "test-wise", label: "Test-Wise (Lab & Radiology)", Comp: TestWise },
      { key: "register", label: "Order Register", Comp: OrderRegister },
    ],
  },
  {
    heading: "Operations",
    items: [
      { key: "turnaround", label: "Turnaround Times", Comp: Turnaround },
      { key: "pending", label: "Pending & Backlog", Comp: Pending },
    ],
  },
  { heading: "Patient safety", items: [{ key: "critical", label: "Critical Results", Comp: CriticalResults }] },
];

export default function LabReports() {
  return (
    <ReportNavLayout
      title="Lab & Radiology Reports"
      subtitle="Order volume and turnaround, plus per-test / per-scan detail. Every table is downloadable."
      groups={GROUPS}
      accent={BRAND.action}
    />
  );
}
