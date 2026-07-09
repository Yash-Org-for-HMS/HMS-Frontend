import { ACCENTS } from "../../styles/accents";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, IconButton, TextField, MenuItem,
  ToggleButton, ToggleButtonGroup, Tooltip, Chip,
} from "@mui/material";
import {
  ChevronLeftRounded, ChevronRightRounded, TodayRounded, AddRounded,
  ViewListRounded, CalendarMonthRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import PageSkeleton from "../../components/PageSkeleton";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import dayjs, { Dayjs } from "dayjs";

// Grid bounds. Slots run START_HOUR→END_HOUR in SLOT_MINUTES steps.
const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;
const ROW_H = 52; // px per slot row

const ACCENT = ACCENTS.reception;

type View = "day" | "week";

// Minutes from START_HOUR for a given appointment date, clamped to the grid.
function slotIndexFor(d: Dayjs): number {
  const mins = (d.hour() - START_HOUR) * 60 + d.minute();
  const idx = Math.floor(mins / SLOT_MINUTES);
  return Math.max(0, Math.min(TOTAL_SLOTS - 1, idx));
}

export default function AppointmentCalendar() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Dayjs>(dayjs().startOf("day"));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // The visible days: 1 for day view, Sun→Sat for week view.
  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const start = anchor.startOf("week");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [view, anchor]);

  const rangeFrom = days[0].format("YYYY-MM-DD");
  const rangeTo = days[days.length - 1].format("YYYY-MM-DD");

  const { data: dropdowns = { doctors: [], departments: [] } } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });

  const { data: appointments = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["reception-calendar", rangeFrom, rangeTo, doctorId, departmentId],
    queryFn: async () => (await axiosInstance.get("/reception/appointments", {
      params: { from: rangeFrom, to: rangeTo, ...(doctorId ? { doctorId } : {}), ...(departmentId ? { departmentId } : {}) },
    })).data.data,
  });

  // appointments[dayKey][slotIndex] -> appt[]
  const grid = useMemo(() => {
    const map = new Map<string, Map<number, any[]>>();
    for (const a of appointments) {
      if (a.statusLabel === "Cancelled") continue;
      const d = dayjs(a.appointmentDate);
      const dayKey = d.format("YYYY-MM-DD");
      const slot = slotIndexFor(d);
      if (!map.has(dayKey)) map.set(dayKey, new Map());
      const slots = map.get(dayKey)!;
      if (!slots.has(slot)) slots.set(slot, []);
      slots.get(slot)!.push(a);
    }
    return map;
  }, [appointments]);

  const rangeLabel = view === "day"
    ? anchor.format("dddd, MMM D, YYYY")
    : `${days[0].format("MMM D")} – ${days[6].format("MMM D, YYYY")}`;

  const filteredDoctors = (dropdowns?.doctors || []).filter((d: any) => !departmentId || d.departmentId === departmentId);

  const step = (dir: number) => setAnchor((a) => a.add(dir * (view === "day" ? 1 : 7), "day"));

  const bookAt = (day: Dayjs, slotIdx: number) => {
    const mins = slotIdx * SLOT_MINUTES;
    const time = day.startOf("day").add(START_HOUR * 60 + mins, "minute").format("HH:mm");
    const params = new URLSearchParams({ date: day.format("YYYY-MM-DD"), time });
    if (doctorId) params.set("doctorId", doctorId);
    navigate(`/reception/appointments/new?${params.toString()}`);
  };

  const slotTimeLabel = (idx: number) =>
    dayjs().startOf("day").add(START_HOUR * 60 + idx * SLOT_MINUTES, "minute").format("h:mm A");

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Appointment Calendar"
        subtitle="Day / week schedule across doctors and departments"
        actions={
          <>
            <Button variant="outlined" startIcon={<ViewListRounded />} onClick={() => navigate("/reception/appointments")}
              sx={{ textTransform: "none", borderRadius: 2, borderColor: "divider", color: "text.secondary" }}>
              List view
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate("/reception/appointments/new")}
              sx={{ background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", fontWeight: 600, textTransform: "none", borderRadius: 2 }}>
              Book Appointment
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" onClick={() => step(-1)}><ChevronLeftRounded /></IconButton>
          <Button size="small" startIcon={<TodayRounded />} onClick={() => setAnchor(dayjs().startOf("day"))}
            sx={{ textTransform: "none", color: "text.secondary" }}>Today</Button>
          <IconButton size="small" onClick={() => step(1)}><ChevronRightRounded /></IconButton>
        </Box>

        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary", minWidth: 200 }}>
          {rangeLabel}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <TextField select size="small" label="Department" value={departmentId}
          onChange={(e) => { setDepartmentId(e.target.value); setDoctorId(""); }} sx={{ minWidth: 170 }}>
          <MenuItem value="">All departments</MenuItem>
          {(dropdowns?.departments || []).map((d: any) => (
            <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
          ))}
        </TextField>

        <TextField select size="small" label="Doctor" value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)} sx={{ minWidth: 190 }}>
          <MenuItem value="">All doctors</MenuItem>
          {filteredDoctors.map((d: any) => (
            <MenuItem key={d.doctorId} value={d.doctorId}>Dr. {d.user?.firstName || ""} {d.user?.lastName || ""}</MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup size="small" exclusive value={view}
          onChange={(_, v) => v && setView(v)}
          sx={{ "& .MuiToggleButton-root.Mui-selected": { bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#0e7490" } } }}>
          <ToggleButton value="day" sx={{ textTransform: "none", px: 2 }}>Day</ToggleButton>
          <ToggleButton value="week" sx={{ textTransform: "none", px: 2 }}>Week</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Grid */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        {isError ? (
          <Box sx={{ p: 4 }}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></Box>
        ) : (
          <Box sx={{ overflowX: "auto", position: "relative" }}>
            {isLoading && (
              <PageSkeleton />
            )}

            {/* Day headers */}
            <Box sx={{ display: "grid", gridTemplateColumns: `72px repeat(${days.length}, minmax(140px, 1fr))`, borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 4 }}>
              <Box sx={{ borderRight: "1px solid", borderColor: "divider" }} />
              {days.map((day) => {
                const isToday = day.isSame(dayjs(), "day");
                return (
                  <Box key={day.format("YYYY-MM-DD")} sx={{ p: 1, textAlign: "center", borderRight: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", display: "block" }}>
                      {day.format("ddd")}
                    </Typography>
                    <Box sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", mt: 0.5, bgcolor: isToday ? ACCENT : "transparent", color: isToday ? "#fff" : "text.primary", fontWeight: 700, fontSize: "0.875rem" }}>
                      {day.format("D")}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Time rows */}
            {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => {
              const isHourStart = slotIdx % SLOTS_PER_HOUR === 0;
              return (
                <Box key={slotIdx} sx={{ display: "grid", gridTemplateColumns: `72px repeat(${days.length}, minmax(140px, 1fr))`, minHeight: ROW_H }}>
                  {/* Time label */}
                  <Box sx={{ borderRight: "1px solid", borderColor: "divider", borderTop: isHourStart ? "1px solid" : "none", borderTopColor: "divider", display: "flex", justifyContent: "flex-end", pr: 1, pt: 0.5 }}>
                    {isHourStart && (
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        {slotTimeLabel(slotIdx)}
                      </Typography>
                    )}
                  </Box>

                  {/* Day cells */}
                  {days.map((day) => {
                    const dayKey = day.format("YYYY-MM-DD");
                    const appts = grid.get(dayKey)?.get(slotIdx) || [];
                    return (
                      <Box
                        key={dayKey + slotIdx}
                        onClick={() => appts.length === 0 && bookAt(day, slotIdx)}
                        sx={{
                          borderRight: "1px solid", borderColor: "divider",
                          borderTop: isHourStart ? "1px solid" : "1px dashed",
                          borderTopColor: isHourStart ? "divider" : "rgba(0,0,0,0.04)",
                          p: 0.5, display: "flex", flexDirection: "column", gap: 0.5,
                          cursor: appts.length === 0 ? "pointer" : "default",
                          "&:hover": appts.length === 0 ? { bgcolor: "rgba(8,145,178,0.05)" } : {},
                        }}
                      >
                        {appts.map((a) => (
                          <Tooltip key={a.appointmentId} title={`${dayjs(a.appointmentDate).format("h:mm A")} • ${a.patientName} • ${a.doctorName} • ${a.statusLabel}`}>
                            <Box
                              onClick={(e) => { e.stopPropagation(); navigate(`/reception/appointments/${a.appointmentId}/edit`); }}
                              sx={{
                                cursor: "pointer", borderRadius: 1.5, px: 1, py: 0.5,
                                bgcolor: `${a.statusColor || ACCENT}1a`,
                                borderLeft: `3px solid ${a.statusColor || ACCENT}`,
                                "&:hover": { bgcolor: `${a.statusColor || ACCENT}33` },
                                overflow: "hidden",
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", display: "block", lineHeight: 1.3 }} noWrap>
                                {dayjs(a.appointmentDate).format("h:mm A")} {a.patientName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.2 }} noWrap>
                                {a.doctorName}
                              </Typography>
                            </Box>
                          </Tooltip>
                        ))}
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <CalendarMonthRounded sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Click an empty slot to book • click an appointment to open it • cancelled appointments are hidden
        </Typography>
      </Box>
    </Box>
  );
}
