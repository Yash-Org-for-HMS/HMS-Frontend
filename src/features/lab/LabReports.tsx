import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, Grid } from "@mui/material";
import {
  ScienceRounded, CheckCircleRounded, HourglassEmptyRounded, BiotechRounded,
  MonitorHeartRounded, WarningAmberRounded, AccessTimeRounded, CurrencyRupeeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportTable, TrendChart, BreakdownBar, DonutChart, type DateRange } from "@/features/reports/kit";
import dayjs from "dayjs";

const inr = formatINRAuto;

export default function LabReports() {
  const [range, setRange] = useState<DateRange>(() => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") }));

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["lab-reports", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/lab/reports", { params: { from: range.from, to: range.to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const p = data?.previous;
  const trend: any[] = data?.trend || [];
  const topTests: any[] = data?.topTests || [];
  const radiologyStatusBreakdown: any[] = data?.radiologyStatusBreakdown || [];

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Lab & Radiology Reports"
        subtitle="Order volume, turnaround time, and top tests over a date range."
        actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      />
      <ReportFilters value={range} onChange={setRange} />

      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<ScienceRounded />} accent={SEMANTIC.success} label="Total orders" value={s?.totalOrders || 0} current={s?.totalOrders} previous={p?.totalOrders} spark={trend.map((t) => t.labOrders)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<HourglassEmptyRounded />} accent={SEMANTIC.warning} label="Pending" value={s?.pending || 0} current={s?.pending} previous={p?.pending} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<BiotechRounded />} accent={SEMANTIC.info} label="Sample collected" value={s?.sampleCollected || 0} current={s?.sampleCollected} previous={p?.sampleCollected} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CheckCircleRounded />} accent={SEMANTIC.success} label="Completed" value={s?.completed || 0} current={s?.completed} previous={p?.completed} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<MonitorHeartRounded />} accent={ACCENTS.lab} label="Radiology" value={s?.radiologyOrders || 0} current={s?.radiologyOrders} previous={p?.radiologyOrders} spark={trend.map((t) => t.radiologyOrders)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Critical results" value={s?.criticalResults || 0} current={s?.criticalResults} previous={p?.criticalResults} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent={ACCENTS.labDark} label="Avg turnaround" value={`${s?.avgTurnaroundHours || 0}h`} current={s?.avgTurnaroundHours} previous={p?.avgTurnaroundHours} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Revenue estimate" value={inr(s?.revenueEstimate)} current={s?.revenueEstimate} previous={p?.revenueEstimate} /></Grid>
          </Grid>

          <TrendChart
            title="Orders over time" subtitle="Lab vs radiology, per day"
            data={trend} xKey="date"
            series={[{ key: "labOrders", label: "Lab orders" }, { key: "radiologyOrders", label: "Radiology orders" }]}
            height={300}
          />

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <BreakdownBar title="Top tests ordered" data={topTests} categoryKey="testName" valueKey="count" valueName="Times ordered" colorIndex={2} height={320} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <DonutChart title="Radiology status" data={radiologyStatusBreakdown} nameKey="status" valueKey="count" height={320} />
            </Grid>
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
