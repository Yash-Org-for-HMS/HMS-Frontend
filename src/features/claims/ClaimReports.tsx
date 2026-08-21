import { useState } from "react";
import KpiCard from "@/features/reports/kit/KpiCard";
import { apiGet } from "@/api/client";
import type {
  ClaimReportsResponse, ClaimSummary, ClaimStatusRow, ClaimPayerRow, ClaimSchemeRow,
  PreAuthTatRow, ClaimAgingBucket, ClaimAgingRow, ClaimRejectionRow, ClaimRegisterRow,
} from "./claimReports.types";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  DescriptionRounded, HourglassBottomRounded, PaidRounded, CancelRounded,
  AccountBalanceWalletRounded, GroupRounded, FileDownloadRounded, ArrowBackRounded,
} from "@mui/icons-material";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { exportTableToExcel } from "@/utils/exportExcel";
import { formatINR } from "@/utils/format";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ReportTruncationNote, ReportNavLayout } from "@/features/reports/kit";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import { apiErrorText } from "@/utils/apiError";

const ACCENT = BRAND.action;
const fmtDate = (d: string) => (d ? dayjs(d).format("DD MMM YYYY") : "—");
const inr = (v: unknown) => formatINR(Number(v || 0));

const PRESETS = [
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
  { key: "90d", label: "90 days", from: () => dayjs().subtract(89, "day"), to: () => dayjs() },
  { key: "1y", label: "1 year", from: () => dayjs().subtract(1, "year"), to: () => dayjs() },
];

function SimpleTable({ title, head, rows, dense, note }: { title: string; head: string[]; rows: (string | number)[][]; dense?: boolean; note?: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)} sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
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
                  <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper" }}>{h}</TableCell>
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

// ── Report views ────────────────────────────────────────────────────────────

function OverviewReport({ data }: { data: ClaimReportsResponse }) {
  const s = data?.summary || {};
  // The equal-length window before this one, so each figure says which way it is
  // moving rather than standing alone.
  const p: Partial<ClaimSummary> = data?.previous ?? {};
  const status: ClaimStatusRow[] = data?.statusBreakdown || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
        <KpiCard icon={<DescriptionRounded />} accent={BRAND.action} label="Total claims"
          value={String(s.totalClaims || 0)} current={s.totalClaims} previous={p.totalClaims} />
        {/* An open claim is money not yet settled, so more of them is not better. */}
        <KpiCard icon={<HourglassBottomRounded />} accent={SEMANTIC.warning} label="Open"
          value={String(s.open || 0)} current={s.open} previous={p.open} higherIsBetter={false} />
        <KpiCard icon={<PaidRounded />} accent={SEMANTIC.success} label="Settled"
          value={String(s.settled || 0)} current={s.settled} previous={p.settled} />
        <KpiCard icon={<CancelRounded />} accent={SEMANTIC.danger} label="Rejected"
          value={String(s.rejected || 0)} current={s.rejected} previous={p.rejected} higherIsBetter={false} />
        <KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.info} label="Payer outstanding"
          value={inr(s.outstandingFromPayer)} current={Number(s.outstandingFromPayer)} previous={Number(p.outstandingFromPayer)}
          higherIsBetter={false} />
        <KpiCard icon={<GroupRounded />} accent={BRAND.actionDark} label="Patient shortfall"
          value={inr(s.patientShortfall)} current={Number(s.patientShortfall)} previous={Number(p.patientShortfall)}
          higherIsBetter={false} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <SimpleTable title="Claims by status" head={["Status", "Claims"]} rows={status.map((r) => [r.label, Number(r.count)])} />
        <SimpleTable title="Amount summary" head={["Metric", "Amount"]} rows={[
          ["Total billed", inr(s.totalBilled)],
          ["Total pre-auth approved", inr(s.totalApproved)],
          ["Total settled by payers", inr(s.totalSettled)],
          ["Outstanding from payers", inr(s.outstandingFromPayer)],
          ["Patient shortfall (billed − approved)", inr(s.patientShortfall)],
        ]} />
      </Box>
    </Box>
  );
}

function PayerReport({ data }: { data: ClaimReportsResponse }) {
  const rows: ClaimPayerRow[] = data?.payerWise || [];
  return <SimpleTable title="Payer-wise volume & amounts" head={["Payer", "Claims", "Billed", "Approved", "Settled", "Outstanding"]}
    rows={rows.map((r) => [r.payerName, r.count, inr(r.billed), inr(r.approved), inr(r.settled), inr(r.outstanding)])} />;
}

function SchemeReport({ data }: { data: ClaimReportsResponse }) {
  const rows: ClaimSchemeRow[] = data?.schemeWise || [];
  return <SimpleTable title="Scheme-wise volume & amounts" head={["Scheme", "Claims", "Billed", "Approved", "Settled"]}
    rows={rows.map((r) => [r.scheme, r.count, inr(r.billed), inr(r.approved), inr(r.settled)])} />;
}

