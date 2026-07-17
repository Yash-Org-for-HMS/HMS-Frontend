import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Grid, TextField, Tabs, Tab, Button, Typography, Autocomplete,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  AccountBalanceWalletRounded, ReceiptLongRounded, PaymentsRounded,
  TrendingUpRounded, PersonRounded, SavingsRounded, Inventory2Rounded, FileDownloadRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";

const ACCENT = "#0891b2";
const inr = formatINRAuto;

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>{value}</Typography><Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography></Box>
    </Paper>
  );
}

function DataTable({ title, head, rows }: { title?: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      {rows.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title || "Report"}</Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title || "report", head, rows)} sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
        </Box>
      )}
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>No records for this selection</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: "calc(100vh - 380px)" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>{head.map((h, i) => <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", color: "text.secondary", bgcolor: "background.paper" }}>{h}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>{r.map((c, ci) => <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

function DateBar({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
      <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
      <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
    </Box>
  );
}

export default function BillingReports() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader title="Billing Reports" subtitle="Outstanding dues, patient statements, receipts, and service revenue" />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
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

export function PharmacyExpense() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-pharmacy-expense", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/pharmacy-expense", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>Purchase orders are organization-wide (not branch-specific).</Typography>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<Inventory2Rounded />} label="Total spend" value={inr(data.totals.total)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReceiptLongRounded />} label="Purchase orders" value={String(data.totals.purchaseOrders)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`Pharmacy Expense ${from} to ${to}`} head={["Order date", "Supplier", "Status", "Amount"]}
            rows={rows.map((r) => [dayjs(r.orderDate).format("DD MMM YYYY"), r.supplier, r.status, inr(r.amount)])} />
        </Box>
      )}
    </Box>
  );
}

export function Outstanding() {
  const [from, setFrom] = useState(dayjs().subtract(89, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-outstanding", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/outstanding", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<AccountBalanceWalletRounded />} label="Total dues" value={inr(data.totals.totalDues)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReceiptLongRounded />} label="Invoices" value={String(data.totals.invoices)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<PaymentsRounded />} label="Billed (these)" value={inr(data.totals.totalBilled)} color="#8b5cf6" /></Grid>
          </Grid>
          <DataTable title={`Outstanding Dues ${from} to ${to}`} head={["Invoice", "Patient", "UHID", "Date", "Net", "Paid", "Balance", "Status"]}
            rows={rows.map((r) => [r.invoiceNumber, r.patientName, r.uhid, dayjs(r.invoiceDate).format("DD MMM YYYY"), inr(r.netAmount), inr(r.paidAmount), inr(r.balance), r.statusLabel])} />
        </Box>
      )}
    </Box>
  );
}

export function PatientStatement() {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

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
        <Box sx={{ flex: 1 }} />
      </Box>

      {!selected ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px dashed", borderColor: "divider", p: 6, textAlign: "center", color: "text.secondary" }}>
          Search and select a patient to view their account statement.
        </Paper>
      ) : isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReceiptLongRounded />} label="Total billed" value={inr(data.totals.totalBilled)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<PaymentsRounded />} label="Total paid" value={inr(data.totals.totalPaid)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<AccountBalanceWalletRounded />} label="Dues" value={inr(data.totals.totalDues)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<SavingsRounded />} label="Advance held" value={inr(data.totals.totalDeposit)} color="#8b5cf6" /></Grid>
          </Grid>
          <DataTable title={`Account Statement ${selected.firstName} ${selected.lastName}`} head={["Invoice", "Date", "Net", "Paid", "Balance", "Status"]}
            rows={rows.map((r) => [r.invoiceNumber, dayjs(r.invoiceDate).format("DD MMM YYYY"), inr(r.netAmount), inr(r.paidAmount), inr(r.balance), r.statusLabel])} />
        </Box>
      )}
    </Box>
  );
}

export function Receipts() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-receipts", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/receipts", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<PaymentsRounded />} label="Collected" value={inr(data.totals.gross)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReceiptLongRounded />} label="Receipts" value={String(data.totals.count)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`Receipts ${from} to ${to}`} head={["Date", "Invoice", "Patient", "UHID", "Method", "Reference", "Collector", "Amount"]}
            rows={rows.map((r) => [dayjs(r.date).format("DD MMM YY HH:mm"), r.invoiceNumber, r.patientName, r.uhid, r.method, r.reference, r.collector, inr(r.amount)])} />
        </Box>
      )}
    </Box>
  );
}

export function ServiceWise() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billing-report-service-wise", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/service-wise", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<TrendingUpRounded />} label="Total revenue" value={inr(data.totals.total)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReceiptLongRounded />} label="Services" value={String(data.totals.services)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`Service-Wise Revenue ${from} to ${to}`} head={["Service", "Qty", "Amount"]} rows={rows.map((r) => [r.service, r.quantity, inr(r.amount)])} />
        </Box>
      )}
    </Box>
  );
}
