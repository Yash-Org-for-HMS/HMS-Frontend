import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { EventBusyRounded, ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import SoftChip from "@/components/SoftChip";
import { SEMANTIC, NEUTRAL, alpha } from "@/styles/accents";

/**
 * What the doctor has coming, beyond today.
 *
 * The dashboard and the queue both answer "who is here now" and neither takes a
 * date, so until this existed a doctor had to telephone reception to find out
 * how many patients they had tomorrow.
 *
 * Opens on tomorrow rather than today for exactly that reason: today is already
 * answered twice over elsewhere, and the question this screen exists for is
 * always about a day that has not happened yet.
 */

interface Row {
  appointmentId: string;
  appointmentDate: string;
  tokenNumber: number | null;
  patientName: string;
  uhid: string;
  phone: string | null;
  statusLabel: string;
  statusColor: string;
  isCancelled: boolean;
}
interface Day {
  date: string;
  onLeave: boolean;
  leaveReason: string | null;
  booked: number;
  cancelled: number;
  rows: Row[];
}
interface Schedule { days: Day[]; total: number }

const DAY_MS = 86_400_000;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Tomorrow" beats a date for the day a doctor is actually asking about. */
function dayLabel(key: string): { name: string; sub: string } {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  const name = diff === 0 ? "Today" : diff === 1 ? "Tomorrow"
    : date.toLocaleDateString(undefined, { weekday: "long" });
  return { name, sub: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
}

const time = (s: string) =>
  new Date(s).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function MySchedule() {
  // Span, not a single day: "what does my week look like" is the same question
  // asked wider, and paging a day at a time to answer it is tedious.
  const [span, setSpan] = useState<1 | 7>(7);
  const [offset, setOffset] = useState(0);

  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 1 + offset * span);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + (span - 1) * DAY_MS);
    return { from: iso(start), to: iso(end) };
  }, [span, offset]);

  const { data, isLoading, error } = useQuery<Schedule>({
    queryKey: ["doctor-schedule", from, to],
    queryFn: async () => (await axiosInstance.get(`/doctor/schedule?from=${from}&to=${to}`)).data.data,
  });

  const rangeLabel = useMemo(() => {
    if (span === 1) { const l = dayLabel(from); return `${l.name}, ${l.sub}`; }
    return `${dayLabel(from).sub} – ${dayLabel(to).sub}`;
  }, [span, from, to]);

  return (
    <PageContainer>
      <PageHeader title="My Schedule" subtitle="Appointments booked with you, from tomorrow onwards" />

      <Paper sx={{ p: 2, mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            exclusive size="small" value={span}
            onChange={(_e, v) => { if (v) { setSpan(v); setOffset(0); } }}
          >
            <ToggleButton value={1}>One day</ToggleButton>
            <ToggleButton value={7}>Week</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1 }} />

          <Button size="small" startIcon={<ChevronLeftRounded />} onClick={() => setOffset((o) => o - 1)}>
            Earlier
          </Button>
          <Typography sx={{ fontWeight: 600, minWidth: 140, textAlign: "center" }}>{rangeLabel}</Typography>
          <Button size="small" endIcon={<ChevronRightRounded />} onClick={() => setOffset((o) => o + 1)}>
            Later
          </Button>
          {offset !== 0 && (
            <Button size="small" onClick={() => setOffset(0)}>Back to tomorrow</Button>
          )}
        </Stack>
      </Paper>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      )}
      {error && <Alert severity="error">{getApiErrorMessage(error)}</Alert>}

      {data && (
        <>
          <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>
            {data.total === 0
              ? "Nothing booked in this range."
              : `${data.total} patient${data.total === 1 ? "" : "s"} booked across ${span === 1 ? "this day" : "these 7 days"}.`}
          </Typography>

          <Stack spacing={2}>
            {data.days.map((day) => {
              const l = dayLabel(day.date);
              return (
                <Paper key={day.date} variant="outlined" sx={{ overflow: "hidden" }}>
                  <Stack
                    direction="row" alignItems="center" spacing={1.5}
                    sx={{ px: 2, py: 1.5, borderBottom: day.rows.length ? "1px solid" : "none", borderColor: "divider" }}
                    flexWrap="wrap" useFlexGap
                  >
                    <Typography sx={{ fontWeight: 700 }}>{l.name}</Typography>
                    <Typography variant="body2" sx={{ color: NEUTRAL.muted }}>{l.sub}</Typography>
                    <Box sx={{ flex: 1 }} />
                    {day.onLeave && (
                      <SoftChip
                        label={day.leaveReason ? `On leave — ${day.leaveReason}` : "On leave"}
                        icon={<EventBusyRounded sx={{ fontSize: 14 }} />}
                        bg={alpha(SEMANTIC.warning, 0.14)} color={SEMANTIC.warning}
                      />
                    )}
                    <SoftChip
                      label={day.booked === 0 ? "No patients" : `${day.booked} patient${day.booked === 1 ? "" : "s"}`}
                      bg={alpha(day.booked ? SEMANTIC.success : NEUTRAL.muted, 0.12)}
                      color={day.booked ? SEMANTIC.success : NEUTRAL.muted}
                    />
                    {day.cancelled > 0 && (
                      <SoftChip
                        label={`${day.cancelled} cancelled`}
                        bg={alpha(NEUTRAL.muted, 0.12)} color={NEUTRAL.muted}
                      />
                    )}
                  </Stack>

                  {/* A day the doctor is away but still has bookings is the one
                      worth shouting about — somebody will arrive to no doctor. */}
                  {day.onLeave && day.booked > 0 && (
                    <Alert severity="warning" square sx={{ borderRadius: 0 }}>
                      You are on leave this day but {day.booked} patient{day.booked === 1 ? " is" : "s are"} still
                      booked. Reception needs to move or cancel them.
                    </Alert>
                  )}

                  {day.rows.length > 0 && (
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Token</TableCell>
                            <TableCell>Patient</TableCell>
                            <TableCell>UHID</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {day.rows.map((r) => (
                            <TableRow key={r.appointmentId} sx={{ opacity: r.isCancelled ? 0.5 : 1 }}>
                              <TableCell sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                {time(r.appointmentDate)}
                              </TableCell>
                              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                                {r.tokenNumber ?? "—"}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{r.patientName}</TableCell>
                              <TableCell sx={{ color: NEUTRAL.muted, fontSize: "0.75rem" }}>{r.uhid}</TableCell>
                              <TableCell>
                                <SoftChip
                                  label={r.statusLabel}
                                  bg={alpha(r.statusColor, 0.14)}
                                  color={r.statusColor}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </PageContainer>
  );
}
