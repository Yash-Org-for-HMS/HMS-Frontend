import { useQuery } from "@tanstack/react-query";
import { ACCENTS, SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Typography,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
} from "@mui/material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import StatCard from "@/components/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import { formatINR } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import {
  PeopleAltRounded,
  DomainRounded,
  CheckCircleOutlineRounded,
  RadioButtonUncheckedRounded,
  AssignmentRounded,
  HistoryRounded,
  ArrowForwardIosRounded,
  MedicalServicesRounded,
  EventAvailableRounded,
  HotelRounded,
  CurrencyRupeeRounded,
  ReceiptLongRounded,
  AddCircleRounded,
  EditRounded,
  RemoveCircleRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { apiErrorText } from "@/utils/apiError";

interface DashboardStats {
  activePlanName: string;
  profileCompletionPercentage: number;
  totalStaff: number;
  activeUsers: number;
  totalDoctors: number;
  totalDepartments: number;
  enabledModules: number;
  todayAppointments: number;
  activeAdmissions: number;
  pendingTasks: { id: string; title: string; completed: boolean; description?: string; path?: string }[];
  recentActivities: { activityLogId: string; action: string; timestamp: string }[];
  departmentDistribution: { name: string; count: number }[];
}

interface AttentionRow {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  severity: "critical" | "warning" | "info";
}
interface Operations {
  asOf: string;
  comparedTo: string;
  money: {
    collectedToday: number;
    collectedPrevious: number;
    outstandingCount: number;
    outstandingAmount: number;
    trend: { date: string; amount: number }[];
  };
  capacity: { totalBeds: number; occupied: number; available: number; occupancyPct: number | null };
  flow: { appointmentsToday: number; appointmentsPrevious: number; admissionsToday: number; dischargesToday: number };
  attention: AttentionRow[];
}

// How many audit rows the activity rail shows. It used to render ten full-width
// rows and was the largest thing on the page — mostly setup chatter from the
// day the hospital was created, which is history, not news.
const ACTIVITY_ROWS = 6;

// First word of the humanized action ("Added Doctor" / "Updated Onboarding" /
// "Removed Nursing Note") picks the feed icon + colour — advisory, not a status.
const ACTIVITY_ICON: Record<string, { icon: typeof AddCircleRounded; color: string }> = {
  Added: { icon: AddCircleRounded, color: SEMANTIC.success },
  Updated: { icon: EditRounded, color: SEMANTIC.info },
  Removed: { icon: RemoveCircleRounded, color: SEMANTIC.danger },
};

// Whole rupees on this page: paise on a headline figure is noise, and the
// tiles sit beside each other so a stray ".1" breaks the column of numbers.
const inr = (v: number | null | undefined) => formatINR(v, 0);
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export default function HospitalDashboard() {
  const { user } = useHospitalAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery<DashboardStats>({
    queryKey: ["hospital-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/hospital/dashboard/stats")).data.data,
  });

  // The operational half — money, capacity, flow, attention. Deliberately a
  // separate query from /stats: that one answers "how is this hospital set up"
  // and rarely changes, this one is what the page is actually for.
  const { data: ops, isLoading: opsLoading } = useQuery<Operations>({
    queryKey: ["hospital-dashboard-operations"],
    queryFn: async () => (await axiosInstance.get("/hospital/dashboard/operations")).data.data,
  });

  if (loading) {
    return (
      <DashboardSkeleton />
    );
  }

  if (isError || !stats) {
    return (
      <Box sx={{ pb: 6 }}>
        <ErrorState
          title="Couldn't load the dashboard"
          message={apiErrorText(error)}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  // Once every setup step is done the guide has served its purpose — hide it so
  // it doesn't permanently occupy the dashboard.
  const setupComplete = stats.pendingTasks.length > 0 && stats.pendingTasks.every((t) => t.completed);

  const occupancy = ops?.capacity;
  const attentionItems = (ops?.attention ?? []).map((a) => ({
    id: a.id,
    primary: a.primary,
    secondary: a.secondary,
    meta: a.meta,
    severity: a.severity,
    icon: <WarningAmberRounded sx={{ fontSize: 18 }} />,
    onClick: a.id.startsWith("invoice:")
      ? () => navigate("/hospital/billing")
      : a.id.startsWith("stock:") || a.id.startsWith("po:")
        ? () => navigate("/hospital/reports")
        : undefined,
  }));

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Hospital Dashboard"
        subtitle={`Welcome back, ${user?.firstName} ${user?.lastName}. Here's what's happening today.`}
        actions={
          stats?.activePlanName ? (
            <Chip
              label={`Active Plan: ${stats.activePlanName}`}
              sx={{ bgcolor: "background.paper", color: "text.primary", fontWeight: 600, px: 1, border: "1px solid", borderColor: "divider" }}
            />
          ) : undefined
        }
      />

      {/* ── Today ───────────────────────────────────────────────────────────
          Money first. This page previously carried no financial figure at all,
          which made it the one screen a hospital owner opens that couldn't tell
          them how the day was going. Each tile compares against the same
          weekday last week — a Monday against a Sunday is noise about which day
          it is, not about the business. */}
      <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.6, display: "block", mb: 1 }}>
        Today {ops && <Box component="span" sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>· compared with {ops.comparedTo}</Box>}
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Collected today" value={inr(ops?.money.collectedToday ?? 0)}
            current={ops?.money.collectedToday} previous={ops?.money.collectedPrevious}
            deltaLabel="vs the same weekday last week"
            icon={<CurrencyRupeeRounded />} color={SEMANTIC.success} loading={opsLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Outstanding" value={inr(ops?.money.outstandingAmount ?? 0)}
            sub={`${ops?.money.outstandingCount ?? 0} unpaid bill${ops?.money.outstandingCount === 1 ? "" : "s"}`}
            icon={<ReceiptLongRounded />} color={SEMANTIC.danger} loading={opsLoading}
            onClick={() => navigate("/hospital/billing")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Bed occupancy"
            value={occupancy?.occupancyPct == null ? "—" : `${occupancy.occupancyPct}%`}
            sub={occupancy?.totalBeds ? `${occupancy.occupied} of ${occupancy.totalBeds} beds` : "No beds configured"}
            icon={<HotelRounded />} color={BRAND.action} loading={opsLoading}
            onClick={() => navigate("/hospital/ipd/beds")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Appointments" value={ops?.flow.appointmentsToday ?? stats.todayAppointments ?? 0}
            current={ops?.flow.appointmentsToday} previous={ops?.flow.appointmentsPrevious}
            deltaLabel="vs the same weekday last week"
            sub={ops ? `${ops.flow.admissionsToday} admitted · ${ops.flow.dischargesToday} discharged` : undefined}
            icon={<EventAvailableRounded />} color={BRAND.actionDark} loading={opsLoading}
          />
        </Grid>
      </Grid>

      {/* ── Needs attention + collections trend ─────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <AttentionList
            title="Needs attention"
            subtitle="Unacknowledged critical results first, then stock, unpaid bills and open orders"
            items={attentionItems}
            loading={opsLoading}
            emptyText="Nothing outstanding — no unacknowledged criticals, stock is healthy and bills are settled."
            maxRows={6}
            actionLabel="All reports"
            onAction={() => navigate("/hospital/reports")}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>Collections</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Money in over the last 30 days — counted the same way as the Day Book
            </Typography>
            {ops?.money.trend?.length ? (
              <Box sx={{ flex: 1, minHeight: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ops.money.trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="collectionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND.action} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={BRAND.action} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={NEUTRAL.line} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dayLabel} interval="preserveStartEnd" minTickGap={28}
                    tick={{ fill: NEUTRAL.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: NEUTRAL.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v) => inr(v)} />
                  <RechartsTooltip
                    cursor={{ stroke: alpha(BRAND.action, 0.4) }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(l) => dayLabel(String(l))}
                    formatter={(v) => [inr(Number(v)), "Collected"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke={BRAND.action} strokeWidth={2} fill="url(#collectionsFill)" />
                </AreaChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No collections in the last 30 days.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Setup guide (first run only) ─────────────────────────────────────── */}
      {!setupComplete && (
        <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, overflow: "hidden", mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <AssignmentRounded sx={{ color: "text.secondary" }} />
              <Box>
                <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Setup Guide</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>A recommended order to get your hospital running — most links are optional and can be revisited anytime.</Typography>
              </Box>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
              {stats?.pendingTasks.filter((t) => t.completed).length ?? 0} of {stats?.pendingTasks.length ?? 0} done
            </Typography>
          </Box>
          <List disablePadding>
            {stats?.pendingTasks.map((task, index) => (
              <Box key={task.id}>
                <ListItemButton
                  onClick={() => task.path && navigate(task.path)}
                  sx={{ py: 2, alignItems: "flex-start" }}
                >
                  <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                    {task.completed ? (
                      <CheckCircleOutlineRounded sx={{ color: "success.main" }} />
                    ) : (
                      <RadioButtonUncheckedRounded sx={{ color: "text.disabled" }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${index + 1}. ${task.title}`}
                    secondary={task.description}
                    primaryTypographyProps={{
                      color: task.completed ? "text.disabled" : "text.primary",
                      fontWeight: task.completed ? 500 : 700,
                      sx: { textDecoration: task.completed ? "line-through" : "none" }
                    }}
                    secondaryTypographyProps={{ color: "text.secondary", sx: { mt: 0.25 } }}
                  />
                  {!task.completed && (
                    <ArrowForwardIosRounded sx={{ fontSize: 14, color: "text.disabled", mt: 1, ml: 1, flexShrink: 0 }} />
                  )}
                </ListItemButton>
                {index < stats.pendingTasks.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        </Paper>
      )}

      {/* ── Organisation + activity ──────────────────────────────────────────
          Setup-time facts, demoted. These were four tiles and a chart competing
          with the day's numbers; the duplicate staff count is gone (the page
          carried both "Active Staff" and "Total Staff", identical whenever
          nobody is deactivated). */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper elevation={0} sx={{ borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>Organisation</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>How the hospital is set up</Typography>
            </Box>
            {[
              { label: "Doctors", value: stats?.totalDoctors || 0, icon: <MedicalServicesRounded sx={{ fontSize: 18 }} />, to: "/hospital/doctors", sub: undefined as string | undefined },
              { label: "Staff & users", value: stats?.totalStaff || 0, icon: <PeopleAltRounded sx={{ fontSize: 18 }} />, to: "/hospital/users", sub: stats && stats.totalStaff !== stats.activeUsers ? `${stats.activeUsers} active` : undefined },
              { label: "Departments", value: stats?.totalDepartments || 0, icon: <DomainRounded sx={{ fontSize: 18 }} />, to: "/hospital/departments", sub: undefined },
            ].map((row, i, all) => (
              <Box key={row.label}
                onClick={() => navigate(row.to)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.75, cursor: "pointer",
                  borderBottom: i < all.length - 1 ? "1px solid" : 0, borderColor: "divider",
                  "&:hover": { bgcolor: "background.default" },
                }}>
                <Box sx={{ width: 30, height: 30, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(BRAND.action, 0.12), color: BRAND.action }}>
                  {row.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{row.label}</Typography>
                  {row.sub && <Typography variant="caption" sx={{ color: "text.secondary" }}>{row.sub}</Typography>}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>{row.value}</Typography>
                <ArrowForwardIosRounded sx={{ fontSize: 13, color: "text.disabled" }} />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", height: "100%" }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <HistoryRounded sx={{ color: "text.secondary" }} />
              <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>Recent activity</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentActivities.length === 0 ? (
                <ListItem sx={{ py: 2, justifyContent: "center" }}>
                  <Mascot pose="nothing-here-yet" subtitle="No recent activities found." size={120} />
                </ListItem>
              ) : (
                stats?.recentActivities.slice(0, ACTIVITY_ROWS).map((activity, index, shown) => (
                  <Box key={activity.activityLogId}>
                    <ListItem sx={{ py: 1 }}>
                      {(() => {
                        const verb = activity.action.split(" ")[0];
                        const meta = ACTIVITY_ICON[verb];
                        const Icon = meta?.icon;
                        return Icon ? (
                          <ListItemIcon sx={{ minWidth: 34 }}>
                            <Icon sx={{ fontSize: 18, color: meta.color }} />
                          </ListItemIcon>
                        ) : null;
                      })()}
                      <ListItemText
                        primary={activity.action}
                        secondary={new Date(activity.timestamp).toLocaleString()}
                        primaryTypographyProps={{ color: "text.primary", fontWeight: 500, fontSize: "0.875rem" }}
                        secondaryTypographyProps={{ color: "text.secondary", fontSize: "0.75rem" }}
                      />
                    </ListItem>
                    {index < shown.length - 1 && <Divider />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
