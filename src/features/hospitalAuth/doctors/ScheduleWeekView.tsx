import { Box, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { CalendarViewWeekRounded } from "@mui/icons-material";
import { SEMANTIC } from "@/styles/accents";

/**
 * Where the doctor is, all week, at a glance — beside the per-day editor on the
 * schedule screen. One line per day, a block per session, coloured by branch;
 * it redraws as the hours are edited, so "Monday mornings at Kothrud, evenings
 * at Wakad" can be read off rather than worked out from rows of time fields.
 */

export interface WeekWindow { dayOfWeek: number; startTime: string; endTime: string; branchId: string }

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const clock = (t: string) => {
  const m = toMin(t), h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? " am" : " pm"}`;
};
const hours = (mins: number) => (mins % 60 ? `${Math.floor(mins / 60)} h ${mins % 60} m` : `${mins / 60} h`);

export default function ScheduleWeekView({ windows, colourOf, nameOf }: {
  windows: WeekWindow[];
  colourOf: (branchId: string) => string;
  nameOf: (branchId: string) => string;
}) {
  const valid = windows.filter((w) => w.startTime && w.endTime && toMin(w.endTime) > toMin(w.startTime));
  // The axis fits the day's sessions, never narrower than 8 am – 8 pm.
  const from = Math.min(8 * 60, ...valid.map((w) => Math.floor(toMin(w.startTime) / 60) * 60));
  const to = Math.max(20 * 60, ...valid.map((w) => Math.ceil(toMin(w.endTime) / 60) * 60));
  const pct = (m: number) => `${((m - from) / (to - from)) * 100}%`;
  const ticks: number[] = [];
  for (let m = from; m <= to; m += 120) ticks.push(m);

  const perBranch = new Map<string, number>();
  for (const w of valid) perBranch.set(w.branchId, (perBranch.get(w.branchId) ?? 0) + toMin(w.endTime) - toMin(w.startTime));

  return (
    <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <CalendarViewWeekRounded sx={{ color: "text.secondary", fontSize: 20 }} />
        <Typography sx={{ fontWeight: 800 }}>Week at a glance</Typography>
        <Box sx={{ flex: 1 }} />
        {/* The legend doubles as the weekly total at each branch. */}
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
          {[...perBranch.entries()].map(([b, mins]) => (
            <Box key={b || "every"} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: colourOf(b) }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{nameOf(b)}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{hours(mins)} a week</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {valid.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No hours yet — switch a day on below.</Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "44px 1fr", columnGap: 1.5, rowGap: 0.75, overflowX: "auto" }}>
          <Box />
          <Box sx={{ position: "relative", height: 16, minWidth: 420 }}>
            {ticks.map((m) => (
              <Typography key={m} variant="caption" sx={{ position: "absolute", left: pct(m), transform: m === from ? "none" : m === to ? "translateX(-100%)" : "translateX(-50%)", color: "text.secondary", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                {clock(`${String(Math.floor(m / 60)).padStart(2, "0")}:00`)}
              </Typography>
            ))}
          </Box>
          {ORDER.map((d) => {
            const day = valid.filter((w) => w.dayOfWeek === d).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
            return (
              <Box key={d} sx={{ display: "contents" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: day.length ? "text.primary" : "text.disabled", lineHeight: "28px" }}>{SHORT[d]}</Typography>
                <Box sx={{ position: "relative", height: 28, minWidth: 420, borderRadius: 1.5, bgcolor: "action.hover" }}>
                  {ticks.slice(1, -1).map((m) => (
                    <Box key={m} sx={{ position: "absolute", left: pct(m), top: 0, bottom: 0, borderLeft: "1px dashed", borderColor: "divider" }} />
                  ))}
                  {day.map((w, i) => {
                    const width = toMin(w.endTime) - toMin(w.startTime);
                    // A session that runs into another is outlined: one place at a time.
                    const clashes = day.some((o, j) => j !== i && toMin(w.startTime) < toMin(o.endTime) && toMin(o.startTime) < toMin(w.endTime));
                    return (
                      <Tooltip key={i} title={`${DAY[d]} · ${clock(w.startTime)} – ${clock(w.endTime)} · ${nameOf(w.branchId)}${clashes ? " — overlaps another session" : ""}`}>
                        <Box data-clash={clashes || undefined} sx={{
                          position: "absolute", left: pct(toMin(w.startTime)), width: `calc(${pct(toMin(w.startTime) + width)} - ${pct(toMin(w.startTime))} - 2px)`,
                          top: 3, bottom: 3, borderRadius: 1, bgcolor: colourOf(w.branchId), color: "#fff",
                          display: "flex", alignItems: "center", px: 0.75, overflow: "hidden", cursor: "default",
                          ...(clashes ? { outline: `2px solid ${SEMANTIC.danger}`, outlineOffset: 1, zIndex: 1 } : {}),
                        }}>
                          <Typography variant="caption" noWrap sx={{ fontWeight: 700, fontSize: "0.7rem", color: "inherit" }}>
                            {nameOf(w.branchId)} · {clock(w.startTime)}–{clock(w.endTime)}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}
