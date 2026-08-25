import { useState } from "react";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Grid, TextField, Tabs, Tab } from "@mui/material";
import { LocalHotelRounded, ReplayRounded, AccessTimeRounded, PersonAddRounded, SavingsRounded, SpeedRounded, HeightRounded, WarningAmberRounded, MedicationRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto, formatDate } from "@/utils/format";
import { KpiCard, ReportFilters, ReportFilterSelect, ReportTable, TrendChart, hasPlottableData, useReportFilterOptions, type DateRange } from "@/features/reports/kit";

const ACCENT = BRAND.action;
const inr = formatINRAuto;
const initialRange = (): DateRange => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const ts = (v: any) => (v ? new Date(v).getTime() : 0);

export default function IpdReports() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader title="IPD Reports" subtitle="In-patient census, discharges, registrations and advances" />
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

export function InPatients() {
  const [asOf, setAsOf] = useState(dayjs().format("YYYY-MM-DD"));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-inpatients", asOf],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/inpatients", { params: { asOf } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const byWard: any[] = data?.byWard ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="As of date" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} sx={{ minWidth: 180 }} />
      </Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <KpiCard icon={<LocalHotelRounded />} accent={ACCENT} label="Current inpatients" value={String(data.totals.inpatients)} sub={`across ${byWard.length} ward${byWard.length === 1 ? "" : "s"}`} />
            </Grid>
          </Grid>
          <ReportTable
            title={`In-patient list (as of ${asOf})`}
            filename={`inpatients_${asOf}`}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "admissionDate", label: "Admitted", format: formatDate, value: (r) => ts(r.admissionDate) },
              { key: "days", label: "Days", align: "right" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function Discharges() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [doctorId, setDoctorId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-discharges", range.from, range.to, doctorId],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/discharges", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><KpiCard icon={<ReplayRounded />} accent={ACCENT} label="Discharges" value={String(data.totals.discharges)} current={data.totals.discharges} previous={prev?.discharges} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><KpiCard icon={<AccessTimeRounded />} accent={SEMANTIC.info} label="Avg stay (days)" value={String(data.totals.avgStay)} current={data.totals.avgStay} previous={prev?.avgStay} higherIsBetter={false} /></Grid>
          </Grid>
          <ReportTable
            title="Discharge detail"
            filename={`discharges_${range.from}_${range.to}`}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "admissionDate", label: "Admitted", format: formatDate, value: (r) => ts(r.admissionDate) },
              { key: "dischargeDate", label: "Discharged", format: formatDate, value: (r) => ts(r.dischargeDate) },
              { key: "lengthOfStay", label: "Stay (days)", align: "right" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function IpRegistrations() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-registrations", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/registrations", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const trend: any[] = data?.trend ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <KpiCard icon={<PersonAddRounded />} accent={ACCENT} label="Admissions" value={String(data.totals.admissions)} current={data.totals.admissions} previous={prev?.admissions} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <KpiCard icon={<LocalHotelRounded />} accent={SEMANTIC.info} label="Still admitted" value={String(data.totals.stillAdmitted ?? 0)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <KpiCard icon={<AccessTimeRounded />} accent="#8b5cf6" label="Average stay" value={`${data.totals.avgStayDays ?? 0} d`} />
            </Grid>
          </Grid>
          {hasPlottableData(trend, ["admissions"]) && (
            <Box sx={{ mb: 2.5 }}>
              <TrendChart title="Admissions per day" data={trend} xKey="date" series={[{ key: "admissions", label: "Admissions", type: "area" }]} />
            </Box>
          )}

          {/* Where the admissions went and who took them. The register listed
              beds and dates without ever saying which ward carried the load or
              which consultant is accountable for the stay. */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {([["byWard", "By ward"], ["byDoctor", "By admitting doctor"], ["byStatus", "By status"]] as const).map(([key, title]) => (
              <Grid key={key} size={{ xs: 12, md: 4 }}>
                <ReportTable
                  title={title}
                  filename={`ip_registrations_${key}_${range.from}_${range.to}`}
                  maxHeight={260}
                  columns={[{ key: "label", label: title.replace(/^By /, "") }, { key: "count", label: "Admissions", align: "right" }]}
                  rows={(data as Record<string, unknown>)[key] as { label: string; count: number }[] ?? []}
                />
              </Grid>
            ))}
          </Grid>

          <ReportTable
            title="IP registration detail"
            filename={`ip_registrations_${range.from}_${range.to}`}
            columns={[
              { key: "admissionNumber", label: "Admission #" },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "doctorName", label: "Doctor" },
              { key: "diagnosis", label: "Admitting diagnosis" },
              { key: "admissionDate", label: "Admitted", format: formatDate, value: (r) => ts(r.admissionDate) },
              // Days so far while the stay runs, total once it has ended.
              { key: "days", label: "Days", align: "right" },
              { key: "status", label: "Status" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function IpAdvances() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-advances", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/advances", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const trend: any[] = data?.trend ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><KpiCard icon={<SavingsRounded />} accent={SEMANTIC.success} label="Advance collected" value={inr(data.totals.total)} current={Number(data.totals.total)} previous={prev ? Number(prev.total) : undefined} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><KpiCard icon={<AccessTimeRounded />} accent={ACCENT} label="Entries" value={String(data.totals.count)} current={data.totals.count} previous={prev?.count} /></Grid>
          </Grid>
          {hasPlottableData(trend, ["amount"]) && (
            <Box sx={{ mb: 2.5 }}>
              <TrendChart title="Advance collected per day" data={trend} xKey="date" series={[{ key: "amount", label: "Advance", type: "bar" }]} valueFormatter={inr} />
            </Box>
          )}
          {/* Which tender the money came through and who took it — the two
              questions the Day Book answers for counter collections, and this
              register could answer for neither. */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {([["byMethod", "By payment method", "Method"], ["byCollector", "By collector", "Collector"]] as const).map(([key, title, head]) => (
              <Grid key={key} size={{ xs: 12, md: 6 }}>
                <ReportTable
                  title={title}
                  filename={`ip_advances_${key}_${range.from}_${range.to}`}
                  maxHeight={260}
                  columns={[
                    { key: "label", label: head },
                    { key: "count", label: "Advances", align: "right" },
                    { key: "amount", label: "Amount", align: "right", format: (v) => inr(v as number), value: (r) => Number((r as { amount?: number }).amount) },
                  ]}
                  rows={(data as Record<string, unknown>)[key] as { label: string; count: number; amount: number }[] ?? []}
                />
              </Grid>
            ))}
          </Grid>

          <ReportTable
            title="IP advance detail"
            filename={`ip_advances_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: (v) => dayjs(v).format("DD MMM YY HH:mm"), value: (r) => ts(r.date) },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              // An advance is against a stay; without the admission it cannot
              // be traced back to what it was paying for.
              { key: "admissionNumber", label: "Admission #" },
              { key: "admissionStatus", label: "Stay" },
              { key: "method", label: "Method" },
              { key: "collectedBy", label: "Collected by" },
              { key: "amount", label: "Amount", align: "right", format: (v) => inr(v), value: (r) => Number(r.amount) },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

export function Occupancy() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-occupancy", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/occupancy", { params: { from: range.from, to: range.to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHotelRounded />} accent={ACCENT} label="Avg occupancy" value={`${data.totals.avgOccupancy}%`} sub={`${data.totals.totalBeds} beds`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent={SEMANTIC.info} label="Avg stay (ALOS)" value={`${data.totals.alos} d`} current={data.totals.alos} previous={prev?.alos} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SpeedRounded />} accent={SEMANTIC.success} label="Bed turnover" value={String(data.totals.turnover)} sub={`${data.totals.discharges} discharges`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<HeightRounded />} accent="#8b5cf6" label="Peak occupied" value={String(data.totals.peakOccupied)} sub={`of ${data.totals.totalBeds}`} /></Grid>
          </Grid>
          <ReportTable
            title="Daily occupancy"
            filename={`occupancy_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: formatDate, value: (r) => ts(r.date) },
              { key: "occupied", label: "Occupied beds", align: "right" },
              { key: "occupancyRate", label: "Occupancy %", align: "right", format: (v) => `${v}%`, value: (r) => Number(r.occupancyRate) },
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}

// Patient safety: scheduled medication doses that are past due and still
// uncharted (PENDING) for current + recently-closed inpatients — surfacing
// missed/undocumented administrations so the ward can act. Snapshot.
export function OverdueDoses() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-overdue-doses"],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/overdue-doses")).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WarningAmberRounded />} accent={SEMANTIC.danger} label="Overdue doses" value={String(data.totals.overdueDoses)} sub={`> ${data.graceMins}m past due`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MedicationRounded />} accent={BRAND.action} label="Patients affected" value={String(data.totals.patients)} /></Grid>
          </Grid>
          <ReportTable
            title="Overdue / uncharted medication doses"
            filename="overdue_doses"
            emptyText="No overdue doses — every scheduled dose is charted."
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "admissionStatus", label: "Admission" },
              { key: "bed", label: "Bed" },
              { key: "medicine", label: "Medicine" },
              { key: "dosage", label: "Dose" },
              { key: "route", label: "Route" },
              { key: "scheduledAt", label: "Scheduled", format: (v) => (v ? dayjs(v).format("DD MMM HH:mm") : "—"), value: (r) => ts(r.scheduledAt) },
              { key: "hoursOverdue", label: "Overdue (h)", align: "right", value: (r) => Number(r.hoursOverdue) },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}
