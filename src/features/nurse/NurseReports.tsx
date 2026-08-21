import { SEMANTIC, BRAND } from "@/styles/accents";
import KpiCard from "@/features/reports/kit/KpiCard";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  GroupRounded, MonitorHeartRounded, WarningAmberRounded, BadgeRounded,
  FileDownloadRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { ReportTruncationNote, ReportNavLayout } from "@/features/reports/kit";

const NURSE_PURPLE = BRAND.action;

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];

const fmtDate = (d: string) => dayjs(d).format("DD MMM YYYY");
const fmtDateTime = (d: string) => dayjs(d).format("DD MMM YYYY, hh:mm A");

// Downloadable table — every report on this page ends in one of these.
function SimpleTable({ title, head, rows, dense, note }: { title: string; head: string[]; rows: (string | number)[][]; dense?: boolean; note?: React.ReactNode }) {
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
      {note && <Box sx={{ mb: 1.5 }}>{note}</Box>}
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
  // The equal-length window before this one, so each count says which way it
  // is moving rather than standing alone.
  const p = data?.previous;
  const trend: any[] = data?.trend || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(4,1fr)" }, gap: 1.5 }}>
        <KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Vitals recorded"
          value={s?.totalVitalsRecorded || 0} current={s?.totalVitalsRecorded} previous={p?.totalVitalsRecorded} />
        <KpiCard icon={<GroupRounded />} accent={SEMANTIC.info} label="Unique patients"
          value={s?.uniquePatients || 0} current={s?.uniquePatients} previous={p?.uniquePatients} />
        {/* Fewer abnormal readings is the good direction here, unlike every
            other card on this row. */}
        <KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Abnormal readings"
          value={s?.abnormalReadings || 0} current={s?.abnormalReadings} previous={p?.abnormalReadings}
          higherIsBetter={false} />
        <KpiCard icon={<BadgeRounded />} accent={SEMANTIC.success} label="Staff recording"
          value={s?.staffRecording || 0} current={s?.staffRecording} previous={p?.staffRecording} />
      </Box>
      <SimpleTable title="Daily vitals recorded" head={["Date", "Vitals"]}
        rows={trend.map((t) => [fmtDate(t.date), Number(t.count)])} />
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
      note={<ReportTruncationNote truncated={data?.truncated} totalRows={data?.totalRows} shownRows={data?.shownRows} />}
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

  // Date range — shared across every report below.
  const toolbar = (
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
  );

  return (
    <ReportNavLayout
      title="Reports"
      subtitle="Nursing analytics — pick a report on the left. Every table is downloadable."
      groups={visibleGroups}
      accent={NURSE_PURPLE}
      actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      toolbar={toolbar}
      componentProps={{ data, from, to }}
      contentState={
        isLoading ? <ReportSkeleton />
          : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          : undefined
      }
    />
  );
}
