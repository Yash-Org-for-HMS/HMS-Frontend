import { ACCENTS } from "../../styles/accents";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, TextField, Tabs, Tab, Button,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip,
} from "@mui/material";
import {
  PrintRounded, EventRounded, CheckCircleRounded, CancelRounded, PaymentsRounded,
  PersonAddRounded, TrendingUpRounded, AccessTimeRounded, ReplayRounded, AccountBalanceWalletRounded,
  HotelRounded, LocalHotelRounded, MeetingRoomRounded, CallSplitRounded, MedicalInformationRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { axiosInstance } from "../../api/axios";
import PageLoader from "../../components/PageLoader";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import dayjs from "dayjs";

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

function ChartCard({ title, children, height = 280 }: { title: string; children: React.ReactElement; height?: number }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", mb: 2 }}>{title}</Typography>
      <Box sx={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </Box>
    </Paper>
  );
}

const axisProps = { tick: { fontSize: 12, fill: "#94a3b8" }, stroke: "#cbd5e1" } as any;

function printRegion(node: HTMLElement | null, title: string) {
  if (!node) return;
  const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join("");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title>${headStyles}<style>@media print{@page{margin:1cm}body{font-family:Inter,Arial,sans-serif}}</style></head><body><h2 style="font-family:Inter,Arial,sans-serif">${title}</h2>${node.innerHTML}</body></html>`);
  doc.close();
  const win = iframe.contentWindow!;
  const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
  win.onafterprint = cleanup;
  setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 350);
}

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
        </Tabs>
      </Paper>

      {tab === 0 && <DailyOpd />}
      {tab === 1 && <Analytics />}
      {tab === 2 && <Collection />}
      {tab === 3 && <Census />}
      {tab === 4 && <ReferralsByDoctor />}
    </Box>
  );
}

// ── Referrals by Doctor ──────────────────────────────────────────────────────
function ReferralsByDoctor() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-referrals", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/referrals", { params: { from, to } })).data.data,
  });
  const s = data?.summary;
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <Toolbar onPrint={() => printRegion(ref.current, `Referrals by Doctor — ${from} to ${to}`)}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<MedicalInformationRounded />} label="Referring doctors" value={String(s.referringDoctors)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="Referred patients" value={String(s.referredPatients)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CallSplitRounded />} label="Internal / External" value={`${s.internal ?? 0} / ${s.external ?? 0}`} color="#3b82f6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="Total visits" value={String(s.totalVisits)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Patients referred by doctor">
                {rows.length ? (
                  <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" {...axisProps} allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} {...axisProps} />
                    <RTooltip /><Bar dataKey="patientCount" name="Patients" fill={ACCENT} radius={[0, 6, 6, 0]} />
                  </BarChart>
                ) : <Empty />}
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
function Census() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-census", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/census", { params: { from, to } })).data.data,
  });
  const beds = data?.beds;

  return (
    <Box>
      <Toolbar onPrint={() => printRegion(ref.current, `IPD Census — ${from} to ${to}`)}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHotelRounded />} label="Current inpatients" value={String(data.currentInpatients)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<MeetingRoomRounded />} label="Bed occupancy" value={`${beds.occupancyRate}%`} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PersonAddRounded />} label="Admissions" value={String(data.movement.admissions)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<ReplayRounded />} label="Discharges" value={String(data.movement.discharges)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="Beds by status" height={260}>
                {beds.total ? (
                  <PieChart>
                    <Pie dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label
                      data={[
                        { name: "Occupied", value: beds.occupied }, { name: "Available", value: beds.available },
                        { name: "Reserved", value: beds.reserved }, { name: "Maintenance", value: beds.maintenance },
                      ].filter((d) => d.value > 0)}>
                      {["#ef4444", "#10b981", "#f59e0b", "#64748b"].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie><Legend /><RTooltip />
                  </PieChart>
                ) : <Empty />}
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Occupancy by ward (%)" height={260}>
                {data.byWard.length ? (
                  <BarChart data={data.byWard} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} {...axisProps} /><YAxis type="category" dataKey="wardName" width={120} {...axisProps} />
                    <RTooltip formatter={(v: any) => `${v}%`} /><Bar dataKey="occupancyRate" name="Occupancy" fill={ACCENT} radius={[0, 6, 6, 0]} />
                  </BarChart>
                ) : <Empty />}
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
function DailyOpd() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-daily-opd", date],
    queryFn: async () => (await axiosInstance.get("/reception/reports/daily-opd", { params: { date } })).data.data,
  });
  const t = data?.totals;

  return (
    <Box>
      <Toolbar onPrint={() => printRegion(ref.current, `Daily OPD Summary — ${dayjs(date).format("DD MMM YYYY")}`)}>
        <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} sx={{ minWidth: 180 }} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /> : (
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
              <ChartCard title="By status">
                {data.byStatus.length ? (
                  <PieChart>
                    <Pie data={data.byStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                      {data.byStatus.map((s: any, i: number) => <Cell key={i} fill={s.color || PIE[i % PIE.length]} />)}
                    </Pie>
                    <Legend /><RTooltip />
                  </PieChart>
                ) : <Empty />}
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Appointments by doctor">
                {data.byDoctor.length ? (
                  <BarChart data={data.byDoctor} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" {...axisProps} /><YAxis type="category" dataKey="doctorName" width={120} {...axisProps} />
                    <RTooltip /><Bar dataKey="total" name="Total" fill={ACCENT} radius={[0, 6, 6, 0]} />
                  </BarChart>
                ) : <Empty />}
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
function Analytics() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-analytics", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/appointment-analytics", { params: { from, to } })).data.data,
  });
  const t = data?.totals;

  return (
    <Box>
      <Toolbar onPrint={() => printRegion(ref.current, `Appointment Analytics — ${from} to ${to}`)}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<EventRounded />} label="Total appointments" value={String(t.appointments)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Completion rate" value={`${t.completionRate}%`} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CancelRounded />} label="Cancellation rate" value={`${t.cancellationRate}%`} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<TrendingUpRounded />} label="Avg / day" value={String(t.avgPerDay)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <ChartCard title="Daily trend">
                {data.trend.length ? (
                  <AreaChart data={data.trend}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ACCENT} stopOpacity={0.4} /><stop offset="95%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => dayjs(d).format("DD MMM")} /><YAxis {...axisProps} allowDecimals={false} />
                    <RTooltip /><Area type="monotone" dataKey="total" name="Appointments" stroke={ACCENT} fill="url(#g)" strokeWidth={2} />
                  </AreaChart>
                ) : <Empty />}
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
              <ChartCard title="By status">
                {data.byStatus.length ? (
                  <PieChart>
                    <Pie data={data.byStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                      {data.byStatus.map((s: any, i: number) => <Cell key={i} fill={s.color || PIE[i % PIE.length]} />)}
                    </Pie><Legend /><RTooltip />
                  </PieChart>
                ) : <Empty />}
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
function Collection() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-collection", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/collection", { params: { from, to } })).data.data,
  });
  const t = data?.totals;

  return (
    <Box>
      <Toolbar onPrint={() => printRegion(ref.current, `Collection Report — ${from} to ${to}`)}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PaymentsRounded />} label="Gross collected" value={inr(t.gross)} color="#10b981" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<ReplayRounded />} label="Refunds" value={inr(t.refunded)} color="#ef4444" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Net" value={inr(t.net)} color={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccessTimeRounded />} label="Transactions" value={String(t.transactions)} color="#8b5cf6" /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Collected by day">
                {data.byDay.length ? (
                  <BarChart data={data.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" {...axisProps} tickFormatter={(d) => dayjs(d).format("DD MMM")} /><YAxis {...axisProps} />
                    <RTooltip formatter={(v: any) => inr(v)} /><Bar dataKey="amount" name="Collected" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : <Empty />}
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard title="By payment method">
                {data.byMethod.length ? (
                  <PieChart>
                    <Pie data={data.byMethod} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={90} label>
                      {data.byMethod.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie><Legend /><RTooltip formatter={(v: any) => inr(v)} />
                  </PieChart>
                ) : <Empty />}
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

// ── Small shared bits ────────────────────────────────────────────────────────
function Toolbar({ children, onPrint }: { children: React.ReactNode; onPrint: () => void }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
      {children}
      <Box sx={{ flex: 1 }} />
      <Button variant="outlined" startIcon={<PrintRounded />} onClick={onPrint} sx={{ textTransform: "none", borderColor: "divider", color: "text.secondary" }}>Print</Button>
    </Box>
  );
}

function Loading() { return <PageLoader />; }
function Empty() { return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled" }}><Typography variant="body2">No data for this period</Typography></Box>; }

function SimpleTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", mb: 1.5 }}>{title}</Typography>
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
