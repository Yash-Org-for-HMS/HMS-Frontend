import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField,
  IconButton, Tooltip, MenuItem, Alert, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { MonitorHeartRounded, AddRounded, EditRounded, ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { apiErrorText } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import dayjs from "dayjs";

/**
 * The nursing chart's observation grid.
 *
 * Rows are readings, newest at the bottom, the way the paper chart runs. Every
 * value is optional: a blank cell means the reading was NOT TAKEN and stays
 * blank. It is never shown as 0 — on the reference chart, blood pressure was
 * empty all day, which is correct for a small child.
 *
 * A wrong reading is not edited. Correcting one records a replacement; the
 * original stays on the chart, struck through, exactly as it would on paper.
 */

interface Props {
  open: boolean;
  admission: any;
  onClose: () => void;
  /** Read-only for roles that view the chart but don't record on it. */
  readOnly?: boolean;
}

interface Observation {
  observationId: string;
  observedAt: string;
  temperature: number | null;
  temperatureUnit: string | null;
  pulseRate: number | null;
  respiratoryRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  bloodSugar: number | null;
  painScore: number | null;
  remark: string | null;
  recordedBy: string;
  recordedAt: string;
  correctsId: string | null;
  correctionReason: string | null;
  supersededByObservationId: string | null;
}

const EMPTY = {
  observedAt: "", temperature: "", temperatureUnit: "F", pulseRate: "", respiratoryRate: "",
  bpSystolic: "", bpDiastolic: "", spo2: "", bloodSugar: "", painScore: "", remark: "",
};

/** A blank cell is "not taken" — never a zero, never a dash that looks like data. */
const cell = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "" : `${v}${suffix}`;

export default function ObservationChartDialog({ open, admission, onClose, readOnly = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const admissionId = admission?.admissionId;

  // Day window. The nursing day is a per-hospital setting (it starts at 8am on
  // the reference chart, not midnight) — that lands with the chart profile, so
  // this deliberately uses a plain calendar day for now rather than baking in an
  // assumption that would have to be unpicked from here later.
  const [dayOffset, setDayOffset] = useState(0);
  const day = dayjs().add(dayOffset, "day");
  const from = day.startOf("day").toISOString();
  const to = day.endOf("day").toISOString();

  const [form, setForm] = useState({ ...EMPTY });
  const [correcting, setCorrecting] = useState<Observation | null>(null);
  const [reason, setReason] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-observations", admissionId, from, to],
    queryFn: async () =>
      (await axiosInstance.get(`/ipd/admissions/${admissionId}/observations`, { params: { from, to } })).data.data,
    enabled: open && !!admissionId,
  });

  const observations: Observation[] = data?.observations ?? [];

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const url = correcting
        ? `/ipd/admissions/${admissionId}/observations/${correcting.observationId}/correct`
        : `/ipd/admissions/${admissionId}/observations`;
      return (await axiosInstance.post(url, payload)).data;
    },
    onSuccess: () => {
      toast.success(correcting ? "Correction recorded" : "Reading recorded");
      qc.invalidateQueries({ queryKey: ["ipd-observations", admissionId] });
      closeEntry();
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const closeEntry = () => { setEntryOpen(false); setCorrecting(null); setForm({ ...EMPTY }); setReason(""); };

  const openNew = () => {
    setCorrecting(null);
    setForm({ ...EMPTY, observedAt: dayjs().format("YYYY-MM-DDTHH:mm") });
    setEntryOpen(true);
  };

  const openCorrection = (o: Observation) => {
    setCorrecting(o);
    // Pre-filled with what was recorded, so only the wrong value has to change.
    setForm({
      observedAt: dayjs(o.observedAt).format("YYYY-MM-DDTHH:mm"),
      temperature: o.temperature?.toString() ?? "",
      temperatureUnit: o.temperatureUnit ?? "F",
      pulseRate: o.pulseRate?.toString() ?? "",
      respiratoryRate: o.respiratoryRate?.toString() ?? "",
      bpSystolic: o.bpSystolic?.toString() ?? "",
      bpDiastolic: o.bpDiastolic?.toString() ?? "",
      spo2: o.spo2?.toString() ?? "",
      bloodSugar: o.bloodSugar?.toString() ?? "",
      painScore: o.painScore?.toString() ?? "",
      remark: o.remark ?? "",
    });
    setReason("");
    setEntryOpen(true);
  };

  const submit = () => {
    // Only send what was actually filled in. An empty box must reach the server
    // as absent, not as an empty string it might coerce to 0.
    const payload: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (k === "temperatureUnit") return;
      if (v !== "" && v !== null && v !== undefined) payload[k] = v;
    });
    if (form.temperature !== "") payload.temperatureUnit = form.temperatureUnit;
    if (correcting) payload.correctionReason = reason;
    save.mutate(payload);
  };

  const columns = useMemo(
    () => [
      { key: "time", label: "Time" },
      { key: "temp", label: "Temp" },
      { key: "pulse", label: "Pulse" },
      { key: "resp", label: "Resp" },
      { key: "bp", label: "BP" },
      { key: "spo2", label: "SpO₂" },
      { key: "rbs", label: "RBS" },
      { key: "pain", label: "Pain" },
      { key: "remark", label: "Remark" },
    ],
    [],
  );

  const num = (label: string, key: keyof typeof EMPTY, extra: Record<string, unknown> = {}) => (
    <TextField
      size="small" label={label} value={(form as any)[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      inputProps={{ inputMode: "decimal" }}
      sx={{ width: 128 }}
      {...extra}
    />
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <MonitorHeartRounded sx={{ color: BRAND.action }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Observations — {admission?.patientName}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {admission?.uhid} · {admission?.bed?.label || "—"}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton size="small" onClick={() => setDayOffset((d) => d - 1)}><ChevronLeftRounded /></IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 116, textAlign: "center" }}>
              {dayOffset === 0 ? "Today" : day.format("DD MMM YYYY")}
            </Typography>
            <IconButton size="small" onClick={() => setDayOffset((d) => d + 1)} disabled={dayOffset >= 0}><ChevronRightRounded /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {isLoading ? (
            // TableRowsSkeleton renders <TableRow>s, so it belongs inside a
            // <TableBody> — wrapping it in a Box nests a tr inside a div.
            <Box sx={{ p: 3 }}><ListSkeleton rows={6} /></Box>
          ) : isError ? (
            <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>
          ) : observations.length === 0 ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No observations recorded {dayOffset === 0 ? "today" : `on ${day.format("DD MMM")}`}.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((c) => (
                      <TableCell key={c.key} sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" }}>
                        {c.label}
                      </TableCell>
                    ))}
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", color: "text.secondary" }}>By</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {observations.map((o) => {
                    const dead = !!o.supersededByObservationId;
                    return (
                      <TableRow key={o.observationId} hover
                        sx={{
                          // A superseded reading stays visible and struck through —
                          // the same as a crossed-out line on the paper chart.
                          opacity: dead ? 0.5 : 1,
                          "& td": { textDecoration: dead ? "line-through" : "none" },
                          bgcolor: o.correctsId ? alpha(SEMANTIC.warning, 0.06) : undefined,
                        }}>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{dayjs(o.observedAt).format("HH:mm")}</TableCell>
                        <TableCell>{o.temperature === null ? "" : `${o.temperature}°${o.temperatureUnit ?? ""}`}</TableCell>
                        <TableCell>{cell(o.pulseRate)}</TableCell>
                        <TableCell>{cell(o.respiratoryRate)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{o.bpSystolic === null ? "" : `${o.bpSystolic}/${o.bpDiastolic}`}</TableCell>
                        <TableCell>{cell(o.spo2, "%")}</TableCell>
                        <TableCell>{cell(o.bloodSugar)}</TableCell>
                        <TableCell>{cell(o.painScore)}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>{o.remark || ""}</Typography>
                          {o.correctsId && (
                            <Chip size="small" label={`Correction: ${o.correctionReason}`}
                              sx={{ ml: 0.5, height: 18, fontSize: "0.65rem", bgcolor: alpha(SEMANTIC.warning, 0.15), color: SEMANTIC.warning }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap", fontSize: "0.78rem" }}>{o.recordedBy}</TableCell>
                        <TableCell align="right">
                          {!readOnly && !dead && (
                            <Tooltip title="Correct this reading">
                              <IconButton size="small" onClick={() => openCorrection(o)} sx={{ color: NEUTRAL.muted }}>
                                <EditRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            A blank means the reading was not taken. Readings are never edited — a correction is recorded alongside.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
            {!readOnly && (
              <Button variant="contained" startIcon={<AddRounded />} onClick={openNew} sx={{ textTransform: "none" }}>
                Record reading
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Entry / correction */}
      <Dialog open={entryOpen} onClose={closeEntry} maxWidth="sm" fullWidth>
        <DialogTitle component="div">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {correcting ? "Correct a reading" : "Record a reading"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Fill in only what was measured — leave the rest blank.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {correcting && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              The original reading at <strong>{dayjs(correcting.observedAt).format("HH:mm")}</strong> stays on the
              chart and is shown struck through. This records a replacement beside it.
            </Alert>
          )}

          <TextField
            size="small" type="datetime-local" label="Time taken"
            value={form.observedAt} onChange={(e) => setForm({ ...form, observedAt: e.target.value })}
            InputLabelProps={{ shrink: true }} sx={{ width: 240 }}
          />

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {num("Temperature", "temperature")}
              <TextField
                select size="small" label="Unit" value={form.temperatureUnit}
                onChange={(e) => setForm({ ...form, temperatureUnit: e.target.value })}
                sx={{ width: 84 }}
              >
                <MenuItem value="F">°F</MenuItem>
                <MenuItem value="C">°C</MenuItem>
              </TextField>
            </Box>
            {num("Pulse", "pulseRate")}
            {num("Respiration", "respiratoryRate")}
            {num("BP systolic", "bpSystolic")}
            {num("BP diastolic", "bpDiastolic")}
            {num("SpO₂ %", "spo2")}
            {num("Blood sugar", "bloodSugar")}
            {num("Pain (0-10)", "painScore")}
          </Box>

          <TextField
            size="small" label="Remark" value={form.remark} fullWidth multiline minRows={2}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
          />

          {correcting && (
            <TextField
              size="small" label="Reason for the correction" value={reason} fullWidth required
              onChange={(e) => setReason(e.target.value)}
              helperText="Recorded on the chart beside the replacement."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeEntry} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" onClick={submit}
            disabled={save.isPending || (!!correcting && !reason.trim())}
            sx={{ textTransform: "none" }}
          >
            {save.isPending ? "Saving…" : correcting ? "Record correction" : "Save reading"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
