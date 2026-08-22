import { SEMANTIC, BRAND } from "@/styles/accents";
import { formatDate, formatDateTime } from "@/utils/format";
import SimpleTable from "@/features/reports/kit/SimpleTable";
import KpiCard from "@/features/reports/kit/KpiCard";
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, TextField, Button, ButtonGroup,
} from "@mui/material";
import {
  GroupRounded, EventAvailableRounded, MedicationRounded,
  ScienceRounded, MonitorHeartRounded, DescriptionRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { ReportTruncationNote, ReportNavLayout } from "@/features/reports/kit";

const DOCTOR_BLUE = BRAND.action;

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];


// Downloadable table — every report on this page ends in one of these.

// ── Individual report views — each is one item in the sidebar, rendered on
// its own rather than all stacked on one page. All read from the single
// already-fetched payload (one backend call powers every report here). ─────

function SummaryReport({ data }: { data: any }) {
  const s = data?.summary;
  // The equal-length window before this one, so each count says which way it is
  // moving rather than standing alone.
  const p = data?.previous;
  const trend: any[] = data?.trend || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
        <KpiCard icon={<DescriptionRounded />} accent={BRAND.action} label="Consultations"
          value={s?.totalConsultations || 0} current={s?.totalConsultations} previous={p?.totalConsultations} />
        <KpiCard icon={<GroupRounded />} accent={BRAND.actionDark} label="Unique patients"
          value={s?.uniquePatients || 0} current={s?.uniquePatients} previous={p?.uniquePatients} />
        <KpiCard icon={<EventAvailableRounded />} accent={SEMANTIC.success} label="Completed appointments"
          value={s?.completedAppointments || 0} current={s?.completedAppointments} previous={p?.completedAppointments} />
        <KpiCard icon={<MedicationRounded />} accent={SEMANTIC.info} label="Prescriptions"
          value={s?.prescriptions || 0} current={s?.prescriptions} previous={p?.prescriptions} />
        <KpiCard icon={<ScienceRounded />} accent={SEMANTIC.warning} label="Lab orders"
          value={s?.labOrders || 0} current={s?.labOrders} previous={p?.labOrders} />
        <KpiCard icon={<MonitorHeartRounded />} accent={BRAND.action} label="Radiology orders"
          value={s?.radiologyOrders || 0} current={s?.radiologyOrders} previous={p?.radiologyOrders} />
      </Box>
      <SimpleTable title="Daily consultations" head={["Date", "Consultations"]}
        rows={trend.map((t) => [formatDate(t.date), Number(t.count)])} />
    </Box>
  );
}

function DiagnosesReport({ data }: { data: any }) {
  const topDiagnoses: any[] = data?.topDiagnoses || [];
  return (
    <SimpleTable title="Diagnoses breakdown" head={["Diagnosis", "Cases"]}
      rows={topDiagnoses.map((d) => [d.diagnosis, Number(d.count)])} />
  );
}

function GenderReport({ data }: { data: any }) {
  const genderSplit: any[] = data?.genderSplit || [];
  return (
    <SimpleTable title="Gender split" head={["Gender", "Patients"]}
      rows={genderSplit.map((g) => [g.label, Number(g.count)])} />
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
      rows={consultationsList.map((c) => [formatDateTime(c.date), c.patientName, c.uhid, c.diagnosis, Number(c.prescriptions)])}
      note={<ReportTruncationNote truncated={data?.truncated} totalRows={data?.totalRows} shownRows={data?.shownRows} />}
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

  // Date range — shared across every report below.
  const toolbar = (
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
  );

  return (
    <ReportNavLayout
      title="My Reports"
      subtitle="Your practice analytics — pick a report on the left. Every table is downloadable."
      groups={GROUPS}
      accent={DOCTOR_BLUE}
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
