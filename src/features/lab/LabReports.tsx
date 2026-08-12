import { useState } from "react";
import { ACCENTS, SEMANTIC, BRAND } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, Grid, Paper, Tabs, Tab, TextField, MenuItem, Typography } from "@mui/material";
import {
  ScienceRounded, CheckCircleRounded, HourglassEmptyRounded, BiotechRounded,
  MonitorHeartRounded, WarningAmberRounded, AccessTimeRounded, CurrencyRupeeRounded,
  SpeedRounded, VerifiedRounded, PendingActionsRounded, TimelapseRounded,
  CrisisAlertRounded, PersonRounded, ReportProblemRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportFilterSelect, ReportTable, useReportFilterOptions, type DateRange } from "@/features/reports/kit";
import dayjs from "dayjs";

const inr = formatINRAuto;
const initialRange = (): DateRange => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const money = (key: string, label: string) => ({ key, label, align: "right" as const, format: (v: any) => inr(v), value: (r: any) => Number(r[key] ?? 0) });
const num = (key: string, label: string) => ({ key, label, align: "right" as const, value: (r: any) => Number(r[key] ?? 0) });

// The lab/radiology aggregate dashboard (also the "Overview" tab and the hub item).
export function LabOverview() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-reports", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/lab/reports", { params: { from: range.from, to: range.to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const p = data?.previous;
  const topTests: any[] = data?.topTests || [];
  const radiologyStatusBreakdown: any[] = data?.radiologyStatusBreakdown || [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Total orders" value={s?.totalOrders || 0} current={s?.totalOrders} previous={p?.totalOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<HourglassEmptyRounded />} accent={SEMANTIC.warning} label="Pending" value={s?.pending || 0} current={s?.pending} previous={p?.pending} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<BiotechRounded />} accent={SEMANTIC.info} label="Sample collected" value={s?.sampleCollected || 0} current={s?.sampleCollected} previous={p?.sampleCollected} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CheckCircleRounded />} accent={SEMANTIC.success} label="Completed" value={s?.completed || 0} current={s?.completed} previous={p?.completed} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology" value={s?.radiologyOrders || 0} current={s?.radiologyOrders} previous={p?.radiologyOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Critical results" value={s?.criticalResults || 0} current={s?.criticalResults} previous={p?.criticalResults} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent={BRAND.actionDark} label="Avg turnaround" value={`${s?.avgTurnaroundHours || 0}h`} current={s?.avgTurnaroundHours} previous={p?.avgTurnaroundHours} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Revenue estimate" value={inr(s?.revenueEstimate)} current={s?.revenueEstimate} previous={p?.revenueEstimate} /></Grid>
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
    queryFn: async () => (await axiosInstance.get("/lab/reports/test-wise", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } })).data.data,
  });
  const labRows: any[] = data?.labRows ?? [];
  const radRows: any[] = data?.radRows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Lab tests performed" value={String(data.totals.labPerformed)} sub={`${data.totals.labTests} distinct`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Lab revenue" value={inr(data.totals.labRevenue)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology scans" value={String(data.totals.radScans)} sub={`${data.totals.radTypes} types`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.info} label="Radiology revenue (est.)" value={inr(data.totals.radRevenue)} /></Grid>
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
                { key: "avgTatHours", label: "Avg TAT (h)", align: "right", value: (r) => Number(r.avgTatHours) },
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
export function Turnaround() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const [sla, setSla] = useState("24");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-turnaround", range.from, range.to, doctorId, sla],
    queryFn: async () => (await axiosInstance.get("/lab/reports/turnaround", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined, slaHours: sla } })).data.data,
  });
  const dist: any[] = data?.distribution ?? [];
  const slowest: any[] = data?.slowest ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <TextField select size="small" label="SLA target" value={sla} onChange={(e) => setSla(e.target.value)} sx={{ minWidth: 120 }}>
          {["12", "24", "48", "72"].map((h) => <MenuItem key={h} value={h}>{h}h</MenuItem>)}
        </TextField>
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SpeedRounded />} accent={BRAND.action} label="Lab avg TAT" value={`${data.lab.avg}h`} sub={`median ${data.lab.median}h · p90 ${data.lab.p90}h`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<VerifiedRounded />} accent={data.lab.slaPct >= 90 ? SEMANTIC.success : data.lab.slaPct >= 75 ? SEMANTIC.warning : SEMANTIC.danger} label={`Lab SLA (≤${sla}h)`} value={`${data.lab.slaPct}%`} sub={`${data.lab.count} completed`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={BRAND.actionDark} label="Radiology avg TAT" value={`${data.radiology.avg}h`} sub={`median ${data.radiology.median}h · p90 ${data.radiology.p90}h`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<VerifiedRounded />} accent={data.radiology.slaPct >= 90 ? SEMANTIC.success : data.radiology.slaPct >= 75 ? SEMANTIC.warning : SEMANTIC.danger} label={`Radiology SLA (≤${sla}h)`} value={`${data.radiology.slaPct}%`} sub={`${data.radiology.count} reported`} /></Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <ReportTable title="Turnaround-time distribution" filename={`lab_tat_distribution_${range.from}_${range.to}`}
              columns={[
                { key: "bucket", label: "Turnaround" },
                num("lab", "Lab orders"),
                num("radiology", "Radiology orders"),
              ]} rows={dist} />
          </Box>

          <ReportTable
            title={`Slowest orders${data.slowestTotal > data.slowestShown ? ` (top ${data.slowestShown} of ${data.slowestTotal})` : ""}`}
            filename={`lab_slowest_${range.from}_${range.to}`}
            emptyText="No completed orders with a measurable turnaround in this period."
            columns={[
              { key: "patient", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "modality", label: "Modality" },
              { key: "detail", label: "Test / scan" },
              { key: "doctor", label: "Ordering doctor" },
              { key: "tatHours", label: "TAT (h)", align: "right", value: (r) => Number(r.tatHours) },
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
    queryFn: async () => (await axiosInstance.get("/lab/reports/pending", { params: { doctorId: doctorId || undefined } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const byStage: any[] = data?.byStage ?? [];
  const aging: any[] = data?.aging ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        {data && <Typography variant="caption" sx={{ color: "text.secondary" }}>Live snapshot as of {data.asOf} · open orders from the last {data.lookbackDays} days</Typography>}
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
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
    queryFn: async () => (await axiosInstance.get("/lab/reports/critical", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Ordering doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
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

// The lab panel's reports page: aggregate Overview + the test-wise drill-down.
export default function LabReports() {
  const [tab, setTab] = useState(0);
  const ACCENT = BRAND.action;
  return (
    <Box>
      <PageHeader title="Lab & Radiology Reports" subtitle="Order volume and turnaround, plus per-test / per-scan detail." />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<ScienceRounded fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<BiotechRounded fontSize="small" />} iconPosition="start" label="Test-Wise" />
          <Tab icon={<SpeedRounded fontSize="small" />} iconPosition="start" label="Turnaround & SLA" />
          <Tab icon={<PendingActionsRounded fontSize="small" />} iconPosition="start" label="Pending & Backlog" />
          <Tab icon={<CrisisAlertRounded fontSize="small" />} iconPosition="start" label="Critical Results" />
        </Tabs>
      </Paper>
      {tab === 0 && <LabOverview />}
      {tab === 1 && <TestWise />}
      {tab === 2 && <Turnaround />}
      {tab === 3 && <Pending />}
      {tab === 4 && <CriticalResults />}
    </Box>
  );
}
