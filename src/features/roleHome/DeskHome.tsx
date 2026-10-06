import { useNavigate } from "react-router-dom";
import { Box, Grid, Typography } from "@mui/material";
import {
  HotelRounded, KingBedRounded, CleaningServicesRounded, CurrencyRupeeRounded, ReceiptLongRounded,
  ExitToAppRounded, HelpOutlineRounded, HourglassTopRounded, HealthAndSafetyRounded, DescriptionRounded,
  AssignmentLateRounded, EventBusyRounded, GavelRounded, FolderSharedRounded, VerifiedRounded,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import ErrorState from "@/components/ErrorState";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { formatINR, formatDateTime } from "@/utils/format";
import { apiErrorText } from "@/utils/apiError";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";
import { useRoleHome } from "./useRoleHome";
import Freshness from "./Freshness";

/**
 * My desk — the home of the front office's desk roles (15_System_Roles:
 * Admission Desk, Billing, TPA / Insurance Desk, Medical Records). Each role
 * held gets its section; someone who holds none of them (the Receptionist, an
 * admin) sees all four. Every row leads to the screen where it is dealt with.
 */

type Short<T> = { count: number; rows: T[] };
const inr = (v: number | null | undefined) => formatINR(v ?? 0, 0);
/** How long ago, as "3d" / "5h" / "now". */
const since = (iso: string | null | undefined) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d` : h >= 1 ? `${h}h` : "now";
};

interface AdmissionDesk {
  beds: { total: number; free: number; occupied: number; turnaround: number };
  waitingForBed: Short<{ admissionId: string; patientName: string; uhid: string; since: string }>;
  reservationsEndingToday: Short<{ bedId: string; bed: string; until: string }>;
  dischargesStarted: Short<{ admissionId: string; patientName: string; bed: string | null; since: string }>;
}
interface Billing {
  collectedToday: number;
  unpaidBills: { count: number; totalDue: number; rows: { invoiceId: string; invoiceNumber: string; balance: number; ageDays: number }[] };
  finalBillsToMake: Short<{ admissionId: string; patientName: string; bed: string | null; since: string }>;
  staysWithoutAdvance: Short<{ admissionId: string; patientName: string; bed: string | null; days: number | null }>;
}
type ClaimRow = { claimId: string; claimNumber: string; patientName: string; status: string; since: string; days?: number | null };
interface Tpa {
  queried: Short<ClaimRow>;
  preAuthPending: Short<ClaimRow>;
  ageing: Short<ClaimRow>;
  insuredWithoutClaim: Short<{ admissionId: string; patientName: string; bed: string | null; payerType: string | null }>;
  roomsOverLimit: Short<{ admissionId: string; patientName: string; bed: string | null; limit: number; rent: number; over: number }>;
}
interface Mrd {
  summariesMissing: Short<{ admissionId: string; admissionNumber: string | null; patientName: string; dischargedOn: string }>;
  consentsMissing: Short<{ surgeryId: string; patientName: string; procedure: string; at: string }>;
  dischargedThisWeek: number;
  medicoLegal?: { open: number; policePending: number };
  filesOverdue?: number;
  certificatesThisWeek?: number;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.6, display: "block" }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>{subtitle}</Typography>
      {children}
    </Box>
  );
}

const tile = { xs: 12, sm: 6, md: 4 } as const;
const half = { xs: 12, md: 6 } as const;

export default function DeskHome() {
  const { user } = useHospitalAuth();
  const navigate = useNavigate();
  const desks = { admission: hasRole(user, "ADMISSION_DESK"), billing: hasRole(user, "BILLING"), tpa: hasRole(user, "TPA_DESK"), mrd: hasRole(user, "MRD") };
  // Someone at no desk in particular (the whole front office, an admin) sees every desk.
  const all = !desks.admission && !desks.billing && !desks.tpa && !desks.mrd;
  const show = { admission: all || desks.admission, billing: all || desks.billing, tpa: all || desks.tpa, mrd: all || desks.mrd };

  const admission = useRoleHome<AdmissionDesk>("admission-desk", show.admission);
  const billing = useRoleHome<Billing>("billing", show.billing);
  const tpa = useRoleHome<Tpa>("tpa", show.tpa);
  const mrd = useRoleHome<Mrd>("mrd", show.mrd);
  const queries = [show.admission && admission, show.billing && billing, show.tpa && tpa, show.mrd && mrd].filter(Boolean) as { dataUpdatedAt: number; isFetching: boolean; refetch: () => void; isError: boolean; error: unknown }[];
  const failed = queries.find((q) => q.isError);
  // The oldest of the sections shown — 0 (no time shown) until every one has loaded.
  const oldest = queries.every((q) => q.dataUpdatedAt) ? Math.min(...queries.map((q) => q.dataUpdatedAt)) : 0;

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="My desk"
        subtitle="What is waiting at your desk, oldest first. Each row opens where it is done."
        actions={<Freshness updatedAt={oldest} fetching={queries.some((q) => q.isFetching)} onRefresh={() => queries.forEach((q) => q.refetch())} />}
      />
      {failed && <ErrorState title="Couldn't load your desk" message={apiErrorText(failed.error)} onRetry={() => queries.forEach((q) => q.refetch())} />}

      {/* A section whose figures failed to load is left out — the error above says so —
          rather than drawn empty, which would read as "nothing to do". */}
      {show.admission && !admission.isError && (
        <Section title="Admission desk" subtitle="Beds to give, beds coming free, and who is waiting for one.">
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={tile}><StatCard icon={<KingBedRounded />} label="Free beds" color={SEMANTIC.success} loading={admission.isLoading}
              value={admission.data?.beds.free ?? 0} sub={`of ${admission.data?.beds.total ?? 0} patient beds`} onClick={() => navigate("/reception/ipd/beds")} /></Grid>
            <Grid size={tile}><StatCard icon={<HotelRounded />} label="Occupied" color={BRAND.action} loading={admission.isLoading}
              value={admission.data?.beds.occupied ?? 0} onClick={() => navigate("/reception/ipd/beds")} /></Grid>
            <Grid size={tile}><StatCard icon={<CleaningServicesRounded />} label="Being turned round" color={SEMANTIC.warning} loading={admission.isLoading}
              value={admission.data?.beds.turnaround ?? 0} sub="vacated or cleaning" onClick={() => navigate("/reception/ipd/beds")} /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={half}>
              <AttentionList title="Waiting for a bed" subtitle="Admitted with no bed yet — longest first" loading={admission.isLoading}
                emptyText="Everyone admitted has a bed." totalCount={admission.data?.waitingForBed.count}
                items={(admission.data?.waitingForBed.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.uhid, meta: since(r.since), severity: "critical" as const, icon: <HourglassTopRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
            </Grid>
            <Grid size={half}>
              <AttentionList title="Discharges started" subtitle="Beds that will free up — earliest first" loading={admission.isLoading}
                emptyText="No discharge in progress." totalCount={admission.data?.dischargesStarted.count}
                items={(admission.data?.dischargesStarted.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.bed ?? undefined, meta: since(r.since), severity: "info" as const, icon: <ExitToAppRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
            </Grid>
            {(admission.data?.reservationsEndingToday.count ?? 0) > 0 && (
              <Grid size={half}>
                <AttentionList title="Reservations ending today" subtitle="Held beds that go back to free when the time passes" loading={admission.isLoading}
                  totalCount={admission.data?.reservationsEndingToday.count}
                  items={(admission.data?.reservationsEndingToday.rows ?? []).map((r) => ({ id: r.bedId, primary: r.bed, meta: formatDateTime(r.until), severity: "warning" as const, icon: <EventBusyRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/reservations") }))} />
              </Grid>
            )}
          </Grid>
        </Section>
      )}

      {show.billing && !billing.isError && (
        <Section title="Billing" subtitle="Final bills to make, bills still owed, and stays running without an advance.">
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={tile}><StatCard icon={<CurrencyRupeeRounded />} label="Collected today" color={SEMANTIC.success} loading={billing.isLoading}
              value={inr(billing.data?.collectedToday)} onClick={() => navigate("/reception/billing")} /></Grid>
            <Grid size={tile}><StatCard icon={<ReceiptLongRounded />} label="Unpaid bills" color={SEMANTIC.warning} loading={billing.isLoading}
              value={billing.data?.unpaidBills.count ?? 0} sub={`${inr(billing.data?.unpaidBills.totalDue)} due`} onClick={() => navigate("/reception/billing")} /></Grid>
            <Grid size={tile}><StatCard icon={<ExitToAppRounded />} label="Final bills to make" color={BRAND.action} loading={billing.isLoading}
              value={billing.data?.finalBillsToMake.count ?? 0} sub="discharge started" onClick={() => navigate("/reception/ipd/admissions")} /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={half}>
              <AttentionList title="Final bills to make" subtitle="Discharge started — the bill is the last step" loading={billing.isLoading}
                emptyText="No discharge waiting on its bill." totalCount={billing.data?.finalBillsToMake.count}
                items={(billing.data?.finalBillsToMake.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.bed ?? undefined, meta: since(r.since), severity: "warning" as const, icon: <ExitToAppRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
            </Grid>
            <Grid size={half}>
              <AttentionList title="Unpaid bills" subtitle="Oldest first" loading={billing.isLoading}
                emptyText="Every bill is paid." totalCount={billing.data?.unpaidBills.count}
                items={(billing.data?.unpaidBills.rows ?? []).map((r) => ({ id: r.invoiceId, primary: r.invoiceNumber, secondary: `${inr(r.balance)} owed`, meta: `${r.ageDays}d`, severity: r.ageDays > 30 ? "critical" as const : "warning" as const, icon: <ReceiptLongRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/billing") }))} />
            </Grid>
            {(billing.data?.staysWithoutAdvance.count ?? 0) > 0 && (
              <Grid size={half}>
                <AttentionList title="In hospital with no advance" subtitle="The bill is running with nothing on deposit against it" loading={billing.isLoading}
                  totalCount={billing.data?.staysWithoutAdvance.count}
                  items={(billing.data?.staysWithoutAdvance.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.bed ?? undefined, meta: r.days != null ? `${r.days}d in` : "", severity: "info" as const, icon: <CurrencyRupeeRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
              </Grid>
            )}
          </Grid>
        </Section>
      )}

      {show.tpa && !tpa.isError && (
        <Section title="TPA / insurance desk" subtitle="Queries to answer, pre-authorisations to chase, and insured stays to check.">
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={tile}><StatCard icon={<HelpOutlineRounded />} label="Queried by the payer" color={SEMANTIC.danger} loading={tpa.isLoading}
              value={tpa.data?.queried.count ?? 0} onClick={() => navigate("/reception/claims")} /></Grid>
            <Grid size={tile}><StatCard icon={<HealthAndSafetyRounded />} label="Pre-auth pending" color={SEMANTIC.warning} loading={tpa.isLoading}
              value={tpa.data?.preAuthPending.count ?? 0} onClick={() => navigate("/reception/claims")} /></Grid>
            <Grid size={tile}><StatCard icon={<KingBedRounded />} label="Rooms over policy limit" color={SEMANTIC.warning} loading={tpa.isLoading}
              value={tpa.data?.roomsOverLimit.count ?? 0} onClick={() => navigate("/reception/ipd/admissions")} /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={half}>
              <AttentionList title="Queried by the payer" subtitle="The payer is waiting on the hospital — oldest first" loading={tpa.isLoading}
                emptyText="No open query." totalCount={tpa.data?.queried.count}
                items={(tpa.data?.queried.rows ?? []).map((r) => ({ id: r.claimId, primary: `${r.claimNumber} — ${r.patientName}`, meta: since(r.since), severity: "critical" as const, icon: <HelpOutlineRounded sx={{ fontSize: 18 }} />, onClick: () => navigate(`/reception/claims/${r.claimId}`) }))} />
            </Grid>
            <Grid size={half}>
              <AttentionList title="Pre-authorisation pending" subtitle="Registered or sent, not yet approved" loading={tpa.isLoading}
                emptyText="Nothing waiting for pre-authorisation." totalCount={tpa.data?.preAuthPending.count}
                items={(tpa.data?.preAuthPending.rows ?? []).map((r) => ({ id: r.claimId, primary: `${r.claimNumber} — ${r.patientName}`, meta: since(r.since), severity: "warning" as const, icon: <HealthAndSafetyRounded sx={{ fontSize: 18 }} />, onClick: () => navigate(`/reception/claims/${r.claimId}`) }))} />
            </Grid>
            {(tpa.data?.insuredWithoutClaim.count ?? 0) > 0 && (
              <Grid size={half}>
                <AttentionList title="Insured stays with no claim" subtitle="In hospital on insurance or a scheme, and no claim registered" loading={tpa.isLoading}
                  totalCount={tpa.data?.insuredWithoutClaim.count}
                  items={(tpa.data?.insuredWithoutClaim.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.bed ?? undefined, severity: "warning" as const, icon: <AssignmentLateRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/claims/new") }))} />
              </Grid>
            )}
            {(tpa.data?.roomsOverLimit.count ?? 0) > 0 && (
              <Grid size={half}>
                <AttentionList title="Rooms over the policy limit" subtitle="The insurer may cut the claim in proportion" loading={tpa.isLoading}
                  totalCount={tpa.data?.roomsOverLimit.count}
                  items={(tpa.data?.roomsOverLimit.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: `${r.bed ?? "Room"} — ${inr(r.rent)}/day, limit ${inr(r.limit)}`, meta: `+${inr(r.over)}`, severity: "warning" as const, icon: <KingBedRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
              </Grid>
            )}
            {(tpa.data?.ageing.count ?? 0) > 0 && (
              <Grid size={half}>
                <AttentionList title="Claims waiting over 21 days" subtitle="Submitted and not settled — worth chasing" loading={tpa.isLoading}
                  totalCount={tpa.data?.ageing.count}
                  items={(tpa.data?.ageing.rows ?? []).map((r) => ({ id: r.claimId, primary: `${r.claimNumber} — ${r.patientName}`, meta: r.days != null ? `${r.days}d` : "", severity: "warning" as const, icon: <HourglassTopRounded sx={{ fontSize: 18 }} />, onClick: () => navigate(`/reception/claims/${r.claimId}`) }))} />
              </Grid>
            )}
          </Grid>
        </Section>
      )}

      {show.mrd && !mrd.isError && (
        <Section title="Medical records" subtitle="Files closed without a summary, surgeries coming up without a signed consent, and the record room's registers.">
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={tile}><StatCard icon={<ExitToAppRounded />} label="Discharged this week" color={BRAND.action} loading={mrd.isLoading}
              value={mrd.data?.dischargedThisWeek ?? 0} /></Grid>
            <Grid size={tile}><StatCard icon={<DescriptionRounded />} label="Summaries missing" color={SEMANTIC.warning} loading={mrd.isLoading}
              value={mrd.data?.summariesMissing.count ?? 0} sub="of those discharged" /></Grid>
            <Grid size={tile}><StatCard icon={<AssignmentLateRounded />} label="Consents missing" color={SEMANTIC.danger} loading={mrd.isLoading}
              value={mrd.data?.consentsMissing.count ?? 0} sub="surgery in the next 48h" /></Grid>
            {/* The record room's own registers (Medical records page). */}
            <Grid size={tile}><StatCard icon={<GavelRounded />} label="Medico-legal cases open" color={SEMANTIC.warning} loading={mrd.isLoading}
              value={mrd.data?.medicoLegal?.open ?? 0} sub={`${mrd.data?.medicoLegal?.policePending ?? 0} not yet told to police`} onClick={() => navigate("/reception/mrd")} /></Grid>
            <Grid size={tile}><StatCard icon={<FolderSharedRounded />} label="Files overdue" color={SEMANTIC.danger} loading={mrd.isLoading}
              value={mrd.data?.filesOverdue ?? 0} sub="out past their due time" onClick={() => navigate("/reception/mrd")} /></Grid>
            <Grid size={tile}><StatCard icon={<VerifiedRounded />} label="Certificates this week" color={BRAND.action} loading={mrd.isLoading}
              value={mrd.data?.certificatesThisWeek ?? 0} sub="medical, fitness, death" onClick={() => navigate("/reception/mrd")} /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={half}>
              <AttentionList title="Discharged without a summary" subtitle="This week — oldest first" loading={mrd.isLoading}
                emptyText="Every file this week has its summary." totalCount={mrd.data?.summariesMissing.count}
                items={(mrd.data?.summariesMissing.rows ?? []).map((r) => ({ id: r.admissionId, primary: r.patientName, secondary: r.admissionNumber ?? undefined, meta: since(r.dischargedOn), severity: "warning" as const, icon: <DescriptionRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/ipd/admissions") }))} />
            </Grid>
            <Grid size={half}>
              <AttentionList title="Surgery without a signed consent" subtitle="In the next 48 hours — soonest first" loading={mrd.isLoading}
                emptyText="Every surgery coming up has its consent." totalCount={mrd.data?.consentsMissing.count}
                items={(mrd.data?.consentsMissing.rows ?? []).map((r) => ({ id: r.surgeryId, primary: r.patientName, secondary: r.procedure, meta: formatDateTime(r.at), severity: "critical" as const, icon: <AssignmentLateRounded sx={{ fontSize: 18 }} />, onClick: () => navigate("/reception/patients") }))} />
            </Grid>
          </Grid>
        </Section>
      )}
    </Box>
  );
}
