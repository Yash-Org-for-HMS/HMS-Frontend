import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Grid, TextField, Tabs, Tab, Autocomplete, Chip } from "@mui/material";
import {
  AccountBalanceWalletRounded, ReceiptLongRounded, PaymentsRounded,
  TrendingUpRounded, PersonRounded, SavingsRounded, Inventory2Rounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { ACCENTS, SEMANTIC, BRAND } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportTable, type DateRange } from "@/features/reports/kit";

const ACCENT = BRAND.action;
const inr = formatINRAuto;
const rangeFrom = (days: number): DateRange => ({ from: dayjs().subtract(days, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const fmtDate = (v: any) => (v ? dayjs(v).format("DD MMM YYYY") : "—");
const ts = (v: any) => (v ? new Date(v).getTime() : 0);
const money = (key: string, label: string) => ({ key, label, align: "right" as const, format: (v: any) => inr(v), value: (r: any) => Number(r[key]) });

export default function BillingReports() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader title="Billing Reports" subtitle="Outstanding dues, patient statements, receipts, and service revenue" />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 } }}>
          <Tab icon={<AccountBalanceWalletRounded fontSize="small" />} iconPosition="start" label="Outstanding" />
          <Tab icon={<PersonRounded fontSize="small" />} iconPosition="start" label="Patient Statement" />
          <Tab icon={<ReceiptLongRounded fontSize="small" />} iconPosition="start" label="Receipts" />
          <Tab icon={<TrendingUpRounded fontSize="small" />} iconPosition="start" label="Service-Wise" />
          <Tab icon={<Inventory2Rounded fontSize="small" />} iconPosition="start" label="Pharmacy Expense" />
        </Tabs>
      </Paper>
      {tab === 0 && <Outstanding />}
      {tab === 1 && <PatientStatement />}
      {tab === 2 && <Receipts />}
      {tab === 3 && <ServiceWise />}
      {tab === 4 && <PharmacyExpense />}
    </Box>
  );
}

