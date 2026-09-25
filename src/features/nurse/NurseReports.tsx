import { SEMANTIC, BRAND } from "@/styles/accents";
import type { NurseReportsData, VitalsRow } from "./nurseReports.types";
import type { InPatientsReport, DischargesReport, IpRegistrationsReport } from "@/features/ipd/ipdReports.types";
import { formatDate, formatDateTime } from "@/utils/format";
import SimpleTable from "@/features/reports/kit/SimpleTable";
import KpiCard from "@/features/reports/kit/KpiCard";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, TextField, Button, ButtonGroup,
} from "@mui/material";
import {
  GroupRounded, MonitorHeartRounded, WarningAmberRounded, BadgeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { ReportNavLayout, useReportPaging } from "@/features/reports/kit";

const NURSE_PURPLE = BRAND.action;

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];


// Downloadable table — every report on this page ends in one of these.

/**
 * What every report on this page is handed. The two vitals registers come from
 * the same payload but are separate lists, so each carries its own page state
 * rather than sharing one that would move both at once.
 */
type Paging = ReturnType<typeof useReportPaging>;
type ReportProps = {
  data: NurseReportsData;
  from: string;
  to: string;
  vitalsPaging: Paging;
  abnormalPaging: Paging;
  busy?: boolean;
};

// ── Reports fed by the shared /nurse/reports payload ─────────────────────────

function SummaryReport({ data }: { data: NurseReportsData }) {
  const s = data?.summary;
  // The equal-length window before this one, so each count says which way it
  // is moving rather than standing alone.
  const p = data?.previous;
  const trend: NurseReportsData["trend"] = data?.trend || [];
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
        rows={trend.map((t) => [formatDate(t.date), Number(t.count)])} />
    </Box>
  );
}

// One reading as a table row, in each register's own shape. Shared by the page
// on screen and by its export, so a download can't be shaped differently.
// ?? not ||: a reading of 0 is a real observation (a pain score, a blood
// sugar), and || would blank it as though it were never taken.
const toVitalsRow = (v: VitalsRow) => [
  formatDateTime(v.date), v.patientName, v.uhid,
  v.bp ?? "—", v.pulse ?? "—", v.temperatureC ?? "—", v.oxygenSaturation ?? "—", v.weightKg ?? "—",
  v.recordedBy ?? "—",
];
// flags is what puts a row on the abnormal list, but it is still nullable on
// the wire — joining it unguarded would throw on the one row that arrived
// without it, taking the whole register down.
const toAbnormalRow = (v: VitalsRow) => [
  formatDateTime(v.date), v.patientName, v.uhid,
  v.bp ?? "—", v.pulse ?? "—", v.temperatureC ?? "—", v.oxygenSaturation ?? "—",
  (v.flags ?? []).join(", ") || "—",
  v.recordedBy ?? "—",
];

/** The whole (unpaged) payload, for an export. Asking for no page is what gets it. */
const fetchWholeReport = async (from: string, to: string): Promise<NurseReportsData> =>
  (await axiosInstance.get("/nurse/reports", { params: { from, to } })).data.data;

function VitalsRegisterReport({ data, from, to, vitalsPaging, busy }: ReportProps) {
  const vitalsList: VitalsRow[] = data?.vitalsList || [];
  const total = data?.vitalsMeta?.totalRows ?? vitalsList.length;
  return (
    <SimpleTable
      title="Vitals register"
      head={["Date", "Patient", "UHID", "BP", "Pulse", "Temp (°C)", "SpO2 (%)", "Weight (kg)", "Recorded by"]}
      rows={vitalsList.map(toVitalsRow)}
      exportRows={async () => ((await fetchWholeReport(from, to)).vitalsList ?? []).map(toVitalsRow)}
      period={`${formatDate(from)} to ${formatDate(to)}`}
      pagination={vitalsPaging.bind(total, busy)}
    />
  );
}

function AbnormalVitalsReport({ data, from, to, abnormalPaging, busy }: ReportProps) {
  const abnormalList: VitalsRow[] = data?.abnormalList || [];
  const total = data?.abnormalMeta?.totalRows ?? abnormalList.length;
  return (
    <SimpleTable
      title="Abnormal vitals — needs review"
      head={["Date", "Patient", "UHID", "BP", "Pulse", "Temp (°C)", "SpO2 (%)", "Flags", "Recorded by"]}
      rows={abnormalList.map(toAbnormalRow)}
      exportRows={async () => ((await fetchWholeReport(from, to)).abnormalList ?? []).map(toAbnormalRow)}
      period={`${formatDate(from)} to ${formatDate(to)}`}
      pagination={abnormalPaging.bind(total, busy)}
    />
  );
}

