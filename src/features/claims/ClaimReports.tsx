import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
} from "@mui/material";
import {
  DescriptionRounded, HourglassBottomRounded, PaidRounded, CancelRounded,
  AccountBalanceWalletRounded, GroupRounded, FileDownloadRounded, ArrowBackRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell,
} from "recharts";
import { ACCENTS } from "@/styles/accents";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import { formatINR } from "@/utils/format";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import { statusMeta } from "./claimMeta";
import { apiErrorText } from "@/utils/apiError";

const ACCENT = ACCENTS.reception;
const fmtDate = (d: string) => (d ? dayjs(d).format("DD MMM YYYY") : "—");
const inr = (v: any) => formatINR(Number(v || 0));

const PRESETS = [
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
  { key: "90d", label: "90 days", from: () => dayjs().subtract(89, "day"), to: () => dayjs() },
  { key: "1y", label: "1 year", from: () => dayjs().subtract(1, "year"), to: () => dayjs() },
];

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>{value}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>{label}</Typography>
      </Box>
    </Paper>
  );
}

function SimpleTable({ title, head, rows, dense }: { title: string; head: string[]; rows: (string | number)[][]; dense?: boolean }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)} sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
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

function OverviewReport({ data }: { data: any }) {
  const s = data?.summary || {};
  const status: any[] = data?.statusBreakdown || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
        <Kpi icon={<DescriptionRounded />} label="Total claims" value={String(s.totalClaims || 0)} color="#0891b2" />
        <Kpi icon={<HourglassBottomRounded />} label="Open" value={String(s.open || 0)} color="#f59e0b" />
        <Kpi icon={<PaidRounded />} label="Settled" value={String(s.settled || 0)} color="#10b981" />
        <Kpi icon={<CancelRounded />} label="Rejected" value={String(s.rejected || 0)} color="#ef4444" />
        <Kpi icon={<AccountBalanceWalletRounded />} label="Payer outstanding" value={inr(s.outstandingFromPayer)} color="#3b82f6" />
        <Kpi icon={<GroupRounded />} label="Patient shortfall" value={inr(s.patientShortfall)} color="#8b5cf6" />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Claims by status</Typography>
          {status.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No claims in this range.</Typography>
          ) : (
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={status} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Bar dataKey="count" name="Claims" radius={[0, 4, 4, 0]} barSize={16}>
                    {status.map((row, i) => <Cell key={i} fill={statusMeta(row.status).color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
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

function PayerReport({ data }: { data: any }) {
  const rows: any[] = data?.payerWise || [];
  return <SimpleTable title="Payer-wise volume & amounts" head={["Payer", "Claims", "Billed", "Approved", "Settled", "Outstanding"]}
    rows={rows.map((r) => [r.payerName, r.count, inr(r.billed), inr(r.approved), inr(r.settled), inr(r.outstanding)])} />;
}

function SchemeReport({ data }: { data: any }) {
  const rows: any[] = data?.schemeWise || [];
  return <SimpleTable title="Scheme-wise volume & amounts" head={["Scheme", "Claims", "Billed", "Approved", "Settled"]}
    rows={rows.map((r) => [r.scheme, r.count, inr(r.billed), inr(r.approved), inr(r.settled)])} />;
}

function TatReport({ data }: { data: any }) {
  const tat = data?.preAuthTat || {};
  const rows: any[] = tat.rows || [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr" }, gap: 1.5, maxWidth: 420 }}>
        <Kpi icon={<HourglassBottomRounded />} label="Avg pre-auth TAT (days)" value={String(tat.avgDays ?? 0)} color="#f59e0b" />
        <Kpi icon={<DescriptionRounded />} label="Approved pre-auths" value={String(rows.length)} color="#3b82f6" />
      </Box>
      <SimpleTable title="Pre-authorization turnaround" head={["Claim #", "Patient", "Submitted", "Approved", "Days"]}
        rows={rows.map((r) => [r.claimNumber, r.patientName, fmtDate(r.submittedAt), fmtDate(r.approvedAt), r.days])} />
    </Box>
  );
}

function AgingReport({ data }: { data: any }) {
  const aging = data?.aging || {};
  const buckets: any[] = aging.buckets || [];
  const rows: any[] = aging.rows || [];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" }, gap: 2 }}>
      <SimpleTable title="Aging buckets" head={["Age", "Claims", "Outstanding"]} rows={buckets.map((b) => [b.label, b.count, inr(b.amount)])} />
      <SimpleTable title="Outstanding reimbursements" head={["Claim #", "Patient", "Payer", "Age (days)", "Outstanding"]}
        rows={rows.map((r) => [r.claimNumber, r.patientName, r.payerName, r.ageDays, inr(r.outstanding)])} />
    </Box>
  );
}

function RejectionsReport({ data }: { data: any }) {
  const rows: any[] = data?.rejections || [];
  return <SimpleTable title="Rejected claims" head={["Claim #", "Patient", "Payer", "Status", "Billed", "When"]}
    rows={rows.map((r) => [r.claimNumber, r.patientName, r.payerName, r.status, inr(r.billed), fmtDate(r.at)])} />;
}

function RegisterReport({ data }: { data: any }) {
  const rows: any[] = data?.register || [];
  return <SimpleTable title="Claims register" head={["Claim #", "Patient", "UHID", "Payer", "Scheme", "Status", "Billed", "Approved", "Settled", "Registered"]}
    rows={rows.map((r) => [r.claimNumber, r.patientName, r.uhid, r.payerName, r.scheme, r.status, inr(r.billed), inr(r.approved), inr(r.settled), fmtDate(r.registeredAt)])} />;
}

type ReportItem = { key: string; label: string; Comp: React.ComponentType<{ data: any }> };
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
  const [active, setActive] = useState(GROUPS[0].items[0].key);

  const applyPreset = (p: typeof PRESETS[number]) => { setPreset(p.key); setFrom(p.from().format("YYYY-MM-DD")); setTo(p.to().format("YYYY-MM-DD")); };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["claim-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/claims/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const ActiveComp = useMemo(() => {
    for (const g of GROUPS) { const f = g.items.find((i) => i.key === active); if (f) return f.Comp; }
    return GROUPS[0].items[0].Comp;
  }, [active]);

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader title="Claim Reports" subtitle="Insurance & scheme analytics — turnaround, outstanding reimbursements, rejections. Every table is downloadable." actions={isFetching ? <HeartbeatLoader size={22} /> : undefined} />
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

      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (data?.summary?.totalClaims ?? 0) === 0 ? (
        <Box sx={{ py: 6 }}><Mascot pose="nothing-here-yet" title="No claims in this range" subtitle="Register some claims, then come back for analytics." size={130} /></Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
          <Paper elevation={0} sx={{ width: { xs: "100%", md: 240 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden" }}>
            <List dense disablePadding>
              {GROUPS.map((g, gi) => (
                <Box key={g.heading}>
                  {gi > 0 && <Divider />}
                  <ListSubheader sx={{ fontWeight: 800, fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary", lineHeight: "36px", bgcolor: "transparent" }}>{g.heading}</ListSubheader>
                  {g.items.map((it) => (
                    <ListItemButton key={it.key} selected={active === it.key} onClick={() => setActive(it.key)}
                      sx={{ py: 0.75, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` }, "&.Mui-selected:hover": { bgcolor: `${ACCENT}22` } }}>
                      <ListItemText primary={it.label} primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: active === it.key ? 700 : 500, color: active === it.key ? ACCENT : "text.primary" }} />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          </Paper>
          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ActiveComp data={data} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
