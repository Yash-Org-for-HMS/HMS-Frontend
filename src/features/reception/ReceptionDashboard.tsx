import { SEMANTIC, BRAND } from "@/styles/accents";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { SEARCH_SHORTCUT } from "@/utils/shortcut";
import { alpha } from "@mui/material/styles";
import { formatINR } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Skeleton, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from "@mui/material";
import {
  CalendarTodayRounded, AccessTimeRounded, CheckCircleRounded, CurrencyRupeeRounded,
  HourglassTopRounded, ReceiptLongRounded, HotelRounded, ArrowForwardRounded,
  PersonAddRounded, CalendarMonthRounded, LocalHotelRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import { apiGetList } from "@/api/client";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import type { QueueTokenRow } from "./queue.types";
import { useSocket } from "@/hooks/useSocket";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";

interface AppointmentEntry {
  appointmentId: string;
  appointmentTime: string;
  tokenNumber: number;
  patientId: string | null;
  patientName: string;
  uhidNumber: string | null;
  doctorId: string | null;
  doctorName: string;
  status: { label: string; color: string };
}
interface DashboardStats {
  todaysAppointments: number;
  checkedInPatients: number;
  waitingPatients: number;
  avgWaitMinutes: number;
  completedVisits: number;
  /** Cash kept today: taken today, less anything handed back today. */
  todaysRevenue: number;
  /** Of that, what went back out — shown so a smaller figure explains itself. */
  todaysRefunded?: number;
  upcomingAppointments: AppointmentEntry[];
}

const ACCENT = BRAND.action;
const inr = (n: any) => formatINR(n, 0);
const fmtWait = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

// Clickable "needs attention" card.
function ActionCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; onClick: () => void;
}) {
  return (
    <Paper elevation={0} onClick={onClick}
      sx={{
        p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
        "&:hover": { borderColor: color, transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" },
      }}>
      <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1 }} noWrap>{value}</Typography>
        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }} noWrap>{label}</Typography>
        <Typography variant="caption" sx={{ color }} noWrap>{sub}</Typography>
      </Box>
      <ArrowForwardRounded sx={{ color: "text.disabled", fontSize: 18 }} />
    </Paper>
  );
}

function MiniStat({ icon, title, value, loading, prefix, sub }: any) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: alpha(ACCENT, 0.1), color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        {loading ? <Skeleton width={60} height={28} /> : (
          <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1 }} noWrap>
            {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block" }}>{title}</Typography>
        {sub && <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}>{sub}</Typography>}
      </Box>
    </Paper>
  );
}

