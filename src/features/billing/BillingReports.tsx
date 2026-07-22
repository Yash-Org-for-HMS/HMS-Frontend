import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Grid, TextField, Tabs, Tab, Autocomplete } from "@mui/material";
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
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportTable, TrendChart, BreakdownBar, DonutChart, type DateRange } from "@/features/reports/kit";

const ACCENT = ACCENTS.reception;
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
  const trend: any[] = data?.trend ?? [];
  const byMethod: any[] = (data?.byMethod ?? []).map((m: any) => ({ method: m.method, amount: Number(m.amount) }));
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.success} label="Collected" value={inr(data.totals.gross)} current={Number(data.totals.gross)} previous={prev ? Number(prev.gross) : undefined} spark={trend.map((t) => t.amount)} /></Grid>
                <Grid size={{ xs: 12 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Receipts" value={String(data.totals.count)} current={data.totals.count} previous={prev?.count} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}><TrendChart title="Collection over time" subtitle="Per day" data={trend} xKey="date" series={[{ key: "amount", label: "Collected (₹)" }]} valueFormatter={inr} height={260} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><DonutChart title="By payment method" data={byMethod} nameKey="method" valueKey="amount" valueFormatter={inr} height={260} /></Grid>
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
  const topDebtors = rows.slice(0, 8).map((r) => ({ name: r.patientName, balance: Number(r.balance) }));

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.danger} label="Total dues" value={inr(data.totals.totalDues)} /></Grid>
                <Grid size={{ xs: 6 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Invoices" value={String(data.totals.invoices)} /></Grid>
                <Grid size={{ xs: 6 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.info} label="Billed" value={inr(data.totals.totalBilled)} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}><BreakdownBar title="Top outstanding balances" subtitle="Most-owed patients" data={topDebtors} categoryKey="name" valueKey="balance" valueName="Balance" colorIndex={7} valueFormatter={inr} height={280} /></Grid>
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
  const topServices = rows.slice(0, 10).map((r) => ({ service: r.service, amount: Number(r.amount) }));

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Total revenue" value={inr(data.totals.total)} /></Grid>
                <Grid size={{ xs: 12 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Services" value={String(data.totals.services)} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}><BreakdownBar title="Top services by revenue" data={topServices} categoryKey="service" valueKey="amount" valueName="Revenue" colorIndex={2} valueFormatter={inr} height={320} /></Grid>
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
  const trend: any[] = data?.trend ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<Inventory2Rounded />} accent={SEMANTIC.warning} label="Total spend" value={inr(data.totals.total)} current={Number(data.totals.total)} previous={prev ? Number(prev.total) : undefined} higherIsBetter={false} spark={trend.map((t) => t.amount)} /></Grid>
                <Grid size={{ xs: 12 }}><KpiCard icon={<ReceiptLongRounded />} accent={ACCENT} label="Purchase orders" value={String(data.totals.purchaseOrders)} current={data.totals.purchaseOrders} previous={prev?.purchaseOrders} higherIsBetter={false} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}><TrendChart title="Procurement over time" subtitle="Purchase-order spend per day" data={trend} xKey="date" series={[{ key: "amount", label: "Spend (₹)" }]} valueFormatter={inr} height={280} /></Grid>
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
