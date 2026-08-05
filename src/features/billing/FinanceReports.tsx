import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Grid } from "@mui/material";
import {
  SouthEastRounded, NorthEastRounded, AccountBalanceRounded, SwapVertRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportTable, TrendChart, DonutChart, type DateRange } from "@/features/reports/kit";

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
