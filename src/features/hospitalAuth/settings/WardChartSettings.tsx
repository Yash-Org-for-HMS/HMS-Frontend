import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, Grid, TextField, MenuItem, Button, IconButton,
  Alert, Chip, Divider, Tooltip,
} from "@mui/material";
import { AddRounded, DeleteOutlineRounded, ScheduleRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import ObservationFieldsPanel from "./ObservationFieldsPanel";

/**
 * How this hospital charts its wards.
 *
 * Nothing here is required. A hospital that never opens this screen still gets a
 * correct chart from the defaults — this exists so the ones whose shifts or
 * units differ are not forced into somebody else's pattern.
 *
 * Two panels used to sit here and do nothing. "How often observations are
 * taken" and "Chart columns" both saved happily and were read by no chart:
 * observationIntervalsJson and visibleColumnsJson had zero consumers anywhere
 * in the codebase, while the caption under the first promised it "decides which
 * rows the chart pre-draws". A setting that states an effect it does not have
 * is worse than an absent one, because the ward believes it.
 *
 * What is left is wired. Shifts and the chart day drive the chart; the
 * temperature unit is read by it; and the sign-off roles reach the handover —
 * verified end to end: saving ["ZZ Charge Nurse", …] made those exact roles the
 * ones a shift asks for, replacing the Staff Nurse / Duty Doctor defaults.
 */

interface Shift { chartShiftId: string | null; name: string; startTime: string; endTime: string; sortOrder: number }

export default function WardChartSettings() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-chart-profile"],
    queryFn: async () => (await axiosInstance.get("/ipd/chart-profile")).data.data,
  });

  const [unit, setUnit] = useState("F");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    if (!data) return;
    setUnit(data.temperatureUnit);
    setShifts(data.shifts);
    setRoles(data.signOffRoles);
  }, [data]);

  // The chart day is derived from the earliest shift, never entered separately —
  // so it can never drift out of step with the shifts themselves.
  const chartDayStart = shifts.length
    ? [...shifts].sort((a, b) => a.sortOrder - b.sortOrder)[0].startTime
    : "—";

  const save = useMutation({
    mutationFn: async () =>
      (await axiosInstance.put("/ipd/chart-profile", {
        temperatureUnit: unit,
        shifts: shifts.map((s, i) => ({ name: s.name, startTime: s.startTime, endTime: s.endTime, sortOrder: i })),
        signOffRoles: roles,
      })).data,
    onSuccess: () => {
      toast.success("Ward chart settings saved");
      qc.invalidateQueries({ queryKey: ["ward-chart-profile"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const setShift = (i: number, patch: Partial<Shift>) =>
    setShifts(shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  if (isLoading) return <Box sx={{ p: 3 }}><ListSkeleton rows={6} /></Box>;
  if (isError) return <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>;

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Ward Chart Settings"
        subtitle="How this hospital charts its in-patients — shifts, who signs them off, and units."
        actions={
          <Button variant="contained" startIcon={<SaveRounded />} onClick={() => save.mutate()} disabled={save.isPending} sx={{ textTransform: "none" }}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        }
      />

      {!data?.isConfigured && (
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          These are the <strong>standard defaults</strong>. The ward chart already works exactly as shown —
          change anything here only if your hospital differs.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {/* ── Shifts ─────────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <ScheduleRounded sx={{ color: "text.secondary" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Shifts</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Two, three or four — whatever this hospital runs. A shift may cross midnight.
            </Typography>

            {shifts.map((s, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 1.5, flexWrap: "wrap" }}>
                <TextField size="small" label="Name" value={s.name} onChange={(e) => setShift(i, { name: e.target.value })} sx={{ width: 150 }} />
                <TextField size="small" type="time" label="Starts" value={s.startTime} onChange={(e) => setShift(i, { startTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                <TextField size="small" type="time" label="Ends" value={s.endTime} onChange={(e) => setShift(i, { endTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                <Tooltip title={shifts.length === 1 ? "At least one shift is required" : "Remove this shift"}>
                  <span>
                    <IconButton size="small" disabled={shifts.length === 1}
                      onClick={() => setShifts(shifts.filter((_, j) => j !== i).map((x, j) => ({ ...x, sortOrder: j })))}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}

            <Button size="small" startIcon={<AddRounded />} sx={{ textTransform: "none" }}
              onClick={() => setShifts([...shifts, { chartShiftId: null, name: "", startTime: "08:00", endTime: "14:00", sortOrder: shifts.length }])}>
              Add shift
            </Button>

            <Divider sx={{ my: 2 }} />
            <Alert severity="info" icon={false} sx={{ borderRadius: 2, py: 0.5 }}>
              <Typography variant="body2">
                The chart day runs <strong>{chartDayStart} to {chartDayStart}</strong> — taken from the
                earliest shift, so it always matches. Totals and the day selector follow it.
              </Typography>
            </Alert>
          </Paper>
        </Grid>

        {/* ── Units + sign-off ───────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 5 }} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Temperature</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              What your charts are written in. Readings are always stored with their unit, so changing
              this never reinterprets an existing reading.
            </Typography>
            <TextField select size="small" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} sx={{ width: 180 }}>
              <MenuItem value="F">Fahrenheit (°F)</MenuItem>
              <MenuItem value="C">Celsius (°C)</MenuItem>
            </TextField>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Who signs off a shift</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Each of these gets a signature slot on the handover sheet.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {roles.map((r, i) => (
                <Chip key={i} label={r} onDelete={roles.length > 1 ? () => setRoles(roles.filter((_, j) => j !== i)) : undefined} />
              ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" placeholder="e.g. Paediatrician" value={newRole} onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newRole.trim()) { setRoles([...roles, newRole.trim()]); setNewRole(""); }
                }} sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddRounded />} sx={{ textTransform: "none" }}
                disabled={!newRole.trim()} onClick={() => { setRoles([...roles, newRole.trim()]); setNewRole(""); }}>
                Add
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* ── The hospital's own observations ────────────────────────────── */}
        {/* Saved as you go, not by the button above — each one is its own
            record with readings against it, so it cannot ride on a form save. */}
        <Grid size={12}>
          <ObservationFieldsPanel />
        </Grid>
      </Grid>
    </Box>
  );
}
