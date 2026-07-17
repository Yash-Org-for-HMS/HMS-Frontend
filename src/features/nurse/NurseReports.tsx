import { ACCENTS } from "@/styles/accents";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
} from "@mui/material";
import {
  GroupRounded, MonitorHeartRounded, WarningAmberRounded, BadgeRounded,
  FileDownloadRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";

const NURSE_PURPLE = ACCENTS.nurse;

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
            sx={{ textTransform: "none", color: NURSE_PURPLE }}>Excel</Button>
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

// ── Reports fed by the shared /nurse/reports payload ─────────────────────────

function SummaryReport({ data }: { data: any }) {
  const s = data?.summary;
  const trend: any[] = data?.trend || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(4,1fr)" }, gap: 1.5 }}>
        <Kpi icon={<MonitorHeartRounded />} label="Vitals recorded" value={s?.totalVitalsRecorded || 0} color="#a78bfa" />
        <Kpi icon={<GroupRounded />} label="Unique patients" value={s?.uniquePatients || 0} color="#3b82f6" />
        <Kpi icon={<WarningAmberRounded />} label="Abnormal readings" value={s?.abnormalReadings || 0} color="#ef4444" />
        <Kpi icon={<BadgeRounded />} label="Staff recording" value={s?.staffRecording || 0} color="#10b981" />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
        <Panel title="Vitals recorded over time">
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="nurseTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={NURSE_PURPLE} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={NURSE_PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => dayjs(d).format("DD MMM")} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RTooltip labelFormatter={(d) => dayjs(d as string).format("DD MMM YYYY")} />
                <Area type="monotone" dataKey="count" name="Vitals" stroke={NURSE_PURPLE} strokeWidth={2} fill="url(#nurseTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Panel>
        <SimpleTable title="Daily vitals recorded" head={["Date", "Vitals"]}
          rows={trend.map((t) => [fmtDate(t.date), Number(t.count)])} />
      </Box>
    </Box>
  );
}

function VitalsRegisterReport({ data }: { data: any }) {
  const vitalsList: any[] = data?.vitalsList || [];
  return (
    <SimpleTable
      title="Vitals register"
      head={["Date", "Patient", "UHID", "BP", "Pulse", "Temp (°C)", "SpO2 (%)", "Weight (kg)", "Recorded by"]}
      rows={vitalsList.map((v) => [fmtDateTime(v.date), v.patientName, v.uhid, v.bp, v.pulse, v.temperatureC, v.oxygenSaturation, v.weightKg, v.recordedBy])}
    />
  );
}

function AbnormalVitalsReport({ data }: { data: any }) {
  const abnormalList: any[] = data?.abnormalList || [];
  return (
    <SimpleTable
      title="Abnormal vitals — needs review"
      head={["Date", "Patient", "UHID", "BP", "Pulse", "Temp (°C)", "SpO2 (%)", "Flags", "Recorded by"]}
      rows={abnormalList.map((v) => [fmtDateTime(v.date), v.patientName, v.uhid, v.bp, v.pulse, v.temperatureC, v.oxygenSaturation, v.flags.join(", "), v.recordedBy])}
    />
  );
}

function StaffWorkloadReport({ data }: { data: any }) {
  const byStaff: any[] = data?.byStaff || [];
  return (
    <SimpleTable title="Vitals recorded by staff" head={["Staff", "Vitals recorded"]}
      rows={byStaff.map((r) => [r.staffName, Number(r.count)])} />
  );
}

// ── Reports fed by the existing IPD reports endpoints (ward/bed/admission
// data already lives there — reused rather than duplicated). Each is its own
// query since it's a different backend module, mirroring ReportsHub. ────────

function InpatientsReport({ to }: { to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-ipd-inpatients", to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/inpatients", { params: { asOf: to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows: any[] = data?.rows || [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Current inpatients" head={["Patient", "UHID", "Bed", "Admitted", "Days"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed, fmtDate(r.admissionDate), Number(r.days)])} />
  );
}

function DischargesReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-ipd-discharges", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/discharges", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows: any[] = data?.rows || [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Discharges" head={["Patient", "UHID", "Bed", "Admitted", "Discharged", "Length of stay"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed, fmtDate(r.admissionDate), r.dischargeDate ? fmtDate(r.dischargeDate) : "—", Number(r.lengthOfStay)])} />
  );
}

function AdmissionsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-ipd-registrations", from, to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/registrations", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows: any[] = data?.rows || [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Admissions" head={["Patient", "UHID", "Bed", "Admitted", "Status"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed, fmtDate(r.admissionDate), r.status])} />
  );
}

// ── Report catalogue — one entry per sidebar item, grouped like ReportsHub. ──

type ReportItem = { key: string; label: string; Comp: React.ComponentType<{ data: any; from: string; to: string }> };
type ReportGroup = { heading: string; module?: string; items: ReportItem[] };

const GROUPS: ReportGroup[] = [
  { heading: "Overview", items: [{ key: "summary", label: "Summary & Trend", Comp: SummaryReport }] },
  {
    heading: "Vitals",
    items: [
      { key: "register", label: "Vitals Register", Comp: VitalsRegisterReport },
      { key: "abnormal", label: "Abnormal Vitals", Comp: AbnormalVitalsReport },
    ],
  },
  { heading: "Staff", items: [{ key: "staff", label: "Recorded by Staff", Comp: StaffWorkloadReport }] },
  {
    heading: "Ward & Beds",
    module: "IPD",
    items: [
      { key: "inpatients", label: "Current Inpatients", Comp: InpatientsReport },
      { key: "discharges", label: "Discharges", Comp: DischargesReport },
      { key: "admissions", label: "Admissions", Comp: AdmissionsReport },
    ],
  },
];

export default function NurseReports() {
  const { isModuleEnabled } = useEnabledModules();
  const visibleGroups = useMemo(() => GROUPS.filter((g) => !g.module || isModuleEnabled(g.module)), [isModuleEnabled]);

  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [active, setActive] = useState<string>(GROUPS[0].items[0].key);

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  // One fetch powers the Overview/Vitals/Staff groups — switching between
  // those reports just changes which slice of this same payload is rendered.
  // The Ward & Beds group calls the existing IPD reports endpoints directly
  // (no point duplicating that data/logic in a new nurse-side query).
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["nurse-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/nurse/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const ActiveComp = useMemo(() => {
    for (const g of visibleGroups) {
      const found = g.items.find((i) => i.key === active);
      if (found) return found.Comp;
    }
    return GROUPS[0].items[0].Comp;
  }, [active, visibleGroups]);

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Reports"
        subtitle="Nursing analytics — pick a report on the left. Every table is downloadable."
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
              sx={preset === p.key ? { bgcolor: NURSE_PURPLE } : undefined}
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
              {visibleGroups.map((g, gi) => (
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
                      sx={{ py: 0.75, "&.Mui-selected": { bgcolor: `${NURSE_PURPLE}14`, borderRight: `3px solid ${NURSE_PURPLE}` }, "&.Mui-selected:hover": { bgcolor: `${NURSE_PURPLE}22` } }}
                    >
                      <ListItemText primary={it.label} primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: active === it.key ? 700 : 500, color: active === it.key ? NURSE_PURPLE : "text.primary" }} />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          </Paper>

          {/* Active report */}
          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ActiveComp data={data} from={from} to={to} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
