import { SEMANTIC, BRAND } from "@/styles/accents";
import SimpleTable from "@/features/reports/kit/SimpleTable";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Grid, TextField, Tabs, Tab, Button, MenuItem,
} from "@mui/material";
import {
  EventRounded, CheckCircleRounded, CancelRounded, PaymentsRounded,
  PersonAddRounded, TrendingUpRounded, AccessTimeRounded, ReplayRounded, AccountBalanceWalletRounded,
  HotelRounded, LocalHotelRounded, MeetingRoomRounded, CallSplitRounded, MedicalInformationRounded, GroupRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { KpiCard, ReportFilters, ReportTable, ReportTruncationNote, TrendChart, BreakdownBar, hasPlottableData, type DateRange } from "@/features/reports/kit";

const ACCENT = BRAND.action;

/** A one-line breakdown row: a label and how many fall under it. */
type Tally = { label: string; count: number };
const inr = formatINRAuto;

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
          <Tab icon={<CallSplitRounded fontSize="small" />} iconPosition="start" label="Referral Sources" />
          <Tab icon={<PersonAddRounded fontSize="small" />} iconPosition="start" label="OP Registration" />
          <Tab icon={<AccountBalanceWalletRounded fontSize="small" />} iconPosition="start" label="OP Bills" />
          <Tab icon={<MedicalInformationRounded fontSize="small" />} iconPosition="start" label="Diagnosis-Wise" />
        </Tabs>
      </Paper>

      {tab === 0 && <DailyOpd />}
      {tab === 1 && <Analytics />}
      {tab === 2 && <Collection />}
      {tab === 3 && <Census />}
      {tab === 4 && <ReferralsByDoctor />}
      {tab === 5 && <OpRegistration />}
      {tab === 6 && <OpBills />}
      {tab === 7 && <DiagnosisWise />}
    </Box>
  );
}

// ── OP Registration ──────────────────────────────────────────────────────────
export function OpRegistration() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-op-registration", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/op-registration", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonAddRounded />} label="Registrations" value={String(data.totals.registrations)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CallSplitRounded />} label="Referred in" value={String(data.totals.withReferral ?? 0)} sub={`${data.totals.registrations - (data.totals.withReferral ?? 0)} walk-in`} accent={SEMANTIC.info} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<GroupRounded />} label="Average age" value={data.totals.avgAge == null ? "—" : `${data.totals.avgAge}`} accent="#8b5cf6" /></Grid>
          </Grid>

          {/* Who registered, not just how many. Age, gender and city were on
              the record all along and none of them reached this page, so it
              could not say who the hospital is drawing or from where. */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <SimpleTable title="By gender" head={["Gender", "Patients"]}
                rows={(data.byGender ?? []).map((g: Tally) => [g.label, String(g.count)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SimpleTable title="By age" head={["Age band", "Patients"]}
                rows={(data.byAgeBand ?? []).map((a: Tally) => [a.label, String(a.count)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              {/* Names the referrer where there is one — "Doctor" said a
                  referral existed without saying whose. */}
              <SimpleTable title="By referral source" head={["Source", "Patients"]}
                rows={(data.bySource ?? []).map((s: Tally) => [s.label, String(s.count)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SimpleTable title="Top cities" head={["City", "Patients"]}
                rows={(data.byCity ?? []).map((c: Tally) => [c.label, String(c.count)])} />
            </Grid>
          </Grid>

          <SimpleTable title="Registered patients" head={["UHID", "Name", "Gender", "Age", "Phone", "City", "Registered", "Referred by"]}
            rows={rows.map((r) => [
              r.uhid, r.name, r.gender ?? "—", r.age == null ? "—" : String(r.age),
              r.phone, r.city ?? "—",
              dayjs(r.registeredOn).format("DD MMM YYYY"),
              r.referrerName ?? r.referral,
            ])}
            note={<ReportTruncationNote truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows} />} />
        </Box>
      )}
    </Box>
  );
}

// ── OP Bills ─────────────────────────────────────────────────────────────────
export function OpBills() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const { data: opts } = useFilterOptions();
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-op-bills", from, to, doctorId, departmentId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/op-bills", { params: { from, to, doctorId: doctorId || undefined, departmentId: departmentId || undefined } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} label="Invoices" value={String(data.totals.invoices)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} label="Billed" value={inr(data.totals.billed)} accent="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} label="Collected" value={inr(data.totals.collected)} accent={SEMANTIC.success} /></Grid>
          </Grid>
          <SimpleTable title="OPD invoices" head={["Invoice", "Patient", "UHID", "Date", "Net", "Paid", "Balance", "Status"]}
            rows={rows.map((r) => [r.invoiceNumber, r.patientName, r.uhid, dayjs(r.invoiceDate).format("DD MMM YYYY"), inr(r.netAmount), inr(r.paidAmount), inr(r.balance), r.statusLabel])}
            note={<ReportTruncationNote truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows} />} />
        </Box>
      )}
    </Box>
  );
}