export function Receipts() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(6));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-receipts", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/receipts", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.success} label="Collected" value={inr(data.totals.gross)} current={Number(data.totals.gross)} previous={prev ? Number(prev.gross) : undefined} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Receipts" value={String(data.totals.count)} current={data.totals.count} previous={prev?.count} /></Grid>
          </Grid>
          <ReportTable
            title="Receipt ledger"
            filename={`receipts_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: (v) => dayjs(v).format("DD MMM YY HH:mm"), value: (r) => ts(r.date) },
              { key: "invoiceNumber", label: "Invoice" },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "method", label: "Method" },
              { key: "reference", label: "Reference" },
              { key: "collector", label: "Collector" },
              money("amount", "Amount"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function Outstanding() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(89));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-outstanding", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/outstanding", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.danger} label="Total dues" value={inr(data.totals.totalDues)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Invoices" value={String(data.totals.invoices)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.info} label="Billed" value={inr(data.totals.totalBilled)} /></Grid>
          </Grid>
          <ReportTable
            title="Outstanding invoices"
            filename={`outstanding_${range.from}_${range.to}`}
            columns={[
              { key: "invoiceNumber", label: "Invoice" },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "invoiceDate", label: "Date", format: fmtDate, value: (r) => ts(r.invoiceDate) },
              money("netAmount", "Net"),
              money("paidAmount", "Paid"),
              money("balance", "Balance"),
              { key: "statusLabel", label: "Status" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// Refund status chip — derived from the ledger, so it can't drift from reality.
function refundStatusChip(s: string) {
  const c = s === "Refunded" ? { bg: "rgba(16,185,129,0.14)", fg: "#0f9d78" }
    : s === "Partially refunded" ? { bg: "rgba(245,158,11,0.16)", fg: "#b45309" }
    : { bg: "rgba(239,68,68,0.12)", fg: "#dc2626" };
  return <Chip label={s} size="small" sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />;
}

// Advance deposits owed BACK to patients: closed (discharged/cancelled) admissions
// with a held deposit. Read-only oversight — shows a ledger-derived refund status
// (Pending / Partially refunded / Refunded); refunds are processed in the admission
// deposit flow, and this reflects them automatically. Snapshot.
export function UnreturnedAdvances() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-unreturned-advances"],
    queryFn: async () => (await axiosInstance.get("/reception/reports/unreturned-advances")).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.danger} label="Owed to patients" value={inr(data.totals.totalOwed)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={SEMANTIC.warning} label="Pending refunds" value={String(data.totals.pending)} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.success} label="Refunded" value={String(data.totals.refunded)} /></Grid>
          </Grid>
          <ReportTable
            title="Unreturned advances (deposits to refund)"
            filename="unreturned_advances"
            emptyText="No unreturned advances — every closed admission's deposit is settled."
            columns={[
              { key: "admissionNumber", label: "Admission" },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "closedOn", label: "Closed", format: fmtDate, value: (r) => ts(r.closedOn) },
              money("collected", "Collected"),
              money("refunded", "Refunded"),
              money("amountOwed", "Owed back"),
              { key: "refundStatus", label: "Status", format: (v) => refundStatusChip(v), value: (r) => r.refundStatus },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function ServiceWise() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-service-wise", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/service-wise", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Total revenue" value={inr(data.totals.total)} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Services" value={String(data.totals.services)} /></Grid>
          </Grid>
          <ReportTable
            title="Service-wise revenue"
            filename={`service_wise_${range.from}_${range.to}`}
            columns={[
              { key: "service", label: "Service" },
              { key: "quantity", label: "Qty", align: "right" },
              money("amount", "Amount"),
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}

export function PharmacyExpense() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-pharmacy-expense", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/pharmacy-expense", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<Inventory2Rounded />} accent={SEMANTIC.warning} label="Total spend" value={inr(data.totals.total)} current={Number(data.totals.total)} previous={prev ? Number(prev.total) : undefined} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Purchase orders" value={String(data.totals.purchaseOrders)} current={data.totals.purchaseOrders} previous={prev?.purchaseOrders} higherIsBetter={false} /></Grid>
          </Grid>
          <ReportTable
            title="Purchase orders"
            filename={`pharmacy_expense_${range.from}_${range.to}`}
            columns={[
              { key: "orderDate", label: "Order date", format: fmtDate, value: (r) => ts(r.orderDate) },
              { key: "supplier", label: "Supplier" },
              { key: "status", label: "Status" },
              money("amount", "Amount"),
            ]}
            rows={rows}
            emptyText="No purchase orders in this period."
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function PatientStatement() {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data: options = [] } = useQuery({
    queryKey: ["billing-patient-search", term],
    queryFn: async () => (await axiosInstance.get("/reception/patients", { params: { search: term, limit: 10 } })).data.data ?? [],
    enabled: term.trim().length >= 2,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-patient-statement", selected?.patientId],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${selected.patientId}/billing-summary`)).data.data,
    enabled: !!selected?.patientId,
  });
  const rows: any[] = data?.invoices ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <Autocomplete
          sx={{ minWidth: 340 }} size="small"
          options={options}
          getOptionLabel={(o: any) => o ? `${o.firstName} ${o.lastName} · ${o.uhidNumber}` : ""}
          isOptionEqualToValue={(a: any, b: any) => a.patientId === b.patientId}
          filterOptions={(x) => x}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          onInputChange={(_, v) => setTerm(v)}
          renderInput={(params) => <TextField {...params} label="Search patient (name or UHID)" placeholder="Type at least 2 characters" />}
        />
      </Box>

      {!selected ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px dashed", borderColor: "divider", p: 6, textAlign: "center", color: "text.secondary" }}>
          Search and select a patient to view their account statement.
        </Paper>
      ) : isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Total billed" value={inr(data.totals.totalBilled)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.success} label="Total paid" value={inr(data.totals.totalPaid)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.danger} label="Dues" value={inr(data.totals.totalDues)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SavingsRounded />} accent={SEMANTIC.info} label="Advance held" value={inr(data.totals.totalDeposit)} /></Grid>
          </Grid>
          <ReportTable
            title={`Account statement — ${selected.firstName} ${selected.lastName}`}
            filename={`statement_${selected.uhidNumber || selected.patientId}`}
            columns={[
              { key: "invoiceNumber", label: "Invoice" },
              { key: "invoiceDate", label: "Date", format: fmtDate, value: (r) => ts(r.invoiceDate) },
              money("netAmount", "Net"),
              money("paidAmount", "Paid"),
              money("balance", "Balance"),
              { key: "statusLabel", label: "Status" },
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}
