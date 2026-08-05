import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Box, Grid, Paper, Tabs, Tab } from "@mui/material";
import {
  ReceiptLongRounded, CurrencyRupeeRounded, TrendingUpRounded,
  WarningAmberRounded, EventBusyRounded, LocalPharmacyRounded,
  Inventory2Rounded, ShoppingCartRounded, ReplayRounded,
  LocalShippingRounded, SwapVertRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportTable, type DateRange } from "@/features/reports/kit";
import { StockValuation, ExpiryLoss, PurchaseConsumption, ReorderList, SupplierLedger, Movers } from "./InventoryReports";

const inr = formatINRAuto;
const fmtDate = (v: any) => (v ? dayjs(v).format("DD MMM YYYY") : "—");

// The sales + stock-health dashboard (also embedded as the "Overview" tab and
// reused as the Pharmacy Overview item in the shared reports hub).
export function PharmacyOverview() {
  const [range, setRange] = useState<DateRange>(() => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") }));

  const { data, isLoading, isError, error, refetch } = useQuery({
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
    <Box>
      <ReportFilters value={range} onChange={setRange} />

      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENTS.pharmacy} label="Orders dispensed" value={s?.totalOrders || 0} current={s?.totalOrders} previous={p?.totalOrders} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<CurrencyRupeeRounded />} accent={SEMANTIC.success} label="Total sales" value={inr(s?.totalSales)} current={s?.totalSales} previous={p?.totalSales} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.info} label="Avg order value" value={inr(s?.avgOrderValue)} current={s?.avgOrderValue} previous={p?.avgOrderValue} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<LocalPharmacyRounded />} accent={ACCENTS.ipd} label="IPD meds issued" value={inr(s?.ipdMedicationValue)} current={s?.ipdMedicationValue} previous={p?.ipdMedicationValue} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.warning} label="Low stock items" value={s?.lowStockCount || 0} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}><KpiCard icon={<EventBusyRounded />} accent={SEMANTIC.danger} label="Expiring in 30 days" value={s?.expiringSoonCount || 0} /></Grid>
          </Grid>

          <ReportTable title="Top-selling medicines" filename={`pharmacy_top_meds_${range.from}_${range.to}`}
            columns={[
              { key: "medicineName", label: "Medicine" },
              { key: "qty", label: "Units", align: "right" },
              { key: "revenue", label: "Revenue", align: "right", format: (v) => inr(v), value: (r) => Number(r.revenue) },
            ]} rows={topMedicines} />

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

// The pharmacy panel's reports page: the sales/stock Overview plus the inventory
// reports (stock valuation, expiry & loss, purchase vs consumption, reorder).
export default function PharmacyReports() {
  const [tab, setTab] = useState(0);
  const ACCENT = ACCENTS.pharmacy;
  return (
    <Box>
      <PageHeader title="Pharmacy Reports" subtitle="Sales, stock valuation, expiry, purchasing and reorder." />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<LocalPharmacyRounded fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<Inventory2Rounded fontSize="small" />} iconPosition="start" label="Stock Valuation" />
          <Tab icon={<EventBusyRounded fontSize="small" />} iconPosition="start" label="Expiry & Loss" />
          <Tab icon={<ShoppingCartRounded fontSize="small" />} iconPosition="start" label="Purchase vs Consumption" />
          <Tab icon={<ReplayRounded fontSize="small" />} iconPosition="start" label="Reorder List" />
          <Tab icon={<LocalShippingRounded fontSize="small" />} iconPosition="start" label="Supplier Ledger" />
          <Tab icon={<SwapVertRounded fontSize="small" />} iconPosition="start" label="Fast / Slow Movers" />
        </Tabs>
      </Paper>
      {tab === 0 && <PharmacyOverview />}
      {tab === 1 && <StockValuation />}
      {tab === 2 && <ExpiryLoss />}
      {tab === 3 && <PurchaseConsumption />}
      {tab === 4 && <ReorderList />}
      {tab === 5 && <SupplierLedger />}
      {tab === 6 && <Movers />}
    </Box>
  );
}
