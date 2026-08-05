import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Grid } from "@mui/material";
import {
  SouthEastRounded, NorthEastRounded, AccountBalanceRounded, SwapVertRounded,
  TrendingUpRounded, ReceiptLongRounded, LocalOfferRounded, AccountBalanceWalletRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportTable, TrendChart, BreakdownBar, DonutChart, type DateRange } from "@/features/reports/kit";

const inr = formatINRAuto;
const rangeFrom = (days: number): DateRange => ({ from: dayjs().subtract(days, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const ts = (v: any) => (v ? new Date(v).getTime() : 0);
const money = (key: string, label: string) => ({ key, label, align: "right" as const, format: (v: any) => inr(v), value: (r: any) => Number(r[key]) });

// ── Day Book (Cash Book) ──────────────────────────────────────────────────────
// Cash basis: what money physically came in and went out, and through which
// tender. Distinct from Revenue (which is billed/accrual).
export function DayBook() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(0)); // defaults to today
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-day-book", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/day-book", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byMode: any[] = data?.byMode ?? [];
  const bySource: any[] = data?.bySource ?? [];
  const byCollector: any[] = data?.byCollector ?? [];
  const trend: any[] = data?.trend ?? [];
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;
  const modeDonut = byMode.map((m) => ({ mode: m.mode, amount: Number(m.in) })).filter((m) => m.amount > 0);

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SouthEastRounded />} accent={SEMANTIC.success} label="Money in" value={inr(data.totals.cashIn)} current={Number(data.totals.cashIn)} previous={prev ? Number(prev.cashIn) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<NorthEastRounded />} accent={SEMANTIC.danger} label="Money out" value={inr(data.totals.cashOut)} current={Number(data.totals.cashOut)} previous={prev ? Number(prev.cashOut) : undefined} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceRounded />} accent={SEMANTIC.info} label="Net position" value={inr(data.totals.net)} current={Number(data.totals.net)} previous={prev ? Number(prev.net) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SwapVertRounded />} accent="#8b5cf6" label="Movements" value={String(data.totals.movements)} /></Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TrendChart title="Cash flow over time" subtitle="Money in vs out, per day" data={trend} xKey="date"
                series={[{ key: "in", label: "In (₹)" }, { key: "out", label: "Out (₹)" }]} valueFormatter={inr} height={280} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DonutChart title="Collections by tender" data={modeDonut} nameKey="mode" valueKey="amount" valueFormatter={inr} height={280} />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable
                title="Payment-mode reconciliation"
                filename={`daybook_by_mode_${range.from}_${range.to}`}
                maxHeight={320}
                columns={[
                  { key: "mode", label: "Mode" },
                  money("in", "In"),
                  money("out", "Out"),
                  money("net", "Net"),
                  { key: "count", label: "Txns", align: "right" },
                ]}
                rows={byMode}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable
                title="By source"
                filename={`daybook_by_source_${range.from}_${range.to}`}
                maxHeight={320}
                columns={[
                  { key: "source", label: "Source" },
                  money("in", "In"),
                  money("out", "Out"),
                ]}
                rows={bySource}
              />
            </Grid>
          </Grid>

          {byCollector.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <ReportTable
                title="By collector"
                filename={`daybook_by_collector_${range.from}_${range.to}`}
                maxHeight={280}
                columns={[
                  { key: "collector", label: "Collector" },
                  money("in", "Collected"),
                  money("out", "Refunded"),
                  money("net", "Net"),
                ]}
                rows={byCollector}
              />
            </Box>
          )}

          <ReportTable
            title="Cash book ledger"
            filename={`daybook_ledger_${range.from}_${range.to}`}
            columns={[
              { key: "at", label: "Date / time", format: (v) => (v ? dayjs(v).format("DD MMM YY HH:mm") : "—"), value: (r) => ts(r.at) },
              { key: "type", label: "Type" },
              { key: "patientName", label: "Patient" },
              { key: "ref", label: "Reference" },
              { key: "mode", label: "Mode" },
              money("inAmount", "In"),
              money("outAmount", "Out"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Revenue analytics ─────────────────────────────────────────────────────────
// Billed / accrual basis: what was invoiced (regardless of collection). Distinct
// from the Day Book's cash. By category, OPD doctor, and department.
export function RevenueAnalytics() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-revenue", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/revenue", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byCategory: any[] = data?.byCategory ?? [];
  const byDoctor: any[] = data?.byDoctor ?? [];
  const byDepartment: any[] = data?.byDepartment ?? [];
  const trend: any[] = data?.trend ?? [];
  const prev = data?.previous;
  const catDonut = byCategory.map((c) => ({ category: c.category, amount: Number(c.amount) })).filter((c) => c.amount > 0);
  const topDoctors = byDoctor.slice(0, 10).map((d) => ({ doctor: d.doctor, amount: Number(d.amount) }));

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Net revenue (billed)" value={inr(data.totals.net)} current={Number(data.totals.net)} previous={prev ? Number(prev.net) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent="#8b5cf6" label="Gross" value={inr(data.totals.gross)} current={Number(data.totals.gross)} previous={prev ? Number(prev.gross) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalOfferRounded />} accent={SEMANTIC.warning} label="Discount" value={inr(data.totals.discount)} current={Number(data.totals.discount)} previous={prev ? Number(prev.discount) : undefined} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.info} label="Tax (GST)" value={inr(data.totals.tax)} current={Number(data.totals.tax)} previous={prev ? Number(prev.tax) : undefined} /></Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TrendChart title="Billed revenue over time" subtitle="Net per day" data={trend} xKey="date" series={[{ key: "net", label: "Net (₹)" }]} valueFormatter={inr} height={280} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DonutChart title="Revenue by category" data={catDonut} nameKey="category" valueKey="amount" valueFormatter={inr} height={280} />
            </Grid>
          </Grid>

          {topDoctors.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <BreakdownBar title="Top doctors by billed revenue" data={topDoctors} categoryKey="doctor" valueKey="amount" valueName="Revenue" colorIndex={2} valueFormatter={inr} height={300} />
            </Box>
          )}

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Revenue by category" filename={`revenue_by_category_${range.from}_${range.to}`} maxHeight={340}
                columns={[{ key: "category", label: "Category" }, money("amount", "Revenue")]} rows={byCategory} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Revenue by department" filename={`revenue_by_department_${range.from}_${range.to}`} maxHeight={340}
                columns={[{ key: "department", label: "Department" }, money("amount", "Revenue")]} rows={byDepartment} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ReportTable title="Revenue by doctor" filename={`revenue_by_doctor_${range.from}_${range.to}`} maxHeight={360}
                columns={[{ key: "doctor", label: "Doctor" }, money("amount", "Revenue")]} rows={byDoctor} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
