import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Grid, TextField, Tabs, Tab, Button, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { LocalHotelRounded, ReplayRounded, AccessTimeRounded, PersonAddRounded, SavingsRounded, FileDownloadRounded } from "@mui/icons-material";
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
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</Box>
      <Box><Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography><Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography></Box>
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
        <TableContainer sx={{ maxHeight: "calc(100vh - 360px)" }}>
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

export default function IpdReports() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader title="IPD Reports" subtitle="In-patient census and discharge records" />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<LocalHotelRounded fontSize="small" />} iconPosition="start" label="In-Patient List" />
          <Tab icon={<ReplayRounded fontSize="small" />} iconPosition="start" label="Discharges" />
          <Tab icon={<PersonAddRounded fontSize="small" />} iconPosition="start" label="IP Registrations" />
          <Tab icon={<SavingsRounded fontSize="small" />} iconPosition="start" label="IP Advances" />
        </Tabs>
      </Paper>
      {tab === 0 && <InPatients />}
      {tab === 1 && <Discharges />}
      {tab === 2 && <IpRegistrations />}
      {tab === 3 && <IpAdvances />}
    </Box>
  );
}

export function IpRegistrations() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-registrations", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/registrations", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<PersonAddRounded />} label="Admissions" value={String(data.totals.admissions)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`IP Registrations ${from} to ${to}`} head={["Patient", "UHID", "Bed", "Admitted", "Status"]}
            rows={rows.map((r) => [r.patientName, r.uhid, r.bed, r.admissionDate ? dayjs(r.admissionDate).format("DD MMM YYYY") : "—", r.status])} />
        </Box>
      )}
    </Box>
  );
}

export function IpAdvances() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-advances", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/advances", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<SavingsRounded />} label="Advance collected" value={inr(data.totals.total)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<AccessTimeRounded />} label="Entries" value={String(data.totals.count)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`IP Advances ${from} to ${to}`} head={["Date", "Patient", "UHID", "Method", "Amount"]}
            rows={rows.map((r) => [dayjs(r.date).format("DD MMM YY HH:mm"), r.patientName, r.uhid, r.method, inr(r.amount)])} />
        </Box>
      )}
    </Box>
  );
}

export function InPatients() {
  const [asOf, setAsOf] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-inpatients", asOf],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/inpatients", { params: { asOf } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="As of date" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} sx={{ minWidth: 180 }} />
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<LocalHotelRounded />} label="Current inpatients" value={String(data.totals.inpatients)} color={ACCENT} /></Grid>
          </Grid>
          <DataTable title={`In-Patient List (as of ${asOf})`} head={["Patient", "UHID", "Bed", "Admitted", "Days"]}
            rows={rows.map((r) => [r.patientName, r.uhid, r.bed, r.admissionDate ? dayjs(r.admissionDate).format("DD MMM YYYY") : "—", r.days])} />
        </Box>
      )}
    </Box>
  );
}

export function Discharges() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-discharges", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/discharges", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<ReplayRounded />} label="Discharges" value={String(data.totals.discharges)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Kpi icon={<AccessTimeRounded />} label="Avg stay (days)" value={String(data.totals.avgStay)} color="#8b5cf6" /></Grid>
          </Grid>
          <DataTable title={`IP Discharges ${from} to ${to}`} head={["Patient", "UHID", "Bed", "Admitted", "Discharged", "Stay (days)"]}
            rows={rows.map((r) => [r.patientName, r.uhid, r.bed, r.admissionDate ? dayjs(r.admissionDate).format("DD MMM YYYY") : "—", r.dischargeDate ? dayjs(r.dischargeDate).format("DD MMM YYYY") : "—", r.lengthOfStay])} />
        </Box>
      )}
    </Box>
  );
}
