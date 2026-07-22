import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Grid, TextField, Tabs, Tab } from "@mui/material";
import { LocalHotelRounded, ReplayRounded, AccessTimeRounded, PersonAddRounded, SavingsRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportTable, TrendChart, DonutChart, type DateRange } from "@/features/reports/kit";

const ACCENT = ACCENTS.ipd;
const inr = formatINRAuto;
const initialRange = (): DateRange => ({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const fmtDate = (v: any) => (v ? dayjs(v).format("DD MMM YYYY") : "—");
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
            <Grid size={{ xs: 12, md: 4 }}>
              <KpiCard icon={<LocalHotelRounded />} accent={ACCENT} label="Current inpatients" value={String(data.totals.inpatients)} sub={`across ${byWard.length} ward${byWard.length === 1 ? "" : "s"}`} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <DonutChart title="Occupancy by ward" data={byWard} nameKey="ward" valueKey="count" height={260} />
            </Grid>
          </Grid>
          <ReportTable
            title={`In-patient list (as of ${asOf})`}
            filename={`inpatients_${asOf}`}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "admissionDate", label: "Admitted", format: fmtDate, value: (r) => ts(r.admissionDate) },
              { key: "days", label: "Days", align: "right" },
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}

export function Discharges() {
  const [range, setRange] = useState<DateRange>(initialRange);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-report-discharges", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/ipd/reports/discharges", { params: { from: range.from, to: range.to } })).data.data,
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
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<ReplayRounded />} accent={ACCENT} label="Discharges" value={String(data.totals.discharges)} current={data.totals.discharges} previous={prev?.discharges} spark={trend.map((t) => t.discharges)} /></Grid>
                <Grid size={{ xs: 12 }}><KpiCard icon={<AccessTimeRounded />} accent={SEMANTIC.info} label="Avg stay (days)" value={String(data.totals.avgStay)} current={data.totals.avgStay} previous={prev?.avgStay} higherIsBetter={false} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TrendChart title="Discharges over time" subtitle="Per day" data={trend} xKey="date" series={[{ key: "discharges", label: "Discharges" }]} height={260} />
            </Grid>
          </Grid>
          <ReportTable
            title="Discharge detail"
            filename={`discharges_${range.from}_${range.to}`}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "admissionDate", label: "Admitted", format: fmtDate, value: (r) => ts(r.admissionDate) },
              { key: "dischargeDate", label: "Discharged", format: fmtDate, value: (r) => ts(r.dischargeDate) },
              { key: "lengthOfStay", label: "Stay (days)", align: "right" },
            ]}
            rows={rows}
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
            <Grid size={{ xs: 12, md: 4 }}>
              <KpiCard icon={<PersonAddRounded />} accent={ACCENT} label="Admissions" value={String(data.totals.admissions)} current={data.totals.admissions} previous={prev?.admissions} spark={trend.map((t) => t.admissions)} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TrendChart title="Admissions over time" subtitle="Per day" data={trend} xKey="date" series={[{ key: "admissions", label: "Admissions" }]} height={260} />
            </Grid>
          </Grid>
          <ReportTable
            title="IP registration detail"
            filename={`ip_registrations_${range.from}_${range.to}`}
            columns={[
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "bed", label: "Bed" },
              { key: "admissionDate", label: "Admitted", format: fmtDate, value: (r) => ts(r.admissionDate) },
              { key: "status", label: "Status" },
            ]}
            rows={rows}
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
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}><KpiCard icon={<SavingsRounded />} accent={SEMANTIC.success} label="Advance collected" value={inr(data.totals.total)} current={Number(data.totals.total)} previous={prev ? Number(prev.total) : undefined} spark={trend.map((t) => t.amount)} /></Grid>
                <Grid size={{ xs: 12 }}><KpiCard icon={<AccessTimeRounded />} accent={ACCENT} label="Entries" value={String(data.totals.count)} current={data.totals.count} previous={prev?.count} /></Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TrendChart title="Advance collection over time" subtitle="Per day" data={trend} xKey="date" series={[{ key: "amount", label: "Advance (₹)" }]} valueFormatter={inr} height={260} />
            </Grid>
          </Grid>
          <ReportTable
            title="IP advance detail"
            filename={`ip_advances_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: (v) => dayjs(v).format("DD MMM YY HH:mm"), value: (r) => ts(r.date) },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "method", label: "Method" },
              { key: "amount", label: "Amount", align: "right", format: (v) => inr(v), value: (r) => Number(r.amount) },
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}
