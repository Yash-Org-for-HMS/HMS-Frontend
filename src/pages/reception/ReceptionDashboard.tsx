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
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { useSocket } from "../../hooks/useSocket";

interface AppointmentEntry {
  appointmentId: string;
  appointmentTime: string;
  tokenNumber: number;
  patientId: string | null;
  doctorId: string | null;
  status: { label: string; color: string };
}
interface DashboardStats {
  todaysAppointments: number;
  checkedInPatients: number;
  waitingPatients: number;
  avgWaitMinutes: number;
  completedVisits: number;
  todaysRevenue: number;
  upcomingAppointments: AppointmentEntry[];
}

const ACCENT = "#0891b2";
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function MiniStat({ icon, title, value, loading, prefix }: any) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: "rgba(8,145,178,0.1)", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        {loading ? <Skeleton width={60} height={28} /> : (
          <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1 }} noWrap>
            {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{title}</Typography>
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
    QUEUE_UPDATED: () => queryClient.invalidateQueries({ queryKey: ["reception-dashboard-stats"] }),
  });

  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery<DashboardStats>({
    queryKey: ["reception-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/reception/dashboard/stats")).data.data,
  });

  // Today's bills — to surface anything still owed (best-effort; ignore errors).
  const { data: billsToday } = useQuery({
    queryKey: ["dashboard-bills-today", today],
    queryFn: async () => (await axiosInstance.get("/reception/billing/invoices", { params: { from: today, to: today, limit: 100 } })).data,
    retry: 0,
  });
  const outstandingRows = (billsToday?.data || []).filter((r: any) => Number(r.balance) > 0.005);
  const outstandingCount = outstandingRows.length;
  const outstandingDue = outstandingRows.reduce((s: number, r: any) => s + Number(r.balance), 0);

  // Bed availability (best-effort; IPD may be unavailable).
  const { data: bedData } = useQuery({
    queryKey: ["dashboard-beds"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
    retry: 0,
  });
  const beds = bedData?.summary;

  if (isError) {
    return <Box sx={{ pb: 6 }}><ErrorState title="Couldn't load the dashboard" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></Box>;
  }

  const waiting = stats?.waitingPatients || 0;
  const avgWait = stats?.avgWaitMinutes || 0;
  const bedsAvail = beds?.available;

  return (
    <Box sx={{ pb: 5 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>Reception Desk</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          Front-desk operations for {hospital?.name || "the hospital"}
        </Typography>
      </Box>

      {/* Needs attention — action cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 2.5 }}>
        <ActionCard
          icon={<HourglassTopRounded />} label="Patients waiting" value={loading ? "—" : String(waiting)}
          sub={waiting === 0 ? "Queue is clear" : `avg wait ${fmtWait(avgWait)}`}
          color={waiting === 0 ? "#10b981" : avgWait >= 20 ? "#ef4444" : "#f59e0b"}
          onClick={() => navigate("/reception/queue")}
        />
        <ActionCard
          icon={<ReceiptLongRounded />} label="Unpaid bills today" value={billsToday ? String(outstandingCount) : "—"}
          sub={outstandingCount === 0 ? "All settled today" : `${inr(outstandingDue)} to collect`}
          color={outstandingCount === 0 ? "#10b981" : "#ef4444"}
          onClick={() => navigate("/reception/billing")}
        />
        <ActionCard
          icon={<HotelRounded />} label="Beds available" value={bedsAvail == null ? "—" : String(bedsAvail)}
          sub={beds ? `${beds.occupied}/${beds.totalBeds} occupied` : "IPD"}
          color={bedsAvail == null ? ACCENT : bedsAvail === 0 ? "#ef4444" : bedsAvail <= 2 ? "#f59e0b" : "#10b981"}
          onClick={() => navigate("/reception/ipd/beds")}
        />
      </Box>

      {/* KPI strip */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
        <MiniStat icon={<CalendarTodayRounded fontSize="small" />} title="Appointments" value={stats?.todaysAppointments || 0} loading={loading} />
        <MiniStat icon={<CheckCircleRounded fontSize="small" />} title="Completed" value={stats?.completedVisits || 0} loading={loading} />
        <MiniStat icon={<AccessTimeRounded fontSize="small" />} title="Avg wait" value={stats ? fmtWait(avgWait) : "0m"} loading={loading} />
        <MiniStat icon={<CurrencyRupeeRounded fontSize="small" />} title="Revenue today" prefix="₹" value={stats?.todaysRevenue || 0} loading={loading} />
      </Box>

      {/* Queue + quick actions */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5, alignItems: "start" }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>Live Queue</Typography>
            <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate("/reception/queue")} sx={{ textTransform: "none", color: ACCENT }}>Open queue</Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Token", "Time", "Patient", "Status"].map((h) => (
                    <TableCell key={h} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from(new Array(4)).map((_, i) => (
                    <TableRow key={i}>{Array.from(new Array(4)).map((_, j) => <TableCell key={j} sx={{ borderColor: "divider" }}><Skeleton width={70} /></TableCell>)}</TableRow>
                  ))
                ) : stats?.upcomingAppointments?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="All caught up!" subtitle="No one in the queue right now." /></TableCell></TableRow>
                ) : (
                  stats?.upcomingAppointments?.map((appt) => (
                    <TableRow key={appt.appointmentId} hover>
                      <TableCell sx={{ fontWeight: 700, color: "text.primary", borderColor: "divider" }}>#{appt.tokenNumber}</TableCell>
                      <TableCell sx={{ color: "text.primary", borderColor: "divider" }}>{new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell sx={{ color: "text.secondary", borderColor: "divider" }}>{appt.patientId ? <Box component="span" sx={{ fontFamily: "monospace" }}>{appt.patientId.slice(0, 8)}</Box> : <Typography variant="caption" sx={{ color: "text.disabled" }}>Unregistered</Typography>}</TableCell>
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
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", py: 1.2 }}>
              Register new patient
            </Button>
            <Button fullWidth variant="outlined" startIcon={<CalendarMonthRounded />} onClick={() => navigate("/reception/appointments/new")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: ACCENT, borderColor: "divider", py: 1.2 }}>
              Book appointment
            </Button>
            <Button fullWidth variant="outlined" startIcon={<ReceiptLongRounded />} onClick={() => navigate("/reception/billing")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: "#f59e0b", borderColor: "divider", py: 1.2 }}>
              Create / collect a bill
            </Button>
            <Button fullWidth variant="outlined" startIcon={<LocalHotelRounded />} onClick={() => navigate("/reception/ipd/admissions")}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600, color: "#8b5cf6", borderColor: "divider", py: 1.2 }}>
              Admit a patient
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 2, textAlign: "center" }}>
            Tip: press ⌘K anywhere to search or jump
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