export default function ReceptionDashboard() {
  const { hospital } = useHospitalAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  // Live updates: refresh the dashboard whenever the queue changes elsewhere.
  useSocket({
    QUEUE_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: ["reception-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery<DashboardStats>({
    queryKey: ["reception-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/reception/dashboard/stats")).data.data,
  });

  /**
   * The live queue, from the SAME endpoint the queue page reads.
   *
   * This panel used to list today's appointments while calling itself "Live
   * Queue", so it showed three scheduled patients as though they were waiting
   * while the queue page - correctly - showed nobody, because a queue token
   * only exists once somebody checks in. Two screens answering "who is in the
   * queue" from two different sources will always eventually disagree, so now
   * there is one source and they cannot. Sharing the ["queue"] key also means
   * a check-in on either screen refreshes both.
   */
  const { data: queue = [] } = useQuery<QueueTokenRow[]>({
    queryKey: ["queue"],
    // The same call the queue page makes, through the same helper - the
    // envelope is unwrapped in one place, so this cannot drift from it.
    queryFn: async () => (await apiGetList<QueueTokenRow>("/reception/queue")).rows,
    refetchInterval: 30000,
  });
  const liveQueue = queue.filter(
    (t) => t.statusCode !== "COMPLETED" && t.statusCode !== "SKIPPED" && t.statusCode !== "CANCELLED",
  );

  // Today's bills — to surface anything still owed (best-effort; ignore errors).
  const { data: billsToday } = useQuery({
    queryKey: ["dashboard-bills-today", today],
    queryFn: async () => (await axiosInstance.get("/reception/billing/invoices", { params: { from: today, to: today, limit: 100 } })).data,
    retry: 0,
  });
  const outstandingRows = (billsToday?.data || []).filter((r: any) => Number(r.balance) > 0.005);
  const outstandingCount = outstandingRows.length;
  const outstandingDue = outstandingRows.reduce((s: number, r: any) => s + Number(r.balance), 0);

  // Bed availability. Only asked for when the tenant actually has IPD: the
  // request is guaranteed to 403 otherwise, so every dashboard load on an
  // OPD-only hospital logged a forbidden error that looked like a fault and
  // was not one. The tile still falls back to an em dash either way.
  const { loaded: modulesLoaded, isModuleEnabled } = useEnabledModules();
  const { data: bedData } = useQuery({
    queryKey: ["dashboard-beds"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
    // Both halves matter: isModuleEnabled() answers "yes" while the module
    // list is still loading, so gating on it alone still fired the request on
    // first render — which is exactly the 403 this was meant to stop.
    enabled: modulesLoaded && isModuleEnabled("IPD"),
    retry: 0,
  });
  const beds = bedData?.summary;

  if (isError) {
    return <Box sx={{ pb: 6 }}><ErrorState title="Couldn't load the dashboard" message={apiErrorText(error)} onRetry={() => refetch()} /></Box>;
  }

  const waiting = stats?.waitingPatients || 0;
  const avgWait = stats?.avgWaitMinutes || 0;
  const bedsAvail = beds?.available;

  return (
    <Box sx={{ pb: 5 }}>
      {/* Header */}
      <PageHeader title="Reception Desk" subtitle={`Front-desk operations for ${hospital?.name || "the hospital"}`} />

      {/* Needs attention — action cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 2.5 }}>
        <ActionCard
          icon={<HourglassTopRounded />} label="Patients waiting" value={loading ? "—" : String(waiting)}
          sub={waiting === 0 ? "Queue is clear" : `avg wait ${fmtWait(avgWait)}`}
          color={waiting === 0 ? SEMANTIC.success : avgWait >= 20 ? SEMANTIC.danger : SEMANTIC.warning}
          onClick={() => navigate("/reception/queue")}
        />
        <ActionCard
          icon={<ReceiptLongRounded />} label="Unpaid bills today" value={billsToday ? String(outstandingCount) : "—"}
          sub={outstandingCount === 0 ? "All settled today" : `${inr(outstandingDue)} to collect`}
          color={outstandingCount === 0 ? SEMANTIC.success : SEMANTIC.danger}
          onClick={() => navigate("/reception/billing")}
        />
        <ActionCard
          icon={<HotelRounded />} label="Beds available" value={bedsAvail == null ? "—" : String(bedsAvail)}
          sub={beds ? `${beds.occupied}/${beds.totalBeds} occupied` : "IPD"}
          color={bedsAvail == null ? ACCENT : bedsAvail === 0 ? SEMANTIC.danger : bedsAvail <= 2 ? SEMANTIC.warning : SEMANTIC.success}
          onClick={() => navigate("/reception/ipd/beds")}
        />
      </Box>

      {/* KPI strip */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
        <MiniStat icon={<CalendarTodayRounded fontSize="small" />} title="Appointments" value={stats?.todaysAppointments || 0} loading={loading} />
        <MiniStat icon={<CheckCircleRounded fontSize="small" />} title="Completed" value={stats?.completedVisits || 0} loading={loading} />
        <MiniStat icon={<AccessTimeRounded fontSize="small" />} title="Avg wait" value={stats ? fmtWait(avgWait) : "0m"} loading={loading} />
        {/* "Revenue today" read as "what today's work earned", so a quiet day
            with an old bill settled on it looked inexplicable — ₹41,000 against
            no appointments. It is money taken today against bills of ANY date,
            less anything handed back, so it says that. */}
        <MiniStat
          icon={<CurrencyRupeeRounded fontSize="small" />}
          title="Collected today"
          prefix="₹"
          value={stats?.todaysRevenue || 0}
          loading={loading}
          sub={
            stats?.todaysRefunded && stats.todaysRefunded > 0
              ? `on bills of any date · ${inr(stats.todaysRefunded)} refunded`
              : "on bills of any date"
          }
        />
      </Box>

      {/* Queue + quick actions */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5, alignItems: "start" }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            {/* Named for what is actually in the table. Calling a list of
                scheduled appointments "Live Queue" is what made this panel and
                the queue page look like they disagreed. */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
              {liveQueue.length ? "Live queue" : "Next appointments today"}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate("/reception/queue")} sx={{ textTransform: "none", color: ACCENT }}>Open queue</Button>
          </Box>

          {/* Nobody has checked in yet, so there is no queue - but the day's
              appointments are still worth seeing, under their own name. */}
          {!loading && !liveQueue.length && !!stats?.upcomingAppointments?.length && (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
              Nobody is waiting. These are booked for today and join the queue when they check in.
            </Typography>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Token", liveQueue.length ? "Waiting since" : "Time", "Patient", "Doctor", "Status"].map((hd) => (
                    <TableCell key={hd} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" }}>{hd}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from(new Array(4)).map((_, i) => (
                    <TableRow key={i}>{Array.from(new Array(5)).map((_, j) => <TableCell key={j} sx={{ borderColor: "divider" }}><Skeleton width={70} /></TableCell>)}</TableRow>
                  ))
                ) : liveQueue.length > 0 ? (
                  liveQueue.map((t) => (
                    <TableRow key={t.queueTokenId} hover>
                      <TableCell sx={{ fontWeight: 700, color: "text.primary", borderColor: "divider" }}>#{t.displayNumber}</TableCell>
                      <TableCell sx={{ color: "text.primary", borderColor: "divider" }}>
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{t.patientName}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{t.doctorName}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Chip label={t.statusLabel} size="small" sx={{ bgcolor: `${t.statusColor}15`, color: t.statusColor, fontWeight: 600, borderRadius: 1.5 }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !stats?.upcomingAppointments?.length ? (
                  <TableRow><TableCell colSpan={5} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="All caught up!" subtitle="Nobody waiting, and nothing else booked today." /></TableCell></TableRow>
                ) : (
                  stats.upcomingAppointments.map((appt) => (
                    <TableRow key={appt.appointmentId} hover>
                      {/* A token number counts that DOCTOR's patients for the
                          day, so three doctors each have a #1. Without the
                          doctor beside it the column reads as duplicates. */}
                      <TableCell sx={{ fontWeight: 700, color: "text.primary", borderColor: "divider" }}>#{appt.tokenNumber}</TableCell>
                      <TableCell sx={{ color: "text.primary", borderColor: "divider" }}>{new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      {/* Name and UHID, not an ID fragment. This column used to
                          print patientId.slice(0, 8) in monospace, because the
                          endpoint returned no name to print. */}
                      <TableCell sx={{ borderColor: "divider" }}>
                        {appt.patientId ? (
                          <>
                            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{appt.patientName}</Typography>
                            {appt.uhidNumber && <Typography variant="caption" sx={{ color: "text.secondary" }}>{appt.uhidNumber}</Typography>}
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.disabled" }}>Unregistered</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{appt.doctorName ?? "—"}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}><Chip label={appt.status.label} size="small" sx={{ bgcolor: `${appt.status.color}15`, color: appt.status.color, fontWeight: 600, borderRadius: 1.5 }} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Quick actions */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary", mb: 2 }}>Quick Actions</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button fullWidth variant="contained" startIcon={<PersonAddRounded />} onClick={() => navigate("/reception/patients/new")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, py: 1.2 }}>
              Register new patient
            </Button>
            <Button fullWidth variant="outlined" startIcon={<CalendarMonthRounded />} onClick={() => navigate("/reception/appointments/new")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: ACCENT, borderColor: "divider", py: 1.2 }}>
              Book appointment
            </Button>
            <Button fullWidth variant="outlined" startIcon={<ReceiptLongRounded />} onClick={() => navigate("/reception/billing")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: ACCENT, borderColor: "divider", py: 1.2 }}>
              Create / collect a bill
            </Button>
            <Button fullWidth variant="outlined" startIcon={<LocalHotelRounded />} onClick={() => navigate("/reception/ipd/admissions")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: ACCENT, borderColor: "divider", py: 1.2 }}>
              Admit a patient
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 2, textAlign: "center" }}>
            Tip: press {SEARCH_SHORTCUT} anywhere to search or jump
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
