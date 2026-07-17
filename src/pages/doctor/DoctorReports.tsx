import { ACCENTS } from "../../styles/accents";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
} from "@mui/material";
import {
  GroupRounded, EventAvailableRounded, MedicationRounded,
  ScienceRounded, MonitorHeartRounded, DescriptionRounded, FileDownloadRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { axiosInstance } from "../../api/axios";
import { exportTableToExcel } from "../../utils/exportExcel";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import ReportSkeleton from "../../components/skeletons/ReportSkeleton";
import PageHeader from "../../components/layout/PageHeader";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { apiErrorText } from "../../utils/apiError";

const DOCTOR_BLUE = ACCENTS.doctor;
const PIE_COLORS = ["#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#64748b"];

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];

const fmtDate = (d: string) => dayjs(d).format("DD MMM YYYY");
const fmtDateTime = (d: string) => dayjs(d).format("DD MMM YYYY, hh:mm A");

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>{label}</Typography>
      </Box>
    </Paper>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

// Downloadable table — every report on this page ends in one of these.
function SimpleTable({ title, head, rows, dense }: { title: string; head: string[]; rows: (string | number)[][]; dense?: boolean }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)}
            sx={{ textTransform: "none", color: DOCTOR_BLUE }}>Excel</Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data in this range</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: dense ? 340 : 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {head.map((h, i) => (
                  <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>
                  {r.map((c, ci) => (
                    <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ borderColor: "divider", color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

// ── Individual report views — each is one item in the sidebar, rendered on
// its own rather than all stacked on one page. All read from the single
// already-fetched payload (one backend call powers every report here). ─────

function SummaryReport({ data }: { data: any }) {
  const s = data?.summary;
  const trend: any[] = data?.trend || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
        <Kpi icon={<DescriptionRounded />} label="Consultations" value={s?.totalConsultations || 0} color="#3b82f6" />
        <Kpi icon={<GroupRounded />} label="Unique patients" value={s?.uniquePatients || 0} color="#8b5cf6" />
        <Kpi icon={<EventAvailableRounded />} label="Completed appts" value={s?.completedAppointments || 0} color="#10b981" />
        <Kpi icon={<MedicationRounded />} label="Prescriptions" value={s?.prescriptions || 0} color="#ec4899" />
        <Kpi icon={<ScienceRounded />} label="Lab orders" value={s?.labOrders || 0} color="#f59e0b" />
        <Kpi icon={<MonitorHeartRounded />} label="Radiology" value={s?.radiologyOrders || 0} color="#06b6d4" />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
        <Panel title="Consultations over time">
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="docTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DOCTOR_BLUE} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={DOCTOR_BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => dayjs(d).format("DD MMM")} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RTooltip labelFormatter={(d) => dayjs(d as string).format("DD MMM YYYY")} />
                <Area type="monotone" dataKey="count" name="Consultations" stroke={DOCTOR_BLUE} strokeWidth={2} fill="url(#docTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Panel>
        <SimpleTable title="Daily consultations" head={["Date", "Consultations"]}
          rows={trend.map((t) => [fmtDate(t.date), Number(t.count)])} />
      </Box>
    </Box>
  );
}

function DiagnosesReport({ data }: { data: any }) {
  const topDiagnoses: any[] = data?.topDiagnoses || [];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
      <Panel title="Top diagnoses">
        {topDiagnoses.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No diagnoses recorded in this range.</Typography>
        ) : (
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDiagnoses} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="diagnosis" width={150} tick={{ fontSize: 11 }} tickFormatter={(v) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
                <RTooltip />
                <Bar dataKey="count" name="Cases" fill={DOCTOR_BLUE} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Panel>
      <SimpleTable title="Diagnoses breakdown" head={["Diagnosis", "Cases"]}
        rows={topDiagnoses.map((d) => [d.diagnosis, Number(d.count)])} />
    </Box>
  );
}

function GenderReport({ data }: { data: any }) {
  const genderSplit: any[] = data?.genderSplit || [];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
      <Panel title="Patients by gender">
        {genderSplit.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No patients in this range.</Typography>
        ) : (
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderSplit} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.label}: ${e.count}`}>
                  {genderSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Panel>
      <SimpleTable title="Gender split" head={["Gender", "Patients"]}
        rows={genderSplit.map((g) => [g.label, Number(g.count)])} />
    </Box>
  );
}

function MedicinesReport({ data }: { data: any }) {
  const topMedicines: any[] = data?.topMedicines || [];
  return (
    <SimpleTable title="Top prescribed medicines" head={["Medicine", "Times prescribed", "Total qty"]}
      rows={topMedicines.map((m) => [m.medicineName, Number(m.timesPrescribed), Number(m.totalQuantity)])} />
  );
}

function LabOrdersReport({ data }: { data: any }) {
  const labStatusBreakdown: any[] = data?.labStatusBreakdown || [];
  return (
    <SimpleTable title="Lab orders — status" head={["Status", "Orders"]}
      rows={labStatusBreakdown.map((r) => [r.status, Number(r.count)])} />
  );
}

function RadiologyOrdersReport({ data }: { data: any }) {
  const radStatusBreakdown: any[] = data?.radStatusBreakdown || [];
  return (
    <SimpleTable title="Radiology orders — status" head={["Status", "Orders"]}
      rows={radStatusBreakdown.map((r) => [r.status, Number(r.count)])} />
  );
}

function ConsultationsRegisterReport({ data }: { data: any }) {
  const consultationsList: any[] = data?.consultationsList || [];
  return (
    <SimpleTable
      title="Consultations register"
      head={["Date", "Patient", "UHID", "Diagnosis", "Prescriptions"]}
      rows={consultationsList.map((c) => [fmtDateTime(c.date), c.patientName, c.uhid, c.diagnosis, Number(c.prescriptions)])}
    />
  );
}

// ── Report catalogue — one entry per sidebar item, grouped like ReportsHub. ──

type ReportItem = { key: string; label: string; Comp: React.ComponentType<{ data: any }> };
type ReportGroup = { heading: string; items: ReportItem[] };

const GROUPS: ReportGroup[] = [
  { heading: "Overview", items: [{ key: "summary", label: "Summary & Trend", Comp: SummaryReport }] },
  {
    heading: "Clinical",
    items: [
      { key: "diagnoses", label: "Diagnoses Breakdown", Comp: DiagnosesReport },
      { key: "gender", label: "Patients by Gender", Comp: GenderReport },
      { key: "consultations", label: "Consultations Register", Comp: ConsultationsRegisterReport },
    ],
  },
  { heading: "Prescriptions", items: [{ key: "medicines", label: "Top Prescribed Medicines", Comp: MedicinesReport }] },
  {
    heading: "Orders",
    items: [
      { key: "lab-status", label: "Lab Orders Status", Comp: LabOrdersReport },
      { key: "rad-status", label: "Radiology Orders Status", Comp: RadiologyOrdersReport },
    ],
  },
];

export default function DoctorReports() {
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [active, setActive] = useState<string>(GROUPS[0].items[0].key);

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  // One fetch powers every report in the sidebar — switching reports just
  // changes which slice of this same payload is rendered, no extra requests.
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["doctor-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/doctor/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const ActiveComp = useMemo(() => {
    for (const g of GROUPS) {
      const found = g.items.find((i) => i.key === active);
      if (found) return found.Comp;
    }
    return GROUPS[0].items[0].Comp;
  }, [active]);

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="My Reports"
        subtitle="Your practice analytics — pick a report on the left. Every table is downloadable."
        actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      />

      {/* Date range — shared across every report below */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <ButtonGroup size="small" variant="outlined">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              onClick={() => applyPreset(p)}
              variant={preset === p.key ? "contained" : "outlined"}
              sx={preset === p.key ? { bgcolor: DOCTOR_BLUE } : undefined}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPreset(""); }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPreset(""); }} />
        </Box>
      </Paper>

      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
          {/* Report picker */}
          <Paper elevation={0} sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden" }}>
            <List dense disablePadding>
              {GROUPS.map((g, gi) => (
                <Box key={g.heading}>
                  {gi > 0 && <Divider />}
                  <ListSubheader sx={{ fontWeight: 800, fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary", lineHeight: "36px", bgcolor: "transparent" }}>
                    {g.heading}
                  </ListSubheader>
                  {g.items.map((it) => (
                    <ListItemButton
                      key={it.key}
                      selected={active === it.key}
                      onClick={() => setActive(it.key)}
                      sx={{ py: 0.75, "&.Mui-selected": { bgcolor: `${DOCTOR_BLUE}14`, borderRight: `3px solid ${DOCTOR_BLUE}` }, "&.Mui-selected:hover": { bgcolor: `${DOCTOR_BLUE}22` } }}
                    >
                      <ListItemText primary={it.label} primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: active === it.key ? 700 : 500, color: active === it.key ? DOCTOR_BLUE : "text.primary" }} />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          </Paper>

          {/* Active report */}
          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ActiveComp data={data} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
