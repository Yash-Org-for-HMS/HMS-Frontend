import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Grid } from "@mui/material";
import {
  Inventory2Rounded, SavingsRounded, TrendingUpRounded, CategoryRounded, WidgetsRounded,
  EventBusyRounded, WarningAmberRounded, ShoppingCartRounded, LocalShippingRounded, ReplayRounded,
  TrendingDownRounded, BlockRounded, ReceiptLongRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportTable, type DateRange } from "@/features/reports/kit";

const inr = formatINRAuto;
const rangeFrom = (days: number): DateRange => ({ from: dayjs().subtract(days, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const ts = (v: any) => (v ? new Date(v).getTime() : 0);
const money = (key: string, label: string) => ({ key, label, align: "right" as const, format: (v: any) => (v == null ? "—" : inr(v)), value: (r: any) => Number(r[key] ?? 0) });
const num = (key: string, label: string) => ({ key, label, align: "right" as const, value: (r: any) => Number(r[key] ?? 0) });

// ── Stock Valuation (snapshot) ────────────────────────────────────────────────
// Cost is estimated from each medicine's latest purchase price (no cost column
// exists on stock), so retail value is the reliable figure.
export function StockValuation() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-stock-valuation"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/stock-valuation")).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<Inventory2Rounded />} accent={SEMANTIC.success} label="Retail value" value={inr(data.totals.retailValue)} sub={`as of ${data.asOf}`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SavingsRounded />} accent={SEMANTIC.info} label="Est. cost value" value={inr(data.totals.costValue)} sub="from latest purchase price" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent="#8b5cf6" label="Est. margin" value={inr(data.totals.estMargin)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CategoryRounded />} accent={SEMANTIC.warning} label="SKUs / units" value={`${data.totals.skus} / ${data.totals.units}`} /></Grid>
          </Grid>
          <ReportTable
            title="Stock valuation (usable, non-expired)"
            filename={`stock_valuation_${data.asOf}`}
            columns={[
              { key: "medicine", label: "Medicine" },
              num("quantity", "Qty"),
              money("sellingPrice", "Selling price"),
              money("retailValue", "Retail value"),
              money("unitCost", "Est. unit cost"),
              money("costValue", "Est. cost value"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Expiry & Expiry-Loss (snapshot) ───────────────────────────────────────────
export function ExpiryLoss() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-expiry"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/expiry", { params: { window: 90 } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventBusyRounded />} accent={SEMANTIC.danger} label="Expired value (loss)" value={inr(data.totals.expired.value)} sub={`${data.totals.expired.units} units`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<Inventory2Rounded />} accent={SEMANTIC.danger} label="Expired SKUs" value={String(data.totals.expired.skus)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.warning} label={`At-risk value (${data.windowDays}d)`} value={inr(data.totals.nearExpiry.value)} sub={`${data.totals.nearExpiry.units} units`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WidgetsRounded />} accent={SEMANTIC.warning} label="Near-expiry SKUs" value={String(data.totals.nearExpiry.skus)} /></Grid>
          </Grid>
          <ReportTable
            title="Expired & near-expiry batches"
            filename={`expiry_${data.asOf}`}
            columns={[
              { key: "medicine", label: "Medicine" },
              { key: "batchNumber", label: "Batch" },
              { key: "expiryDate", label: "Expiry", format: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"), value: (r) => ts(r.expiryDate) },
              num("quantity", "Qty"),
              money("value", "Value"),
              { key: "status", label: "Status" },
              num("daysToExpiry", "Days"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Purchase vs Consumption (date-ranged) ─────────────────────────────────────
export function PurchaseConsumption() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-purchase-consumption", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/purchase-consumption", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ShoppingCartRounded />} accent={SEMANTIC.warning} label="Purchased value" value={inr(data.totals.purchasedValue)} sub={`${data.totals.purchasedQty} units`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalShippingRounded />} accent={SEMANTIC.success} label="Consumed value" value={inr(data.totals.consumedValue)} sub={`${data.totals.consumedQty} units`} /></Grid>
          </Grid>
          <ReportTable
            title="Purchase vs consumption"
            filename={`purchase_consumption_${range.from}_${range.to}`}
            columns={[
              { key: "medicine", label: "Medicine" },
              num("purchasedQty", "Purchased qty"),
              money("purchasedValue", "Purchased ₹"),
              num("consumedQty", "Consumed qty"),
              money("consumedValue", "Consumed ₹"),
              num("netQty", "Net qty"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Reorder List (snapshot) ───────────────────────────────────────────────────
export function ReorderList() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-reorder"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/reorder")).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} accent={SEMANTIC.danger} label="Items to reorder" value={String(data.totals.itemsBelowReorder)} sub={`as of ${data.asOf}`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WidgetsRounded />} accent={SEMANTIC.warning} label="Total shortfall (units)" value={String(data.totals.totalShortfall)} /></Grid>
          </Grid>
          <ReportTable
            title="Reorder list (at/below reorder level)"
            filename={`reorder_${data.asOf}`}
            columns={[
              { key: "medicine", label: "Medicine" },
              num("available", "Available"),
              num("reorderLevel", "Reorder level"),
              num("shortfall", "Shortfall"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Supplier Ledger (date-ranged) ─────────────────────────────────────────────
export function SupplierLedger() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(89));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-supplier-ledger", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/supplier-ledger", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalShippingRounded />} accent="#8b5cf6" label="Suppliers" value={String(data.totals.suppliers)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={SEMANTIC.info} label="Purchase orders" value={String(data.totals.purchaseOrders)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ShoppingCartRounded />} accent={SEMANTIC.warning} label="Ordered value" value={inr(data.totals.orderedValue)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<Inventory2Rounded />} accent={SEMANTIC.success} label="Received value" value={inr(data.totals.receivedValue)} /></Grid>
          </Grid>
          <ReportTable
            title="Supplier ledger"
            filename={`supplier_ledger_${range.from}_${range.to}`}
            columns={[
              { key: "supplier", label: "Supplier" },
              num("purchaseOrders", "POs"),
              num("items", "Line items"),
              money("orderedValue", "Ordered ₹"),
              money("receivedValue", "Received ₹"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Fast / Slow Movers (date-ranged) ──────────────────────────────────────────
export function Movers() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inv-movers", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports/movers", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Moving items" value={String(data.totals.movingItems)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SavingsRounded />} accent={SEMANTIC.info} label="Consumed value" value={inr(data.totals.consumedValue)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<BlockRounded />} accent={SEMANTIC.danger} label="Dead-stock items" value={String(data.totals.deadStockItems)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingDownRounded />} accent={SEMANTIC.danger} label="Dead-stock value" value={inr(data.totals.deadStockValue)} sub="on-hand, no movement" /></Grid>
          </Grid>
          <ReportTable
            title="Fast / slow movers"
            filename={`movers_${range.from}_${range.to}`}
            columns={[
              { key: "medicine", label: "Medicine" },
              num("consumedQty", "Consumed qty"),
              money("consumedValue", "Consumed ₹"),
              num("onHandQty", "On hand"),
              { key: "status", label: "Movement" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}
