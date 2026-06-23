import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, CircularProgress, TextField, Button, ButtonGroup,
} from "@mui/material";
import {
  AssessmentRounded, GroupRounded, EventAvailableRounded, MedicationRounded,
  ScienceRounded, MonitorHeartRounded, DescriptionRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";

const DOCTOR_BLUE = "#3b82f6";
const PIE_COLORS = ["#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#64748b"];

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];

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

export default function DoctorReports() {
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["doctor-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/doctor/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const trend: any[] = data?.trend || [];
  const topDiagnoses: any[] = data?.topDiagnoses || [];
  const genderSplit: any[] = data?.genderSplit || [];

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <AssessmentRounded sx={{ color: DOCTOR_BLUE, fontSize: 32 }} />
            My Reports
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Your practice analytics — consultations, diagnoses, and orders over a date range.
          </Typography>
        </Box>
        {isFetching && <CircularProgress size={20} sx={{ color: DOCTOR_BLUE, mt: 1 }} />}
      </Box>

      {/* Date range */}
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
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <Mascot pose="thinking" subtitle="Crunching your numbers…" />
        </Box>
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* KPIs */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
            <Kpi icon={<DescriptionRounded />} label="Consultations" value={s?.totalConsultations || 0} color="#3b82f6" />
            <Kpi icon={<GroupRounded />} label="Unique patients" value={s?.uniquePatients || 0} color="#8b5cf6" />
            <Kpi icon={<EventAvailableRounded />} label="Completed appts" value={s?.completedAppointments || 0} color="#10b981" />
            <Kpi icon={<MedicationRounded />} label="Prescriptions" value={s?.prescriptions || 0} color="#ec4899" />
            <Kpi icon={<ScienceRounded />} label="Lab orders" value={s?.labOrders || 0} color="#f59e0b" />
            <Kpi icon={<MonitorHeartRounded />} label="Radiology" value={s?.radiologyOrders || 0} color="#06b6d4" />
          </Box>

          {/* Trend */}
          <Panel title="Consultations over time">
            <Box sx={{ height: 280 }}>
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

          {/* Diagnoses + gender */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
            <Panel title="Top diagnoses">
              {topDiagnoses.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No diagnoses recorded in this range.</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
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

            <Panel title="Patients by gender">
              {genderSplit.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No patients in this range.</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={genderSplit} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.label}: ${e.count}`}>
                        {genderSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Panel>
          </Box>
        </Box>
      )}
    </Box>
  );
}