function StaffWorkloadReport({ data }: { data: NurseReportsData }) {
  const byStaff: NurseReportsData["byStaff"] = data?.byStaff || [];
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
    queryFn: async (): Promise<InPatientsReport> => (await axiosInstance.get("/ipd/reports/inpatients", { params: { asOf: to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Current inpatients" head={["Patient", "UHID", "Bed", "Admitted", "Days"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed || "—", formatDate(r.admissionDate), Number(r.days)])} />
  );
}

function DischargesReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-ipd-discharges", from, to],
    queryFn: async (): Promise<DischargesReport> => (await axiosInstance.get("/ipd/reports/discharges", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Discharges" head={["Patient", "UHID", "Bed", "Admitted", "Discharged", "Length of stay"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed || "—", formatDate(r.admissionDate), r.dischargeDate ? formatDate(r.dischargeDate) : "—", Number(r.lengthOfStay)])} />
  );
}

function AdmissionsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-ipd-registrations", from, to],
    queryFn: async (): Promise<IpRegistrationsReport> => (await axiosInstance.get("/ipd/reports/registrations", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={22} /></Box>;
  return (
    <SimpleTable title="Admissions" head={["Patient", "UHID", "Bed", "Admitted", "Status"]}
      rows={rows.map((r) => [r.patientName, r.uhid, r.bed || "—", formatDate(r.admissionDate), r.status])} />
  );
}

// ── Report catalogue — one entry per sidebar item, grouped like ReportsHub. ──

type ReportItem = { key: string; label: string; Comp: React.ComponentType<ReportProps> };
type ReportGroup = { heading: string; module?: string; items: ReportItem[] };

/**
 * Exported so the hospital-admin report hub can carry these as one "Nursing"
 * group rather than a separate screen - the same way it already carries the lab
 * and pharmacy reports. This stays the single definition; the hub re-presents
 * it, and the nurse panel still renders it here, because nurses have no hub.
 */
export const NURSE_REPORT_GROUPS: ReportGroup[] = [
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

/**
 * What every nursing report needs from the screen around it: the date range,
 * the two registers' paging, and the one fetch that feeds them.
 *
 * The report components are deliberately dumb — they render props, they do
 * not fetch — so they only work inside something that supplies this. The
 * hospital report hub folded them in WITHOUT it, and got nothing: Abnormal
 * Vitals called abnormalPaging.bind on undefined and crashed the page, and
 * the rest rendered empty. Pulled out so the hub can supply the same shell.
 */
function useNurseReportShell() {

  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  // Each register pages on its own keys — see ReportProps.
  const vitalsPaging = useReportPaging({ prefix: "vitals" });
  const abnormalPaging = useReportPaging({ prefix: "abnormal" });

  // Narrowing the range while on page 40 of a register would leave the reader
  // staring at an empty table, so every date change sends both back to page 1.
  const firstPage = () => { vitalsPaging.onPageChange(0); abnormalPaging.onPageChange(0); };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    firstPage();
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  // One fetch powers the Overview/Vitals/Staff groups — switching between
  // those reports just changes which slice of this same payload is rendered.
  // The Ward & Beds group calls the existing IPD reports endpoints directly
  // (no point duplicating that data/logic in a new nurse-side query).
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["nurse-reports", from, to, vitalsPaging.page, vitalsPaging.pageSize, abnormalPaging.page, abnormalPaging.pageSize],
    queryFn: async () => (await axiosInstance.get("/nurse/reports", {
      params: { from, to, ...vitalsPaging.params, ...abnormalPaging.params },
    })).data.data,
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
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPreset(""); firstPage(); }} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPreset(""); firstPage(); }} />
      </Box>
    </Paper>
  );

  return {
    toolbar,
    componentProps: { data, from, to, vitalsPaging, abnormalPaging, busy: isFetching },
    contentState: isLoading ? <ReportSkeleton />
      : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      : undefined,
    isFetching,
  };
}

export default function NurseReports() {
  const { isModuleEnabled } = useEnabledModules();
  const visibleGroups = useMemo(() => NURSE_REPORT_GROUPS.filter((g) => !g.module || isModuleEnabled(g.module)), [isModuleEnabled]);
  const shell = useNurseReportShell();

  return (
    <ReportNavLayout
      title="Reports"
      subtitle="Nursing analytics — pick a report on the left. Every table is downloadable."
      groups={visibleGroups}
      accent={NURSE_PURPLE}
      actions={shell.isFetching ? <HeartbeatLoader size={22} /> : undefined}
      toolbar={shell.toolbar}
      componentProps={shell.componentProps}
      contentState={shell.contentState}
    />
  );
}

/**
 * One nursing report with its own date range and data — for a screen that
 * lists it among others, as the hospital report hub does. The same shape the
 * hub already uses for theatre reports: mount the real thing, pinned.
 */
export function NurseReportPanel({ report }: { report: string }) {
  const shell = useNurseReportShell();
  const Comp = NURSE_REPORT_GROUPS.flatMap((g) => g.items).find((i) => i.key === report)?.Comp;
  if (!Comp) return null;
  return (
    <>
      {shell.toolbar}
      {shell.contentState ?? <Comp {...shell.componentProps} />}
    </>
  );
}

/**
 * The nursing groups as the hub carries them: every item self-supplying, and
 * every key prefixed. The prefix is not decoration — the hub resolves ?view=
 * by the FIRST item with that key, and "register" (Vitals Register) and
 * "discharges" collided with Insurance's Claims Register and the hub's own
 * IPD Discharges, making whichever came second unreachable.
 */
export const NURSE_HUB_GROUPS = NURSE_REPORT_GROUPS.map((g) => ({
  ...g,
  items: g.items.map((i) => {
    const Pinned = () => <NurseReportPanel report={i.key} />;
    return { key: `nursing-${i.key}`, label: i.label, Comp: Pinned };
  }),
}));