// ── Diagnosis-Wise ───────────────────────────────────────────────────────────
export function DiagnosisWise() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-diagnosis-wise", from, to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/diagnosis-wise", { params: { from, to } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];
  return (
    <Box>
      <Toolbar>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
      </Toolbar>
      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MedicalInformationRounded />} label="Consultations" value={String(data.totals.consultations)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} label="Distinct diagnoses" value={String(data.totals.distinctDiagnoses)} accent="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<GroupRounded />} label="Patients" value={String(data.totals.patients ?? 0)} accent={SEMANTIC.info} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} label="With follow-up" value={String(data.totals.withFollowUp ?? 0)} accent={SEMANTIC.warning} /></Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <SimpleTable title="By doctor" head={["Doctor", "Consultations"]}
                rows={(data.byDoctor ?? []).map((d: { doctor: string; count: number }) => [d.doctor, String(d.count)])} />
            </Grid>
          </Grid>

          {/* A diagnosis on its own is a word and a number. Patients separates
              a condition seen ten times in two people from one seen ten times
              in ten; the rest says who presents with it and who treats it. */}
          <SimpleTable
            title="Diagnoses"
            head={["Diagnosis", "Consultations", "Patients", "Share", "Usual doctor", "Gender split", "Avg age", "Follow-ups", "Last seen"]}
            rows={rows.map((r) => [
              r.diagnosis, String(r.count), String(r.patients ?? 0),
              `${Number(r.sharePct ?? 0).toFixed(1)}%`,
              r.topDoctor ?? "—",
              r.genderSplit || "—",
              r.avgAge == null ? "—" : String(r.avgAge),
              String(r.followUps ?? 0),
              r.lastSeen ? dayjs(r.lastSeen).format("DD MMM YYYY") : "—",
            ])} />
        </Box>
      )}
    </Box>
  );
}
// ── Referrals by Doctor ──────────────────────────────────────────────────────
export function ReferralsByDoctor() {
  const [range, setRange] = useState<DateRange>({ from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
  const [type, setType] = useState("");
  const [referrerId, setReferrerId] = useState("");
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-referrals", range.from, range.to, type, referrerId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/referrals", {
      params: { from: range.from, to: range.to, type: type || undefined, referrerId: referrerId || undefined }
    })).data.data
  });
  const s = data?.summary;
  const prev = data?.previous;
  const trend: any[] = data?.trend ?? [];
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <TextField select size="small" label="Type" value={type} sx={{ minWidth: 150 }}
          onChange={(e) => { setType(e.target.value); if (e.target.value === "EXTERNAL") setReferrerId(""); }}>
          <MenuItem value=""><em>All types</em></MenuItem>
          {(opts?.referralTypes ?? []).map((o) => <MenuItem key={String(o.id)} value={String(o.id)}>{o.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Referring doctor" value={referrerId} sx={{ minWidth: 200 }} disabled={type === "EXTERNAL"}
          onChange={(e) => setReferrerId(e.target.value)}>
          <MenuItem value=""><em>All doctors</em></MenuItem>
          {(opts?.doctors ?? []).map((o) => <MenuItem key={String(o.id)} value={String(o.id)}>{o.name}</MenuItem>)}
        </TextField>
      </ReportFilters>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MedicalInformationRounded />} accent={ACCENT} label="Referring doctors" value={String(s.referringDoctors)} current={s.referringDoctors} previous={prev?.referringDoctors} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonAddRounded />} accent={SEMANTIC.success} label="Referred patients" value={String(s.referredPatients)} current={s.referredPatients} previous={prev?.referredPatients} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CallSplitRounded />} accent={SEMANTIC.info} label="Internal / External" value={`${s.internal ?? 0} / ${s.external ?? 0}`} sub="referrers" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventRounded />} accent="#8b5cf6" label="Total visits" value={String(s.totalVisits)} current={s.totalVisits} previous={prev?.totalVisits} /></Grid>
          </Grid>

          {hasPlottableData(trend, ["patients"]) && (
            <Box sx={{ mb: 2.5 }}>
              <TrendChart title="Referred patients per day" data={trend} xKey="date" series={[{ key: "patients", label: "Referred patients", type: "area" }]} />
            </Box>
          )}

          <ReportTable
            title="Referrer detail"
            filename={`referrals_${range.from}_${range.to}`}
            columns={[
              { key: "name", label: "Doctor / referrer", value: (r) => r.name, format: (_v, r) => r.specialty ? `${r.name} (${r.specialty})` : r.name },
              { key: "type", label: "Type" },
              { key: "patientCount", label: "Patients", align: "right" },
              { key: "visitCount", label: "Visits", align: "right" },
            ]}
            rows={rows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── IPD Census ───────────────────────────────────────────────────────────────
export function Census() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [wardId, setWardId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-census", from, to, wardId],
    queryFn: async () => (await axiosInstance.get("/ipd/census", { params: { from, to, wardId: wardId || undefined } })).data.data,
  });
  const beds = data?.beds;

  return (
    <Box>
      <Toolbar onClear={wardId ? () => setWardId("") : undefined}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <FilterSelect label="Ward" value={wardId} onChange={setWardId} options={opts?.wards} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHotelRounded />} label="Current inpatients" value={String(data.currentInpatients)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MeetingRoomRounded />} label="Bed occupancy" value={`${beds.occupancyRate}%`} accent={SEMANTIC.danger} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonAddRounded />} label="Admissions" value={String(data.movement.admissions)} accent={SEMANTIC.success} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} label="Discharges" value={String(data.movement.discharges)} accent="#8b5cf6" /></Grid>
          </Grid>

          <SimpleTable title="Ward detail" head={["Ward", "Beds", "Occupied", "Available", "Occupancy"]}
            rows={data.byWard.map((w: any) => [w.wardName || "—", String(w.totalBeds), String(w.occupied), String(w.available), `${w.occupancyRate}%`])} />
        </Box>
      )}
    </Box>
  );
}

