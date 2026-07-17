import { ACCENTS } from "../../styles/accents";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, TextField, Tabs, Tab, Button, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip,
} from "@mui/material";
import {
  EventRounded, CheckCircleRounded, CancelRounded, PaymentsRounded,
  PersonAddRounded, TrendingUpRounded, AccessTimeRounded, ReplayRounded, AccountBalanceWalletRounded,
  HotelRounded, LocalHotelRounded, MeetingRoomRounded, CallSplitRounded, MedicalInformationRounded,
  FileDownloadRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { axiosInstance } from "../../api/axios";
import ReportSkeleton from "../../components/skeletons/ReportSkeleton";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import { exportTableToExcel } from "../../utils/exportExcel";
import dayjs from "dayjs";
import { apiErrorText } from "../../utils/apiError";

const ACCENT = ACCENTS.reception;
const PIE = ["#0891b2", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

function KpiTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.2 }} noWrap>{value}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
      </Box>
    </Paper>
  );
}

function ChartCard({ title, children, height = 280, empty = false }: { title: string; children: React.ReactElement; height?: number; empty?: boolean }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", mb: 2 }}>{title}</Typography>
      <Box sx={{ width: "100%", height }}>
        {/* Empty renders outside ResponsiveContainer — it clones its child expecting
            a chart component, and doesn't size/center arbitrary elements reliably. */}
        {empty ? <Empty /> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
      </Box>
    </Paper>
  );
}

const axisProps = { tick: { fontSize: 12, fill: "#94a3b8" }, stroke: "#cbd5e1" } as any;

export default function Reports() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader title="Reports" subtitle="Daily OPD summary, appointment analytics, and collections" />

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<EventRounded fontSize="small" />} iconPosition="start" label="Daily OPD Summary" />
          <Tab icon={<TrendingUpRounded fontSize="small" />} iconPosition="start" label="Appointment Analytics" />
          <Tab icon={<PaymentsRounded fontSize="small" />} iconPosition="start" label="Collection Report" />
          <Tab icon={<HotelRounded fontSize="small" />} iconPosition="start" label="IPD Census" />
          <Tab icon={<CallSplitRounded fontSize="small" />} iconPosition="start" label="Referrals by Doctor" />
          <Tab icon={<PersonAddRounded fontSize="small" />} iconPosition="start" label="OP Registration" />
          <Tab icon={<AccountBalanceWalletRounded fontSize="small" />} iconPosition="start" label="OP Bills" />
          <Tab icon={<MedicalInformationRounded fontSize="small" />} iconPosition="start" label="Diagnosis-Wise" />
        </Tabs>
      </Paper>

      {tab === 0 && <DailyOpd />}
      {tab === 1 && <Analytics />}
      {tab === 2 && <Collection />}
      {tab === 3 && <Census />}
      {tab === 4 && <ReferralsByDoctor />}
      {tab === 5 && <OpRegistration />}
      {tab === 6 && <OpBills />}
      {tab === 7 && <DiagnosisWise />}
    </Box>
  );
}

// ── OP Registration ──────────────────────────────────────────────────────────
export function OpRegistration() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-op-registration", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/op-registration", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="Registrations" value={String(data.totals.registrations)} color={ACCENT} /></Grid>
          </Grid>
          <SimpleTable title="Registered patients" head={["UHID", "Name", "Phone", "Registered", "Referral"]}
            rows={rows.map((r) => [r.uhid, r.name, r.phone, dayjs(r.registeredOn).format("DD MMM YYYY"), r.referral])} />
        </Box>
      )}
    </Box>
  );
}

// ── OP Bills ─────────────────────────────────────────────────────────────────
export function OpBills() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-op-bills", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/op-bills", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PaymentsRounded />} label="Invoices" value={String(data.totals.invoices)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Billed" value={inr(data.totals.billed)} color="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PaymentsRounded />} label="Collected" value={inr(data.totals.collected)} color="#10b981" /></Grid>
          </Grid>
          <SimpleTable title="OPD invoices" head={["Invoice", "Patient", "UHID", "Date", "Net", "Paid", "Balance", "Status"]}
            rows={rows.map((r) => [r.invoiceNumber, r.patientName, r.uhid, dayjs(r.invoiceDate).format("DD MMM YYYY"), inr(r.netAmount), inr(r.paidAmount), inr(r.balance), r.statusLabel])} />
        </Box>
      )}
    </Box>
  );
}

