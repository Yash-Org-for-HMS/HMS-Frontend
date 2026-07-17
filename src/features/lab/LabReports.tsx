import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  ScienceRounded, CheckCircleRounded, HourglassEmptyRounded, BiotechRounded,
  MonitorHeartRounded, WarningAmberRounded, AccessTimeRounded, CurrencyRupeeRounded,
  FileDownloadRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";

const ACCENT = "#10B981";
const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#64748b"];
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>{value}</Typography>
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

function DataTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 2.5, py: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)} sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No data in this range.</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 280 }}>
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

export default function LabReports() {
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["lab-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/lab/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const trend: any[] = data?.trend || [];
  const topTests: any[] = data?.topTests || [];
  const radiologyStatusBreakdown: any[] = data?.radiologyStatusBreakdown || [];

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Lab & Radiology Reports"
        subtitle="Order volume, turnaround time, and top tests over a date range."
        actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      />

      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <ButtonGroup size="small" variant="outlined">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              onClick={() => applyPreset(p)}
              variant={preset === p.key ? "contained" : "outlined"}
              sx={preset === p.key ? { bgcolor: ACCENT } : undefined}
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* KPIs */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(7,1fr)" }, gap: 1.5 }}>
            <Kpi icon={<ScienceRounded />} label="Total orders" value={s?.totalOrders || 0} color="#10b981" />
            <Kpi icon={<HourglassEmptyRounded />} label="Pending" value={s?.pending || 0} color="#f59e0b" />
            <Kpi icon={<BiotechRounded />} label="Sample collected" value={s?.sampleCollected || 0} color="#3b82f6" />
            <Kpi icon={<CheckCircleRounded />} label="Completed" value={s?.completed || 0} color="#10b981" />
            <Kpi icon={<MonitorHeartRounded />} label="Radiology" value={s?.radiologyOrders || 0} color="#06b6d4" />
            <Kpi icon={<WarningAmberRounded />} label="Critical results" value={s?.criticalResults || 0} color="#ef4444" />
            <Kpi icon={<AccessTimeRounded />} label="Avg turnaround" value={`${s?.avgTurnaroundHours || 0}h`} color="#8b5cf6" />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>
            <Kpi icon={<CurrencyRupeeRounded />} label="Revenue estimate (billed tests)" value={inr(s?.revenueEstimate)} color="#0891b2" />
          </Box>

          {/* Trend */}
          <Panel title="Orders over time">
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="labTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="radTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => dayjs(d).format("DD MMM")} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip labelFormatter={(d) => dayjs(d as string).format("DD MMM YYYY")} />
                  <Legend />
                  <Area type="monotone" dataKey="labOrders" name="Lab orders" stroke={ACCENT} strokeWidth={2} fill="url(#labTrend)" />
                  <Area type="monotone" dataKey="radiologyOrders" name="Radiology orders" stroke="#06b6d4" strokeWidth={2} fill="url(#radTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>

          {/* Top tests */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
            <Panel title="Top tests ordered">
              {topTests.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No tests in this range.</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topTests} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="testName" width={150} tick={{ fontSize: 11 }} tickFormatter={(v) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
                      <RTooltip />
                      <Bar dataKey="count" name="Times ordered" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Panel>

            <DataTable title="Top tests ordered" head={["Test", "Times ordered"]} rows={topTests.map((t) => [t.testName, t.count])} />
          </Box>

          {/* Radiology status */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
            <Panel title="Radiology status">
              {radiologyStatusBreakdown.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No radiology orders in this range.</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={radiologyStatusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.status}: ${e.count}`}>
                        {radiologyStatusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Panel>

            <DataTable title="Radiology status" head={["Status", "Count"]} rows={radiologyStatusBreakdown.map((r) => [r.status, r.count])} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