// ── Daily OPD ────────────────────────────────────────────────────────────────
export function DailyOpd() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-daily-opd", date, doctorId, departmentId, statusId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/daily-opd", {
      params: { date, doctorId: doctorId || undefined, departmentId: departmentId || undefined, statusId: statusId || undefined }
    })).data.data
  });
  const t = data?.totals;
  const clear = () => { setDoctorId(""); setDepartmentId(""); setStatusId(""); };
  const hasFilters = !!(doctorId || departmentId || statusId);

  return (
    <Box>
      <Toolbar onClear={hasFilters ? clear : undefined}>
        <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} sx={{ minWidth: 180 }} />
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
        <FilterSelect label="Status" value={statusId} onChange={setStatusId} options={opts?.appointmentStatuses} />
      </Toolbar>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventRounded />} label="Appointments" value={String(t.appointments)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Completed" value={String(t.completed)} accent={SEMANTIC.success} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CancelRounded />} label="Cancelled" value={String(t.cancelled)} accent={SEMANTIC.danger} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} label="Collected" value={inr(t.collected)} accent="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Checked in" value={String(t.checkedIn)} accent={SEMANTIC.info} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} label="Follow-ups" value={String(t.followUps)} accent={SEMANTIC.warning} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventRounded />} label="New OPD" value={String(t.newOpd)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonAddRounded />} label="New patients" value={String(t.newPatients)} accent="#ec4899" /></Grid>
          </Grid>

          {/* By doctor and by status came back with every request and neither
              was rendered — the summary said how many appointments there were
              without saying who saw them or where they ended up. */}
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <SimpleTable title="By department" head={["Department", "Appointments"]}
                rows={data.byDepartment.map((d: any) => [d.departmentName, String(d.count)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <SimpleTable title="By doctor" head={["Doctor", "Total", "Completed"]}
                rows={(data.byDoctor ?? []).map((d: { doctorName: string; total: number; completed: number }) => [d.doctorName, String(d.total), String(d.completed)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <SimpleTable title="By status" head={["Status", "Appointments"]}
                rows={(data.byStatus ?? []).map((s: { label: string; count: number }) => [s.label, String(s.count)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── OPD Visit Register ───────────────────────────────────────────────────────
// Who attended OPD, on which day. Daily OPD Summary answers "how many" for one
// day and OP Registration lists only NEWLY registered patients, so a returning
// patient's visit appeared in neither. This is the OPD counterpart to IPD's
// "IP Registrations" — same shape, so the two read alike.
export function OpdVisitRegister() {
  const [range, setRange] = useState<DateRange>({
    from: dayjs().subtract(29, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  });
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [visitType, setVisitType] = useState("");
  const { data: opts } = useFilterOptions();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-opd-visits", range.from, range.to, doctorId, departmentId, statusId, visitType],
    queryFn: async () => (await axiosInstance.get("/reception/reports/opd-visits", {
      params: {
        from: range.from, to: range.to,
        doctorId: doctorId || undefined, departmentId: departmentId || undefined, statusId: statusId || undefined,
        visitType: visitType || undefined
      }
    })).data.data
  });

  const rows: any[] = data?.rows ?? [];
  const byDate: any[] = data?.byDate ?? [];
  const t = data?.totals;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
        <FilterSelect label="Status" value={statusId} onChange={setStatusId} options={opts?.appointmentStatuses} />
        <FilterSelect
          label="Visit type" value={visitType} onChange={setVisitType}
          options={[{ id: "First visit", name: "First visit" }, { id: "Repeat", name: "Repeat" }, { id: "Follow-up", name: "Follow-up" }]}
        />
      </ReportFilters>

      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventRounded />} label="Visits" value={String(t.visits)} accent={ACCENT} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<GroupRounded />} label={`Unique patients · ${t.avgVisitsPerPatient} visits each`} value={String(t.uniquePatients)} accent="#8b5cf6" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Completed" value={String(t.completed)} accent={SEMANTIC.success} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CancelRounded />} label="Cancelled" value={String(t.cancelled)} accent={SEMANTIC.danger} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonAddRounded />} label="First visits" value={String(t.firstVisits)} accent="#ec4899" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} label="Repeat visits" value={String(t.repeatVisits)} accent={SEMANTIC.info} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} label="Follow-ups" value={String(t.followUps)} accent={SEMANTIC.warning} /></Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <ReportTable
              title="Day-wise summary"
              filename={`opd_visits_by_day_${range.from}_${range.to}`}
              maxHeight={300}
              columns={[
                { key: "date", label: "Date", format: (v: string) => dayjs(v).format("DD MMM YYYY") },
                { key: "visits", label: "Visits", align: "right" },
                { key: "firstVisits", label: "First visit", align: "right" },
                { key: "repeatVisits", label: "Repeat", align: "right" },
                { key: "uniquePatients", label: "Unique patients", align: "right" },
                { key: "completed", label: "Completed", align: "right" },
                { key: "cancelled", label: "Cancelled", align: "right" },
              ]}
              rows={byDate}
              emptyText="No OPD visits in this period."
            />
          </Box>

          <ReportTable
            title="Visit detail"
            filename={`opd_visits_${range.from}_${range.to}`}
            columns={[
              { key: "visitDate", label: "Date", format: (v: string) => dayjs(v).format("DD MMM YYYY"), value: (r: any) => new Date(r.visitDate).getTime() },
              { key: "token", label: "Token", align: "right", format: (v: number | null) => (v ?? "—") },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "phone", label: "Phone" },
              { key: "doctorName", label: "Doctor" },
              { key: "departmentName", label: "Department" },
              { key: "visitType", label: "Type" },
              { key: "status", label: "Status" },
            ]}
            rows={rows}
            emptyText="No OPD visits in this period."
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Appointment Analytics ────────────────────────────────────────────────────
export function Analytics() {
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-analytics", from, to, doctorId, departmentId, statusId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/appointment-analytics", {
      params: { from, to, doctorId: doctorId || undefined, departmentId: departmentId || undefined, statusId: statusId || undefined }
    })).data.data
  });
  const t = data?.totals;
  const p = data?.previous;

  return (
    <Box>
      <ReportFilters value={{ from, to }} onChange={(r) => { setFrom(r.from); setTo(r.to); }}>
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
        <FilterSelect label="Status" value={statusId} onChange={setStatusId} options={opts?.appointmentStatuses} />
      </ReportFilters>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventRounded />} accent={ACCENT} label="Total appointments" value={String(t.appointments)} current={t.appointments} previous={p?.appointments} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} accent={SEMANTIC.success} label="Completion rate" value={`${t.completionRate}%`} current={t.completionRate} previous={p?.completionRate} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CancelRounded />} accent={SEMANTIC.danger} label="Cancellation rate" value={`${t.cancellationRate}%`} current={t.cancellationRate} previous={p?.cancellationRate} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent="#8b5cf6" label="Avg / day" value={String(t.avgPerDay)} current={t.avgPerDay} previous={p?.avgPerDay} /></Grid>
          </Grid>

          {/* When the clinic is busy, which is what this report is for and what
              it used to leave out: the endpoint already returns the hour-of-day
              and weekday distributions, and nothing rendered them. Hour first —
              it is the one that drives how a day is staffed. */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <BreakdownBar
                title="By hour of day" subtitle="When appointments are booked"
                data={(data.byHour ?? []).map((h: { hour: number; count: number }) => ({
                  ...h, label: `${String(h.hour).padStart(2, "0")}:00`,
                }))}
                categoryKey="label" valueKey="count" valueName="Appointments"
                horizontal={false} labelWidth={40}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <BreakdownBar
                title="By weekday" subtitle="Which days carry the load"
                data={data.byWeekday ?? []} categoryKey="day" valueKey="count"
                valueName="Appointments" colorIndex={1} labelWidth={90}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleTable title="Top doctors" head={["Doctor", "Appointments"]} rows={data.byDoctor.map((d: any) => [d.doctorName, String(d.count)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              {/* The completion and cancellation rates above are two slices of
                  this; the rest of the statuses had nowhere to appear. */}
              <SimpleTable title="By status" head={["Status", "Appointments"]}
                rows={(data.byStatus ?? []).map((s: { label: string; count: number }) => [s.label, String(s.count)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Collection ───────────────────────────────────────────────────────────────
export function Collection() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: opts } = useFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-collection", from, to, paymentMethodId, collectedBy],
    queryFn: async () => (await axiosInstance.get("/reception/reports/collection", {
      params: { from, to, paymentMethodId: paymentMethodId || undefined, collectedBy: collectedBy || undefined }
    })).data.data
  });
  const t = data?.totals;
  const p = data?.previous;

  return (
    <Box>
      <ReportFilters value={{ from, to }} onChange={(r) => { setFrom(r.from); setTo(r.to); }}>
        <FilterSelect label="Payment method" value={paymentMethodId} onChange={setPaymentMethodId} options={opts?.paymentMethods} />
        <FilterSelect label="Collector" value={collectedBy} onChange={setCollectedBy} options={opts?.collectors} width={200} />
      </ReportFilters>

      {isLoading ? <Loading /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box ref={ref}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PaymentsRounded />} accent={SEMANTIC.success} label="Gross collected" value={inr(t.gross)} current={t.gross} previous={p?.gross} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} accent={SEMANTIC.danger} label="Refunds" value={inr(t.refunded)} current={t.refunded} previous={p?.refunded} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={ACCENT} label="Net" value={inr(t.net)} current={t.net} previous={p?.net} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccessTimeRounded />} accent="#8b5cf6" label="Transactions" value={String(t.transactions)} current={t.transactions} previous={p?.transactions} /></Grid>
          </Grid>

          {/* The endpoint returns four breakdowns and only the collector one
              was rendered. Method is the one a desk actually reconciles
              against — the cash drawer has to match the cash line, and there
              was no cash line. */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleTable title="By payment method" head={["Method", "Txns", "Amount"]}
                rows={(data.byMethod ?? []).map((m: { method: string; count: number; amount: number }) => [m.method, String(m.count), inr(m.amount)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleTable title="By collector" head={["Collector", "Txns", "Amount"]}
                rows={data.byCollector.map((c: any) => [c.collector, String(c.count), inr(c.amount)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              {/* Which shift took the money — the handover question. */}
              <SimpleTable title="By shift" head={["Shift", "Txns", "Amount"]}
                rows={(data.byShift ?? []).map((s: { shift: string; count: number; amount: number }) => [s.shift, String(s.count), inr(s.amount)])} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleTable title="By day" head={["Date", "Txns", "Amount"]}
                rows={(data.byDay ?? []).map((d: { date: string; count: number; amount: number }) => [dayjs(d.date).format("DD MMM YYYY"), String(d.count), inr(d.amount)])} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────
type Opt = { id: string | number; name: string };
type FilterOptions = {
  doctors: Opt[]; departments: Opt[]; appointmentStatuses: Opt[];
  paymentMethods: Opt[]; collectors: Opt[]; wards: Opt[]; referralTypes: Opt[];
};

// Shared across tabs — react-query dedupes by key, so it's fetched once.
function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ["report-filter-options"],
    queryFn: async () => (await axiosInstance.get("/reception/reports/filter-options")).data.data,
    staleTime: 5 * 60 * 1000,
  });
}

function FilterSelect({ label, value, onChange, options, width = 180 }: { label: string; value: string; onChange: (v: string) => void; options?: Opt[]; width?: number }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: width }}>
      <MenuItem value=""><em>All</em></MenuItem>
      {(options ?? []).map((o) => <MenuItem key={String(o.id)} value={String(o.id)}>{o.name}</MenuItem>)}
    </TextField>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
function Toolbar({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
      {children}
      <Box sx={{ flex: 1 }} />
      {onClear && <Button variant="text" onClick={onClear} sx={{ textTransform: "none", color: "text.secondary" }}>Clear</Button>}
    </Box>
  );
}

function Loading() { return <ReportSkeleton />; }