// ── Diagnosis-Wise ───────────────────────────────────────────────────────────
export function DiagnosisWise() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-diagnosis-wise", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/diagnosis-wise", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<MedicalInformationRounded />} label="Consultations" value={String(data.totals.consultations)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<TrendingUpRounded />} label="Distinct diagnoses" value={String(data.totals.distinctDiagnoses)} color="#8b5cf6" /></Grid>
          </Grid>
          <SimpleTable title="Diagnoses" head={["Diagnosis", "Consultations"]} rows={rows.map((r) => [r.diagnosis, String(r.count)])} />
        </Box>
      )}
    </Box>
  );
}

// ── Referrals by Doctor ──────────────────────────────────────────────────────
export function ReferralsByDoctor() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [type, setType] = useState("");
  const [referrerId, setReferrerId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-referrals", from, to, type, referrerId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/referrals", {
      params: { from, to, type: type || undefined, referrerId: referrerId || undefined },
    })).data.data,
  });
  const s = data?.summary;
  const rows: any[] = data?.rows ?? [];
  const clear = () => { setType(""); setReferrerId(""); };
  const hasFilters = !!(type || referrerId);

  return (
    <Box>
      <Toolbar onClear={hasFilters ? clear : undefined}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Type" value={type} onChange={(v) => { setType(v); if (v === "EXTERNAL") setReferrerId(""); }} options={opts?.referralTypes} width={150} />
        <FilterSelect label="Referring doctor" value={referrerId} onChange={setReferrerId} options={opts?.doctors} width={200} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<MedicalInformationRounded />} label="Referring doctors" value={String(s.referringDoctors)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="Referred patients" value={String(s.referredPatients)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CallSplitRounded />} label="Internal / External" value={`${s.internal ?? 0} / ${s.external ?? 0}`} color="#3b82f6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="Total visits" value={String(s.totalVisits)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Patients referred by doctor" empty={!rows.length}>
                <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} {...axisProps} />
                  <RTooltip /><Bar dataKey="patientCount" name="Patients" fill={ACCENT} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <SimpleTable title="Referrer detail" head={["Doctor", "Type", "Patients", "Visits"]}
                rows={rows.map((r) => [`${r.name}${r.specialty ? ` (${r.specialty})` : ""}`, r.type, String(r.patientCount), String(r.visitCount)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── IPD Census ───────────────────────────────────────────────────────────────
export function Census() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [wardId, setWardId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-census", from, to, wardId],
    queryFn: async () => (await axiosInstance.get("/ipd/census", { params: { from, to, wardId: wardId || undefined } })).data.data,
  });
  const beds = data?.beds;

  return (
    <Box>
      <Toolbar onClear={wardId ? () => setWardId("") : undefined}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Ward" value={wardId} onChange={setWardId} options={opts?.wards} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHotelRounded />} label="Current inpatients" value={String(data.currentInpatients)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<MeetingRoomRounded />} label="Bed occupancy" value={`${beds.occupancyRate}%`} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="Admissions" value={String(data.movement.admissions)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<ReplayRounded />} label="Discharges" value={String(data.movement.discharges)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="Beds by status" height={260} empty={!beds.total}>
                <PieChart>
                  <Pie dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label
                    data={[
                      { name: "Occupied", value: beds.occupied }, { name: "Available", value: beds.available },
                      { name: "Reserved", value: beds.reserved }, { name: "Maintenance", value: beds.maintenance },
                    ].filter((d) => d.value > 0)}>
                    {["#ef4444", "#10b981", "#f59e0b", "#64748b"].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie><Legend /><RTooltip />
                </PieChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Occupancy by ward (%)" height={260} empty={!data.byWard.length}>
                <BarChart data={data.byWard} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} {...axisProps} /><YAxis type="category" dataKey="wardName" width={120} {...axisProps} />
                  <RTooltip formatter={(v: any) => `${v}%`} /><Bar dataKey="occupancyRate" name="Occupancy" fill={ACCENT} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <SimpleTable title="Ward detail" head={["Ward", "Beds", "Occupied", "Available", "Occupancy"]}
                rows={data.byWard.map((w: any) => [w.wardName || "—", String(w.totalBeds), String(w.occupied), String(w.available), `${w.occupancyRate}%`])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Daily OPD ────────────────────────────────────────────────────────────────
export function DailyOpd() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-daily-opd", date, doctorId, departmentId, statusId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/daily-opd", {
      params: { date, doctorId: doctorId || undefined, departmentId: departmentId || undefined, statusId: statusId || undefined },
    })).data.data,
  });
  const t = data?.totals;
  const clear = () => { setDoctorId(""); setDepartmentId(""); setStatusId(""); };
  const hasFilters = !!(doctorId || departmentId || statusId);

  return (
    <Box>
      <Toolbar onClear={hasFilters ? clear : undefined}>
        <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} sx={{ minWidth: 180 }} />
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
        <FilterSelect label="Status" value={statusId} onChange={setStatusId} options={opts?.appointmentStatuses} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="Appointments" value={String(t.appointments)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Completed" value={String(t.completed)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CancelRounded />} label="Cancelled" value={String(t.cancelled)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PaymentsRounded />} label="Collected" value={inr(t.collected)} color="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Checked in" value={String(t.checkedIn)} color="#3b82f6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<ReplayRounded />} label="Follow-ups" value={String(t.followUps)} color="#f59e0b" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="New OPD" value={String(t.newOpd)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="New patients" value={String(t.newPatients)} color="#ec4899" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="By status" empty={!data.byStatus.length}>
                <PieChart>
                  <Pie data={data.byStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                    {data.byStatus.map((s: any, i: number) => <Cell key={i} fill={s.color || PIE[i % PIE.length]} />)}
                  </Pie>
                  <Legend /><RTooltip />
                </PieChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Appointments by doctor" empty={!data.byDoctor.length}>
                <BarChart data={data.byDoctor} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" {...axisProps} /><YAxis type="category" dataKey="doctorName" width={120} {...axisProps} />
                  <RTooltip /><Bar dataKey="total" name="Total" fill={ACCENT} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <SimpleTable title="By department" head={["Department", "Appointments"]} rows={data.byDepartment.map((d: any) => [d.departmentName, String(d.count)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Appointment Analytics ────────────────────────────────────────────────────
export function Analytics() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-analytics", from, to, doctorId, departmentId, statusId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/appointment-analytics", {
      params: { from, to, doctorId: doctorId || undefined, departmentId: departmentId || undefined, statusId: statusId || undefined },
    })).data.data,
  });
  const t = data?.totals;
  const clear = () => { setDoctorId(""); setDepartmentId(""); setStatusId(""); };
  const hasFilters = !!(doctorId || departmentId || statusId);

  return (
    <Box>
      <Toolbar onClear={hasFilters ? clear : undefined}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
        <FilterSelect label="Status" value={statusId} onChange={setStatusId} options={opts?.appointmentStatuses} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="Total appointments" value={String(t.appointments)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Completion rate" value={`${t.completionRate}%`} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CancelRounded />} label="Cancellation rate" value={`${t.cancellationRate}%`} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<TrendingUpRounded />} label="Avg / day" value={String(t.avgPerDay)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <ChartCard title="Daily trend" empty={!data.trend.length}>
                <AreaChart data={data.trend}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ACCENT} stopOpacity={0.4} /><stop offset="95%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => dayjs(d).format("DD MMM")} /><YAxis {...axisProps} allowDecimals={false} />
                  <RTooltip /><Area type="monotone" dataKey="total" name="Appointments" stroke={ACCENT} fill="url(#g)" strokeWidth={2} />
                </AreaChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="By weekday">
                <BarChart data={data.byWeekday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" {...axisProps} /><YAxis {...axisProps} allowDecimals={false} />
                  <RTooltip /><Bar dataKey="count" name="Appointments" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="By status" empty={!data.byStatus.length}>
                <PieChart>
                  <Pie data={data.byStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                    {data.byStatus.map((s: any, i: number) => <Cell key={i} fill={s.color || PIE[i % PIE.length]} />)}
                  </Pie><Legend /><RTooltip />
                </PieChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Appointments by hour">
                <BarChart data={data.byHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="hour" {...axisProps} tickFormatter={(h) => `${h}:00`} /><YAxis {...axisProps} allowDecimals={false} />
                  <RTooltip labelFormatter={(h) => `${h}:00`} /><Bar dataKey="count" name="Appointments" fill={ACCENT} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <SimpleTable title="Top doctors" head={["Doctor", "Appointments"]} rows={data.byDoctor.map((d: any) => [d.doctorName, String(d.count)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Collection ───────────────────────────────────────────────────────────────
export function Collection() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-collection", from, to, paymentMethodId, collectedBy],
    queryFn: async () => (await axiosInstance.get("/reception/reports/collection", {
      params: { from, to, paymentMethodId: paymentMethodId || undefined, collectedBy: collectedBy || undefined },
    })).data.data,
  });
  const t = data?.totals;
  const clear = () => { setPaymentMethodId(""); setCollectedBy(""); };
  const hasFilters = !!(paymentMethodId || collectedBy);

  return (
    <Box>
      <Toolbar onClear={hasFilters ? clear : undefined}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Payment method" value={paymentMethodId} onChange={setPaymentMethodId} options={opts?.paymentMethods} />
        <FilterSelect label="Collector" value={collectedBy} onChange={setCollectedBy} options={opts?.collectors} width={200} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PaymentsRounded />} label="Gross collected" value={inr(t.gross)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<ReplayRounded />} label="Refunds" value={inr(t.refunded)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Net" value={inr(t.net)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccessTimeRounded />} label="Transactions" value={String(t.transactions)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Collected by day" empty={!data.byDay.length}>
                <BarChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" {...axisProps} tickFormatter={(d) => dayjs(d).format("DD MMM")} /><YAxis {...axisProps} />
                  <RTooltip formatter={(v: any) => inr(v)} /><Bar dataKey="amount" name="Collected" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="By payment method" empty={!data.byMethod.length}>
                <PieChart>
                  <Pie data={data.byMethod} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={90} label>
                    {data.byMethod.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie><Legend /><RTooltip formatter={(v: any) => inr(v)} />
                </PieChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="By shift" height={240}>
                <BarChart data={data.byShift}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="shift" {...axisProps} /><YAxis {...axisProps} />
                  <RTooltip formatter={(v: any) => inr(v)} /><Bar dataKey="amount" name="Collected" fill="#0891b2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleTable title="By collector" head={["Collector", "Txns", "Amount"]} rows={data.byCollector.map((c: any) => [c.collector, String(c.count), inr(c.amount)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────
type Opt = { id: string | number; name: string };
type FilterOptions = {
  doctors: Opt[]; departments: Opt[]; appointmentStatuses: Opt[];
  paymentMethods: Opt[]; collectors: Opt[]; wards: Opt[]; referralTypes: Opt[];
};

// Shared across tabs — react-query dedupes by key, so it's fetched once.
function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ["report-filter-options"],
    queryFn: async () => (await axiosInstance.get("/reception/reports/filter-options")).data.data,
    staleTime: 5 * 60 * 1000,
  });
}

function FilterSelect({ label, value, onChange, options, width = 180 }: { label: string; value: string; onChange: (v: string) => void; options?: Opt[]; width?: number }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: width }}>
      <MenuItem value=""><em>All</em></MenuItem>
      {(options ?? []).map((o) => <MenuItem key={String(o.id)} value={String(o.id)}>{o.name}</MenuItem>)}
    </TextField>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
function Toolbar({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
      {children}
      <Box sx={{ flex: 1 }} />
      {onClear && <Button variant="text" onClick={onClear} sx={{ textTransform: "none", color: "text.secondary" }}>Clear</Button>}
    </Box>
  );
}

function Loading() { return <ReportSkeleton />; }
function Empty() { return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled" }}><Typography variant="body2">No data for this period</Typography></Box>; }

function SimpleTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)}
            sx={{ textTransform: "none", color: "#0891b2" }}>Excel</Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>{head.map((h, i) => <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>
                  {r.map((c, ci) => <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ borderColor: "divider", color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
