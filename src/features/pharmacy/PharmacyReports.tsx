import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Box, Grid } from "@mui/material";
import {
  ReceiptLongRounded, CurrencyRupeeRounded, TrendingUpRounded,
  WarningAmberRounded, EventBusyRounded, LocalPharmacyRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportTable, TrendChart, BreakdownBar, type DateRange } from "@/features/reports/kit";

const inr = formatINRAuto;
const fmtDate = (v: any) => (v ? dayjs(v).format("DD MMM YYYY") : "—");

export default function PharmacyReports() {
  const [range, setRange] = useState<DateRange>(() => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") }));

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["pharmacy-reports", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports", { params: { from: range.from, to: range.to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const p = data?.previous;
  const trend: any[] = data?.trend || [];
  const topMedicines: any[] = data?.topMedicines || [];
  const topIpdMedicines: any[] = data?.topIpdMedicines || [];
  const lowStock: any[] = data?.lowStock || [];
  const expiringSoon: any[] = data?.expiringSoon || [];
  const supplierWise: any[] = data?.supplierWise || [];

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Pharmacy Reports"
        subtitle="Dispensary sales over a date range, plus current stock health."
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
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENTS.pharmacy} label="Orders dispensed" value={s?.totalOrders || 0} current={s?.totalOrders} previous={p?.totalOrders} spark={trend.map((t) => t.orders)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Total sales" value={inr(s?.totalSales)} current={s?.totalSales} previous={p?.totalSales} spark={trend.map((t) => t.sales)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.info} label="Avg order value" value={inr(s?.avgOrderValue)} current={s?.avgOrderValue} previous={p?.avgOrderValue} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<LocalPharmacyRounded />} accent={ACCENTS.ipd} label="IPD meds issued" value={inr(s?.ipdMedicationValue)} current={s?.ipdMedicationValue} previous={p?.ipdMedicationValue} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.warning} label="Low stock items" value={s?.lowStockCount || 0} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<EventBusyRounded />} accent={SEMANTIC.danger} label="Expiring in 30 days" value={s?.expiringSoonCount || 0} /></Grid>
          </Grid>

          <TrendChart title="Sales over time" subtitle="Dispensary revenue per day" data={trend} xKey="date" series={[{ key: "sales", label: "Sales (₹)" }]} valueFormatter={inr} height={300} />

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <BreakdownBar title="Top-selling medicines" subtitle="By revenue" data={topMedicines} categoryKey="medicineName" valueKey="revenue" valueName="Revenue" colorIndex={0} valueFormatter={inr} height={320} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <ReportTable title="Top-selling medicines" filename={`pharmacy_top_meds_${range.from}_${range.to}`}
                columns={[
                  { key: "medicineName", label: "Medicine" },
                  { key: "qty", label: "Units", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right", format: (v) => inr(v), value: (r) => Number(r.revenue) },
                ]} rows={topMedicines} />
            </Grid>
          </Grid>

          <ReportTable title="IPD medication issues (confirmed, this range)" filename={`ipd_meds_${range.from}_${range.to}`}
            columns={[
              { key: "medicineName", label: "Medicine" },
              { key: "qty", label: "Units issued", align: "right" },
              { key: "revenue", label: "Value", align: "right", format: (v) => inr(v), value: (r) => Number(r.revenue) },
            ]} rows={topIpdMedicines} emptyText="No IPD medication issues in this period." />

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Low stock (current)" filename="pharmacy_low_stock"
                columns={[
                  { key: "medicineName", label: "Medicine" },
                  { key: "availableQuantity", label: "Available", align: "right" },
                  { key: "reorderLevel", label: "Reorder level", align: "right" },
                ]} rows={lowStock} emptyText="No low-stock items — inventory looks healthy." />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Expiring within 30 days" filename="pharmacy_expiring"
                columns={[
                  { key: "medicineName", label: "Medicine" },
                  { key: "batchNumber", label: "Batch" },
                  { key: "availableQuantity", label: "Qty", align: "right" },
                  { key: "expiryDate", label: "Expiry", format: fmtDate, value: (r) => (r.expiryDate ? new Date(r.expiryDate).getTime() : 0) },
                ]} rows={expiringSoon} emptyText="Nothing expiring in the next 30 days." />
            </Grid>
          </Grid>

          <ReportTable title="Supplier-wise purchasing (this range)" filename={`supplier_wise_${range.from}_${range.to}`}
            columns={[
              { key: "supplierName", label: "Supplier" },
              { key: "poCount", label: "Purchase orders", align: "right" },
              { key: "totalPurchaseValue", label: "Total value", align: "right", format: (v) => inr(v), value: (r) => Number(r.totalPurchaseValue) },
            ]} rows={supplierWise} emptyText="No purchase orders in this period." />
        </Box>
      )}
    </Box>
  );
}
