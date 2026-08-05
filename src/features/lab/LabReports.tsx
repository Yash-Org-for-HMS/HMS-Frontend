import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, Grid, Paper, Tabs, Tab } from "@mui/material";
import {
  ScienceRounded, CheckCircleRounded, HourglassEmptyRounded, BiotechRounded,
  MonitorHeartRounded, WarningAmberRounded, AccessTimeRounded, CurrencyRupeeRounded,
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
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={ACCENTS.lab} label="Radiology" value={s?.radiologyOrders || 0} current={s?.radiologyOrders} previous={p?.radiologyOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Critical results" value={s?.criticalResults || 0} current={s?.criticalResults} previous={p?.criticalResults} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent={ACCENTS.labDark} label="Avg turnaround" value={`${s?.avgTurnaroundHours || 0}h`} current={s?.avgTurnaroundHours} previous={p?.avgTurnaroundHours} higherIsBetter={false} /></Grid>
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
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={ACCENTS.lab} label="Radiology scans" value={String(data.totals.radScans)} sub={`${data.totals.radTypes} types`} /></Grid>
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

// The lab panel's reports page: aggregate Overview + the test-wise drill-down.
export default function LabReports() {
  const [tab, setTab] = useState(0);
  const ACCENT = ACCENTS.lab;
  return (
    <Box>
      <PageHeader title="Lab & Radiology Reports" subtitle="Order volume and turnaround, plus per-test / per-scan detail." />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<ScienceRounded fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<BiotechRounded fontSize="small" />} iconPosition="start" label="Test-Wise" />
        </Tabs>
      </Paper>
      {tab === 0 && <LabOverview />}
      {tab === 1 && <TestWise />}
    </Box>
  );
}
