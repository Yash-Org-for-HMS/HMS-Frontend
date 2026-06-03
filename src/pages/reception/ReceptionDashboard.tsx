import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Skeleton,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  CalendarTodayRounded,
  HowToRegRounded,
  HourglassTopRounded,
  CheckCircleRounded,
  CurrencyRupeeRounded,
  RefreshRounded,
  AccessTimeRounded,
  TrendingUpRounded,
  FiberManualRecordRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";

// ── Types ─────────────────────────────────────────────────────────────
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
  completedVisits: number;
  todaysRevenue: number;
  upcomingAppointments: AppointmentEntry[];
  lastUpdated: string;
}

// ── Stat Card Component ────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  subtitle?: string;
  prefix?: string;
  loading?: boolean;
  trend?: number;
  animationDelay?: number;
}

function StatCard({
  title,
  value,
  icon,
  color,
  bgColor,
  borderColor,
  glowColor,
  subtitle,
  prefix,
  loading,
  trend,
  animationDelay = 0,
}: StatCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), animationDelay);
    return () => clearTimeout(timer);
  }, [animationDelay]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.4s ease, transform 0.4s ease, box-shadow 0.25s ease",
        "&:hover": {
          boxShadow: `0 0 30px ${glowColor}`,
          transform: "translateY(-3px)",
          borderColor: color,
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: 0.8,
        },
      }}
    >
      {/* Background glow effect */}
      <Box
        sx={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: "#64748b",
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              fontSize: "0.7rem",
            }}
          >
            {title}
          </Typography>

          {loading ? (
            <Skeleton
              width={80}
              height={48}
              sx={{ bgcolor: "rgba(255,255,255,0.05)", borderRadius: 1 }}
            />
          ) : (
            <Typography
              variant="h3"
              sx={{
                color: "#f1f5f9",
                fontWeight: 800,
                mt: 0.5,
                lineHeight: 1,
                fontFamily: "'Inter', sans-serif",
                fontSize: { xs: "2rem", md: "2.2rem" },
              }}
            >
              {prefix && (
                <Typography component="span" sx={{ fontSize: "1.2rem", color: "#94a3b8", mr: 0.3 }}>
                  {prefix}
                </Typography>
              )}
              {typeof value === "number" && value > 999
                ? value.toLocaleString("en-IN")
                : value}
            </Typography>
          )}

          {subtitle && (
            <Typography variant="caption" sx={{ color: "#475569", mt: 0.5, display: "block" }}>
              {subtitle}
            </Typography>
          )}

          {trend !== undefined && !loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
              <TrendingUpRounded sx={{ fontSize: 14, color: "#34d399" }} />
              <Typography variant="caption" sx={{ color: "#34d399", fontWeight: 600 }}>
                Live
              </Typography>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
            border: `1px solid ${color}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color,
            flexShrink: 0,
            ml: 2,
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

// ── Live Clock Component ────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box sx={{ textAlign: "right" }}>
      <Typography
        variant="h5"
        sx={{
          color: "#06b6d4",
          fontWeight: 800,
          fontFamily: "monospace",
          letterSpacing: 2,
        }}
      >
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </Typography>
      <Typography variant="caption" sx={{ color: "#475569" }}>
        {time.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </Typography>
    </Box>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────
export default function ReceptionDashboard() {
  const { user, hospital } = useHospitalAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const res = await axiosInstance.get("/reception/dashboard/stats");
      setStats(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchStats(true), 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const cards = [
    {
      title: "Today's Appointments",
      value: stats?.todaysAppointments ?? 0,
      icon: <CalendarTodayRounded sx={{ fontSize: 26 }} />,
      color: "#3b82f6",
      bgColor: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      borderColor: "rgba(59, 130, 246, 0.2)",
      glowColor: "rgba(59, 130, 246, 0.1)",
      subtitle: "Total scheduled today",
      trend: 1,
      animationDelay: 0,
    },
    {
      title: "Checked-In Patients",
      value: stats?.checkedInPatients ?? 0,
      icon: <HowToRegRounded sx={{ fontSize: 26 }} />,
      color: "#10b981",
      bgColor: "linear-gradient(135deg, #0f172a 0%, #0a2a1f 100%)",
      borderColor: "rgba(16, 185, 129, 0.2)",
      glowColor: "rgba(16, 185, 129, 0.1)",
      subtitle: "Currently checked in",
      trend: 1,
      animationDelay: 80,
    },
    {
      title: "Waiting Patients",
      value: stats?.waitingPatients ?? 0,
      icon: <HourglassTopRounded sx={{ fontSize: 26 }} />,
      color: "#f59e0b",
      bgColor: "linear-gradient(135deg, #0f172a 0%, #2a1f0a 100%)",
      borderColor: "rgba(245, 158, 11, 0.2)",
      glowColor: "rgba(245, 158, 11, 0.1)",
      subtitle: "In waiting area",
      trend: 1,
      animationDelay: 160,
    },
    {
      title: "Completed Visits",
      value: stats?.completedVisits ?? 0,
      icon: <CheckCircleRounded sx={{ fontSize: 26 }} />,
      color: "#8b5cf6",
      bgColor: "linear-gradient(135deg, #0f172a 0%, #1a0f2e 100%)",
      borderColor: "rgba(139, 92, 246, 0.2)",
      glowColor: "rgba(139, 92, 246, 0.1)",
      subtitle: "Consultations done today",
      trend: 1,
      animationDelay: 240,
    },
    {
      title: "Today's Revenue",
      value: stats?.todaysRevenue ?? 0,
      icon: <CurrencyRupeeRounded sx={{ fontSize: 26 }} />,
      color: "#06b6d4",
      bgColor: "linear-gradient(135deg, #0f172a 0%, #0c1f2e 100%)",
      borderColor: "rgba(6, 182, 212, 0.2)",
      glowColor: "rgba(6, 182, 212, 0.1)",
      subtitle: "Payments collected today",
      prefix: "₹",
      trend: 1,
      animationDelay: 320,
    },
  ];

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--:--";
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* ── Header ───────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 4,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "#34d399",
                boxShadow: "0 0 8px #34d399",
                animation: "pulse 2s infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: "#34d399", fontWeight: 600, letterSpacing: 1 }}>
              LIVE
            </Typography>
          </Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: "#f1f5f9", mb: 0.5, letterSpacing: "-0.5px" }}
          >
            Reception Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569" }}>
            Welcome,{" "}
            <Box component="span" sx={{ color: "#94a3b8", fontWeight: 600 }}>
              {user?.firstName} {user?.lastName}
            </Box>{" "}
            · {hospital?.name}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <LiveClock />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ color: "#334155" }}>
              {stats?.lastUpdated
                ? `Updated ${formatTime(stats.lastUpdated)}`
                : "Fetching data..."}
            </Typography>
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={() => fetchStats(true)}
                disabled={refreshing}
                sx={{
                  color: "#06b6d4",
                  "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" },
                }}
              >
                <RefreshRounded
                  fontSize="small"
                  sx={{
                    animation: refreshing ? "spin 1s linear infinite" : "none",
                    "@keyframes spin": { "100%": { transform: "rotate(360deg)" } },
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            bgcolor: "rgba(239, 68, 68, 0.08)",
            color: "#fca5a5",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ── Stat Cards Grid ────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, lg: 12 / 5 }} key={card.title}>
            <StatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Bottom Section ─────────────────────────────── */}
      <Grid container spacing={3}>
        {/* Upcoming Appointments Table */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid rgba(6, 182, 212, 0.12)",
              background: "linear-gradient(135deg, #0c1a3a 0%, #0f172a 100%)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ color: "#e2e8f0", fontWeight: 700 }}>
                  Today's Appointments
                </Typography>
                <Typography variant="caption" sx={{ color: "#475569" }}>
                  Upcoming queue for today
                </Typography>
              </Box>
              <Chip
                label={`${stats?.todaysAppointments ?? "—"} total`}
                size="small"
                sx={{
                  bgcolor: "rgba(6, 182, 212, 0.1)",
                  color: "#06b6d4",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  fontWeight: 600,
                }}
              />
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Token", "Time", "Patient ID", "Doctor ID", "Status"].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          color: "#475569",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          borderBottom: "1px solid rgba(6, 182, 212, 0.08)",
                          py: 1.5,
                          bgcolor: "rgba(6, 182, 212, 0.03)",
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j} sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)", py: 1.5 }}>
                            <Skeleton sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : stats?.upcomingAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: "center", py: 5, borderBottom: "none" }}>
                        <CalendarTodayRounded sx={{ fontSize: 36, color: "#1e3a5f", mb: 1 }} />
                        <Typography variant="body2" sx={{ color: "#334155" }}>
                          No appointments scheduled for today
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats?.upcomingAppointments.map((apt) => (
                      <TableRow
                        key={apt.appointmentId}
                        sx={{
                          "&:hover": { bgcolor: "rgba(6, 182, 212, 0.04)" },
                          transition: "background 0.15s ease",
                        }}
                      >
                        <TableCell
                          sx={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            py: 1.5,
                            color: "#06b6d4",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                          }}
                        >
                          #{apt.tokenNumber}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            py: 1.5,
                            color: "#94a3b8",
                            fontSize: "0.85rem",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <AccessTimeRounded sx={{ fontSize: 13, color: "#475569" }} />
                            {formatTime(apt.appointmentTime)}
                          </Box>
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            py: 1.5,
                            color: "#64748b",
                            fontSize: "0.78rem",
                            maxWidth: 120,
                          }}
                        >
                          <Typography noWrap sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                            {apt.patientId ? apt.patientId.slice(-8).toUpperCase() : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            py: 1.5,
                            color: "#64748b",
                            fontSize: "0.78rem",
                          }}
                        >
                          <Typography noWrap sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                            {apt.doctorId ? apt.doctorId.slice(-8).toUpperCase() : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)", py: 1.5 }}
                        >
                          <Chip
                            label={apt.status.label}
                            size="small"
                            sx={{
                              bgcolor: `${apt.status.color}22`,
                              color: apt.status.color,
                              border: `1px solid ${apt.status.color}44`,
                              fontWeight: 600,
                              fontSize: "0.7rem",
                              height: 22,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Quick Stats Panel */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid rgba(6, 182, 212, 0.12)",
              background: "linear-gradient(135deg, #0c1a3a 0%, #0f172a 100%)",
              overflow: "hidden",
              height: "100%",
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2,
                borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
              }}
            >
              <Typography variant="h6" sx={{ color: "#e2e8f0", fontWeight: 700 }}>
                Visit Breakdown
              </Typography>
              <Typography variant="caption" sx={{ color: "#475569" }}>
                Today's patient flow
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              {/* Progress bars for patient flow */}
              {[
                {
                  label: "Checked In",
                  value: stats?.checkedInPatients ?? 0,
                  total: stats?.todaysAppointments ?? 1,
                  color: "#10b981",
                },
                {
                  label: "Waiting",
                  value: stats?.waitingPatients ?? 0,
                  total: stats?.todaysAppointments ?? 1,
                  color: "#f59e0b",
                },
                {
                  label: "Completed",
                  value: stats?.completedVisits ?? 0,
                  total: stats?.todaysAppointments ?? 1,
                  color: "#8b5cf6",
                },
              ].map((item) => {
                const pct =
                  item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                return (
                  <Box key={item.label} sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.8,
                        alignItems: "center",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <FiberManualRecordRounded sx={{ fontSize: 10, color: item.color }} />
                        <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 500 }}>
                          {item.label}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {loading ? (
                          <Skeleton width={30} sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
                        ) : (
                          <Typography variant="body2" sx={{ color: "#e2e8f0", fontWeight: 700 }}>
                            {item.value}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: "#334155" }}>
                          ({pct}%)
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "rgba(255,255,255,0.05)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          height: "100%",
                          width: loading ? "0%" : `${pct}%`,
                          borderRadius: 3,
                          bgcolor: item.color,
                          boxShadow: `0 0 8px ${item.color}80`,
                          transition: "width 1s ease",
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}

              <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.08)", my: 2 }} />

              {/* Revenue Summary */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(6, 182, 212, 0.06)",
                  border: "1px solid rgba(6, 182, 212, 0.12)",
                }}
              >
                <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Revenue Today
                </Typography>
                {loading ? (
                  <Skeleton width={120} height={36} sx={{ bgcolor: "rgba(255,255,255,0.05)" }} />
                ) : (
                  <Typography
                    variant="h5"
                    sx={{ color: "#06b6d4", fontWeight: 800, mt: 0.5 }}
                  >
                    ₹{(stats?.todaysRevenue ?? 0).toLocaleString("en-IN")}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: "#334155" }}>
                  Payments collected
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
