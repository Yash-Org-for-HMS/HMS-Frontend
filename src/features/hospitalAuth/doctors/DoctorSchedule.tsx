import { useState, useEffect } from "react";
import { FORM_PAGE_WIDTH } from "@/components/layout/pageWidth";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "@/components/ErrorState";
import {
  Box, Paper, TextField, Button, MenuItem, Switch, Typography, Stack, IconButton, Tooltip,
} from "@mui/material";
import {
  SaveRounded, DeleteOutlineRounded, AddRounded, BoltRounded, ContentCopyRounded, ScheduleRounded,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import FormSkeleton from "@/components/skeletons/FormSkeleton";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { overlappingWindows } from "@/features/reception/doctorSlots";
import ScheduleWeekView from "./ScheduleWeekView";
import { BRANCH_COLOURS, EVERY_BRANCH_COLOUR } from "./scheduleColours";

const HOSP = BRAND.action;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Display Monday → Sunday (more natural), but keep the real dayOfWeek (0=Sun) as the value.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 0];
const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_WINDOW = { startTime: "09:00", endTime: "17:00", slotDurationMinutes: 15, branchId: "" };

/** branchId "" = at every branch the doctor works at (how every window started). */
type Win = { startTime: string; endTime: string; slotDurationMinutes: number; branchId: string };
type DayCfg = { dayOfWeek: number; enabled: boolean; windows: Win[] };

function blankDays(): DayCfg[] {
  return Array.from({ length: 7 }, (_, dow) => ({ dayOfWeek: dow, enabled: false, windows: [{ ...DEFAULT_WINDOW }] }));
}