function TatReport({ data }: { data: ClaimReportsResponse }) {
  const tat = data?.preAuthTat || {};
  const rows: PreAuthTatRow[] = tat.rows || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr" }, gap: 1.5, maxWidth: 420 }}>
        <KpiCard icon={<HourglassBottomRounded />} accent={SEMANTIC.warning} label="Avg pre-auth turnaround"
          value={`${tat.avgDays ?? 0} days`} />
        <KpiCard icon={<DescriptionRounded />} accent={SEMANTIC.info} label="Approved pre-auths"
          value={String(rows.length)} />
      </Box>
      <SimpleTable title="Pre-authorization turnaround" head={["Claim #", "Patient", "Submitted", "Approved", "Days"]}
        rows={rows.map((r) => [r.claimNumber, r.patientName, fmtDate(r.submittedAt), fmtDate(r.approvedAt), r.days])} />
    </Box>
  );
}

function AgingReport({ data }: { data: ClaimReportsResponse }) {
  const aging = data?.aging || {};
  const buckets: ClaimAgingBucket[] = aging.buckets || [];
  const rows: ClaimAgingRow[] = aging.rows || [];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" }, gap: 2 }}>
      <SimpleTable title="Aging buckets" head={["Age", "Claims", "Outstanding"]} rows={buckets.map((b) => [b.label, b.count, inr(b.amount)])} />
      <SimpleTable title="Outstanding reimbursements" head={["Claim #", "Patient", "Payer", "Age (days)", "Outstanding"]}
        rows={rows.map((r) => [r.claimNumber, r.patientName, r.payerName, r.ageDays, inr(r.outstanding)])} />
    </Box>
  );
}

function RejectionsReport({ data }: { data: ClaimReportsResponse }) {
  const rows: ClaimRejectionRow[] = data?.rejections || [];
  return <SimpleTable title="Rejected claims" head={["Claim #", "Patient", "Payer", "Status", "Billed", "When"]}
    rows={rows.map((r) => [r.claimNumber, r.patientName, r.payerName, r.status, inr(r.billed), fmtDate(r.at)])} />;
}

function RegisterReport({ data }: { data: ClaimReportsResponse }) {
  const rows: ClaimRegisterRow[] = data?.register || [];
  return <SimpleTable title="Claims register" head={["Claim #", "Patient", "UHID", "Payer", "Scheme", "Status", "Billed", "Approved", "Settled", "Registered"]}
    rows={rows.map((r) => [r.claimNumber, r.patientName, r.uhid, r.payerName, r.scheme, r.status, inr(r.billed), inr(r.approved), inr(r.settled), fmtDate(r.registeredAt)])}
    note={<ReportTruncationNote truncated={data?.truncated} totalRows={data?.totalRows} shownRows={data?.shownRows} />} />;
}

type ReportItem = { key: string; label: string; Comp: React.ComponentType<{ data: ClaimReportsResponse }> };
const GROUPS: { heading: string; items: ReportItem[] }[] = [
  { heading: "Overview", items: [{ key: "overview", label: "Summary & Status", Comp: OverviewReport }] },
  { heading: "Volume", items: [
    { key: "payer", label: "Payer-wise", Comp: PayerReport },
    { key: "scheme", label: "Scheme-wise", Comp: SchemeReport },
  ] },
  { heading: "Operations", items: [
    { key: "tat", label: "Pre-auth Turnaround", Comp: TatReport },
    { key: "aging", label: "Outstanding Aging", Comp: AgingReport },
    { key: "rejections", label: "Rejections", Comp: RejectionsReport },
  ] },
  { heading: "Register", items: [{ key: "register", label: "Claims Register", Comp: RegisterReport }] },
];

export default function ClaimReports() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState("90d");
  const [from, setFrom] = useState(dayjs().subtract(89, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const applyPreset = (p: typeof PRESETS[number]) => { setPreset(p.key); setFrom(p.from().format("YYYY-MM-DD")); setTo(p.to().format("YYYY-MM-DD")); };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["claim-reports", from, to],
    queryFn: () => apiGet<ClaimReportsResponse>("/claims/reports", { params: { from, to } }),
    placeholderData: keepPreviousData,
  });

  const toolbar = (
    <>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/reception/claims")} sx={{ color: "text.secondary", textTransform: "none", mb: 1 }}>Back to claims</Button>
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <ButtonGroup size="small" variant="outlined">
          {PRESETS.map((p) => (
            <Button key={p.key} onClick={() => applyPreset(p)} variant={preset === p.key ? "contained" : "outlined"} sx={preset === p.key ? { bgcolor: ACCENT } : undefined}>{p.label}</Button>
          ))}
        </ButtonGroup>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPreset(""); }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPreset(""); }} />
        </Box>
      </Paper>
    </>
  );

  // An empty range has nothing to slice, so the picker would offer a menu of
  // blank reports — show the empty state in the content pane instead.
  const contentState =
    isLoading ? <ReportSkeleton />
      : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      : (data?.summary?.totalClaims ?? 0) === 0
        ? <Box sx={{ py: 6 }}><Mascot pose="nothing-here-yet" title="No claims in this range" subtitle="Register some claims, then come back for analytics." size={130} /></Box>
        : undefined;

  return (
    <ReportNavLayout
      title="Claim Reports"
      subtitle="Insurance & scheme analytics — turnaround, outstanding reimbursements, rejections. Every table is downloadable."
      groups={GROUPS}
      accent={ACCENT}
      actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      toolbar={toolbar}
      componentProps={{ data }}
      contentState={contentState}
    />
  );
}