export default function DoctorSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [days, setDays] = useState<DayCfg[]>(blankDays());
  const [tpl, setTpl] = useState<Win>({ ...DEFAULT_WINDOW });

  const { data: doctorData, isLoading: initialLoad, isError, error, refetch } = useQuery({
    queryKey: ["doctor-schedule", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });

  // Which branches a window can name: the doctor's, or every branch when the
  // doctor has no branch list (they work everywhere). One branch: no choice to make.
  const { availableBranches } = useHospitalAuth();
  const { data: doctorBranchIds = [] } = useQuery<string[]>({
    queryKey: ["doctor-branches", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}/branches`)).data.data ?? [],
    enabled: !!id,
  });
  const branchOptions = doctorBranchIds.length
    ? availableBranches.filter((b) => doctorBranchIds.includes(b.branchId))
    : availableBranches;
  const pickBranch = availableBranches.length > 1;
  const branchLabel = (b: string) => (b ? availableBranches.find((x) => x.branchId === b)?.branchName ?? "Branch" : "Every branch");
  // A colour per branch, the same on the week view and beside each session.
  const branchColour = (b: string) => {
    const i = availableBranches.findIndex((x) => x.branchId === b);
    return b && i >= 0 ? BRANCH_COLOURS[i % BRANCH_COLOURS.length] : EVERY_BRANCH_COLOUR;
  };

  // Seed the 7-day grid from the saved schedule rows (grouped by day; a day with
  // more than one row is a split shift and keeps both windows).
  useEffect(() => {
    if (!doctorData) return;
    setDoctorName(`Dr. ${doctorData.user?.firstName || ""} ${doctorData.user?.lastName || ""}`.trim());
    const grid = blankDays();
    for (const s of (doctorData.schedules || [])) {
      const dow = Number(s.dayOfWeek);
      if (dow < 0 || dow > 6) continue;
      const win = { startTime: s.startTime || "09:00", endTime: s.endTime || "17:00", slotDurationMinutes: Number(s.slotDurationMinutes) || 15, branchId: s.branchId || "" };
      if (!grid[dow].enabled) { grid[dow].enabled = true; grid[dow].windows = [win]; }
      else grid[dow].windows.push(win);
    }
    setDays(grid);
    // Seed the quick-apply template from the first working day, if any.
    const firstOn = grid.find((d) => d.enabled);
    if (firstOn) setTpl({ ...firstOn.windows[0] });
  }, [doctorData]);

  const patchDay = (dow: number, fn: (d: DayCfg) => DayCfg) =>
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dow ? fn({ ...d, windows: d.windows.map((w) => ({ ...w })) }) : d)));

  const toggleDay = (dow: number, on: boolean) => patchDay(dow, (d) => ({ ...d, enabled: on }));
  const setWin = (dow: number, wIdx: number, field: keyof Win, value: string) =>
    patchDay(dow, (d) => { d.windows[wIdx] = { ...d.windows[wIdx], [field]: field === "slotDurationMinutes" ? Number(value) : value }; return d; });
  const addWin = (dow: number) => patchDay(dow, (d) => ({ ...d, windows: [...d.windows, { ...tpl }] }));
  const removeWin = (dow: number, wIdx: number) =>
    patchDay(dow, (d) => ({ ...d, windows: d.windows.length > 1 ? d.windows.filter((_, i) => i !== wIdx) : d.windows }));

  // ── Quick apply — the whole point: set the hours once, stamp them across days ──
  const applyToDays = (targets: number[], exclusive: boolean) => {
    setDays((prev) => prev.map((d) => {
      if (targets.includes(d.dayOfWeek)) return { ...d, enabled: true, windows: [{ ...tpl }] };
      return exclusive ? { ...d, enabled: false } : d;
    }));
  };
  const copyToEnabled = () =>
    setDays((prev) => prev.map((d) => (d.enabled ? { ...d, windows: [{ ...tpl }] } : d)));
  const clearAll = () => setDays(blankDays());

  const enabledCount = days.filter((d) => d.enabled).length;
  const weekWindows = days.filter((d) => d.enabled).flatMap((d) => d.windows.map((w) => ({ dayOfWeek: d.dayOfWeek, startTime: w.startTime, endTime: w.endTime, branchId: w.branchId })));
  // Said on the day as it happens, not only when Save is pressed: a doctor is in one place at a time.
  const clashOn = (d: DayCfg) => {
    if (!d.enabled || d.windows.length < 2) return null;
    const rows = d.windows.map((w) => ({ ...w, dayOfWeek: d.dayOfWeek }));
    const clash = overlappingWindows(rows);
    return clash ? `${clash[0].startTime}–${clash[0].endTime} (${branchLabel(clash[0].branchId)}) overlaps ${clash[1].startTime}–${clash[1].endTime} (${branchLabel(clash[1].branchId)}). A doctor can be at one place at a time.` : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Light validation: every working window must have end after start.
    for (const d of days) {
      if (!d.enabled) continue;
      for (const w of d.windows) {
        if (!w.startTime || !w.endTime || w.endTime <= w.startTime) {
          toast.error(`${DAY_NAMES[d.dayOfWeek]}: end time must be after start time.`);
          return;
        }
      }
    }
    const schedules = days
      .filter((d) => d.enabled)
      .flatMap((d) => d.windows.map((w) => ({ dayOfWeek: d.dayOfWeek, startTime: w.startTime, endTime: w.endTime, slotDurationMinutes: Number(w.slotDurationMinutes), branchId: w.branchId || null })));
    // One person, one place: windows on a day may not overlap, whatever their branches.
    const clash = overlappingWindows(schedules);
    if (clash) {
      const [a, b] = clash;
      toast.error(`${DAY_NAMES[a.dayOfWeek]}: ${a.startTime}–${a.endTime} and ${b.startTime}–${b.endTime} overlap. A doctor can be at one place at a time.`);
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.put(`/hospital/doctors/${id}/schedule`, { schedules });
      toast.success("Schedule saved");
      navigate("/hospital/doctors");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "An error occurred"));
      setLoading(false);
    }
  };

  if (initialLoad) return <FormSkeleton />;
  if (isError) return <ErrorState title="Couldn't load schedule" message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box sx={{ maxWidth: FORM_PAGE_WIDTH, mx: "auto", width: "100%" }}>
      <PageHeader
        title="Configure Schedule"
        subtitle={doctorName}
        actions={
          <Button variant="outlined" onClick={() => navigate("/hospital/doctors")} sx={{ color: "text.secondary", borderColor: "divider" }}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        {/* ── Quick apply ─────────────────────────────────────────────────── */}
        <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: `${HOSP}0a` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <BoltRounded sx={{ color: HOSP }} />
            <Typography sx={{ fontWeight: 800 }}>Quick set</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>— set the hours once, then apply to many days</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <TextField type="time" label="Start" size="small" value={tpl.startTime} onChange={(e) => setTpl({ ...tpl, startTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} />
            <TextField type="time" label="End" size="small" value={tpl.endTime} onChange={(e) => setTpl({ ...tpl, endTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} />
            <TextField select label="Slot" size="small" value={tpl.slotDurationMinutes} onChange={(e) => setTpl({ ...tpl, slotDurationMinutes: Number(e.target.value) })} sx={{ width: 110 }}>
              {SLOT_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m} min</MenuItem>)}
            </TextField>
            {pickBranch && (
              <TextField select label="Branch" size="small" value={tpl.branchId} onChange={(e) => setTpl({ ...tpl, branchId: e.target.value })} sx={{ width: 170 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value="">Every branch</MenuItem>
                {branchOptions.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
              </TextField>
            )}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="contained" onClick={() => applyToDays([0, 1, 2, 3, 4, 5, 6], true)} sx={{ bgcolor: HOSP, textTransform: "none" }}>All days</Button>
              <Button size="small" variant="outlined" onClick={() => applyToDays(WEEKDAYS, true)} sx={{ textTransform: "none", borderColor: HOSP, color: HOSP }}>Mon–Fri</Button>
              <Button size="small" variant="outlined" onClick={() => applyToDays(WEEKEND, true)} sx={{ textTransform: "none", borderColor: HOSP, color: HOSP }}>Weekends</Button>
              <Tooltip title="Set these hours on the days already switched on">
                <Button size="small" variant="text" startIcon={<ContentCopyRounded />} onClick={copyToEnabled} sx={{ textTransform: "none", color: "text.secondary" }}>Fill enabled</Button>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        {/* ── The week, drawn ─────────────────────────────────────────────── */}
        <ScheduleWeekView windows={weekWindows} colourOf={branchColour} nameOf={branchLabel} />

        {/* ── Per-day grid ────────────────────────────────────────────────── */}
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ScheduleRounded sx={{ color: HOSP, fontSize: 20 }} />
              <Typography sx={{ fontWeight: 800 }}>Working days</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>· {enabledCount} of 7 open</Typography>
            </Box>
            {enabledCount > 0 && (
              <Button size="small" variant="text" onClick={clearAll} sx={{ textTransform: "none", color: SEMANTIC.danger }}>Clear all</Button>
            )}
          </Box>

          {DISPLAY_ORDER.map((dow) => {
            const d = days[dow];
            const clash = clashOn(d);
            return (
              <Box key={dow} sx={{ px: 2.5, py: 1.75, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 }, bgcolor: d.enabled ? "transparent" : "action.hover" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
                  {/* Day toggle */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: 170, flexShrink: 0, pt: 0.5 }}>
                    <Switch checked={d.enabled} onChange={(e) => toggleDay(dow, e.target.checked)}
                      sx={{ "& .Mui-checked": { color: HOSP }, "& .Mui-checked + .MuiSwitch-track": { bgcolor: `${HOSP} !important` } }} />
                    <Typography sx={{ fontWeight: 700, color: d.enabled ? "text.primary" : "text.secondary" }}>{DAY_NAMES[dow]}</Typography>
                  </Box>

                  {/* Windows or "Closed" */}
                  {!d.enabled ? (
                    <Typography variant="body2" sx={{ color: "text.disabled", pt: 1 }}>Closed</Typography>
                  ) : (
                    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                      {d.windows.map((w, wIdx) => (
                        <Box key={wIdx} sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                          {pickBranch && (
                            <Tooltip title={branchLabel(w.branchId)}>
                              <Box aria-hidden sx={{ width: 4, alignSelf: "stretch", minHeight: 36, borderRadius: 2, bgcolor: branchColour(w.branchId) }} />
                            </Tooltip>
                          )}
                          <TextField type="time" label="Start" size="small" value={w.startTime} onChange={(e) => setWin(dow, wIdx, "startTime", e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} />
                          <TextField type="time" label="End" size="small" value={w.endTime} onChange={(e) => setWin(dow, wIdx, "endTime", e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 145 }} />
                          <TextField select label="Slot" size="small" value={w.slotDurationMinutes} onChange={(e) => setWin(dow, wIdx, "slotDurationMinutes", e.target.value)} sx={{ width: 105 }}>
                            {SLOT_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m} min</MenuItem>)}
                          </TextField>
                          {pickBranch && (
                            <TextField select label="Branch" size="small" value={w.branchId} onChange={(e) => setWin(dow, wIdx, "branchId", e.target.value)} sx={{ width: 170 }}
                              SelectProps={{ displayEmpty: true, renderValue: (v) => branchLabel(String(v)) }} InputLabelProps={{ shrink: true }}>
                              <MenuItem value="">Every branch</MenuItem>
                              {branchOptions.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
                            </TextField>
                          )}
                          {d.windows.length > 1 && (
                            <Tooltip title="Remove this time block">
                              <IconButton size="small" onClick={() => removeWin(dow, wIdx)} sx={{ color: "text.secondary" }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                          {wIdx === d.windows.length - 1 && (
                            <Tooltip title={pickBranch ? "Add another session that day — at this branch or another" : "Add another session that day (e.g. morning + evening)"}>
                              <Button size="small" startIcon={<AddRounded />} onClick={() => addWin(dow)} sx={{ textTransform: "none", color: HOSP }}>Add time</Button>
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                      {clash && (
                        <Typography variant="caption" sx={{ color: SEMANTIC.danger, fontWeight: 600 }}>{clash}</Typography>
                      )}
                    </Stack>
                  )}
                </Box>
              </Box>
            );
          })}
        </Paper>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button type="submit" variant="contained" disabled={loading} startIcon={<SaveRounded />}
            sx={{ bgcolor: HOSP, py: 1.25, px: 4 }}>
            {loading ? "Saving…" : "Save Schedule"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
