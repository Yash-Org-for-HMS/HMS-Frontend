import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField,
  IconButton, Tooltip, MenuItem, Alert, Chip, Divider, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { WaterDropRounded, AddRounded, EditRounded, ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { apiErrorText } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import dayjs from "dayjs";

/**
 * Fluid balance — intake and output for the chart day.
 *
 * Totals come from the server, computed, and are shown WITH THEIR WORKING the
 * way the paper does ("DNS 800 + RTB 76 = 876"). Nothing here is typed as a
 * running total, because a total kept by hand is a total that goes wrong.
 *
 * An entry can be a volume, a number of times, or both — a nappy counted four
 * times is a real observation, and forcing a millilitre figure onto it would
 * only make someone invent a number.
 */

interface Props { open: boolean; admission: any; onClose: () => void; readOnly?: boolean }

const TYPE_LABELS: Record<string, string> = {
  oral: "Oral", iv: "IV", tube: "Tube / RT", blood: "Blood", other: "Other",
  urine: "Urine", vomit: "Vomit", aspirate: "Aspirate", stool: "Stool", drain: "Drain",
};
const label = (t: string) => TYPE_LABELS[t] ?? t;

const EMPTY = { occurredAt: "", direction: "IN", fluidType: "iv", label: "", volumeMl: "", occurrences: "", notes: "" };

const ml = (n: number) => `${n.toLocaleString("en-IN")} ml`;

export default function FluidBalanceDialog({ open, admission, onClose, readOnly = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const admissionId = admission?.admissionId;

  const { data: profile } = useQuery({
    queryKey: ["ward-chart-profile"],
    queryFn: async () => (await axiosInstance.get("/ipd/chart-profile")).data.data,
    staleTime: 5 * 60_000,
  });
  const chartDayStart: string = profile?.chartDayStart ?? "08:00";
  const [startH, startM] = chartDayStart.split(":").map(Number);

  const [dayOffset, setDayOffset] = useState(0);
  const anchor = dayjs().hour(startH).minute(startM).second(0).millisecond(0);
  const dayStart = (dayjs().isBefore(anchor) ? anchor.subtract(1, "day") : anchor).add(dayOffset, "day");
  const from = dayStart.toISOString();
  const to = dayStart.add(1, "day").subtract(1, "millisecond").toISOString();

  const [form, setForm] = useState({ ...EMPTY });
  const [correcting, setCorrecting] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-fluid-balance", admissionId, from, to],
    queryFn: async () =>
      (await axiosInstance.get(`/ipd/admissions/${admissionId}/fluid-balance`, { params: { from, to } })).data.data,
    enabled: open && !!admissionId,
  });

  const entries: any[] = data?.entries ?? [];
  const totals = data?.totals;
  const breakdown: any[] = data?.breakdown ?? [];
  const options = data?.options ?? { in: [], out: [] };

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const url = correcting
        ? `/ipd/admissions/${admissionId}/fluid-balance/${correcting.fluidEntryId}/correct`
        : `/ipd/admissions/${admissionId}/fluid-balance`;
      return (await axiosInstance.post(url, payload)).data;
    },
    onSuccess: () => {
      toast.success(correcting ? "Correction recorded" : "Entry recorded");
      qc.invalidateQueries({ queryKey: ["ipd-fluid-balance", admissionId] });
      closeEntry();
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const closeEntry = () => { setEntryOpen(false); setCorrecting(null); setForm({ ...EMPTY }); setReason(""); };

  const openNew = () => {
    setCorrecting(null);
    setForm({ ...EMPTY, occurredAt: dayjs().format("YYYY-MM-DDTHH:mm") });
    setEntryOpen(true);
  };

  const openCorrection = (e: any) => {
    setCorrecting(e);
    setForm({
      occurredAt: dayjs(e.occurredAt).format("YYYY-MM-DDTHH:mm"),
      direction: e.direction, fluidType: e.fluidType, label: e.label ?? "",
      volumeMl: e.volumeMl?.toString() ?? "", occurrences: e.occurrences?.toString() ?? "", notes: e.notes ?? "",
    });
    setReason("");
    setEntryOpen(true);
  };

  const submit = () => {
    const payload: Record<string, unknown> = {
      direction: form.direction, fluidType: form.fluidType, occurredAt: form.occurredAt,
    };
    if (form.label.trim()) payload.label = form.label.trim();
    if (form.volumeMl !== "") payload.volumeMl = form.volumeMl;
    if (form.occurrences !== "") payload.occurrences = form.occurrences;
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (correcting) payload.correctionReason = reason;
    save.mutate(payload);
  };

  const typeOptions: string[] = form.direction === "IN" ? options.in : options.out;

  const Total = ({ title, value, tone }: { title: string; value: string; tone?: string }) => (
    <Box sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: alpha(tone ?? NEUTRAL.muted, 0.08), minWidth: 132 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{title}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: tone ?? "text.primary", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <WaterDropRounded sx={{ color: BRAND.action }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Fluid balance — {admission?.patientName}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {admission?.uhid} · chart day {chartDayStart}–{chartDayStart}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton size="small" onClick={() => setDayOffset((d) => d - 1)}><ChevronLeftRounded /></IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 100, textAlign: "center" }}>
              {dayOffset === 0 ? "Today" : dayStart.format("DD MMM")}
            </Typography>
            <IconButton size="small" onClick={() => setDayOffset((d) => d + 1)} disabled={dayOffset >= 0}><ChevronRightRounded /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ p: 3 }}><ListSkeleton rows={6} /></Box>
          ) : isError ? (
            <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>
          ) : (
            <>
              {/* Totals, computed server-side, with the working spelled out under
                  them so a nurse can check them against the paper. */}
              <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: breakdown.length ? 1.5 : 0 }}>
                  <Total title="Total intake" value={ml(totals?.intakeMl ?? 0)} tone={SEMANTIC.info} />
                  <Total title="Total output" value={ml(totals?.outputMl ?? 0)} tone={SEMANTIC.warning} />
                  <Total title="Balance today" value={ml(totals?.balanceMl ?? 0)} tone={(totals?.balanceMl ?? 0) < 0 ? SEMANTIC.danger : SEMANTIC.success} />
                  <Total title="Carried forward" value={ml(totals?.previousBalanceMl ?? 0)} />
                  <Total title="Running balance" value={ml(totals?.runningBalanceMl ?? 0)} tone={BRAND.action} />
                  {data?.weights?.today != null && (
                    <Total title="Weight today" value={`${data.weights.today} kg`} />
                  )}
                </Box>
                {breakdown.length > 0 && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {["IN", "OUT"].map((dir) => {
                      const parts = breakdown.filter((b) => b.direction === dir);
                      if (!parts.length) return null;
                      const sum = parts.reduce((s, b) => s + b.volumeMl, 0);
                      return (
                        <Box component="span" key={dir} sx={{ display: "block" }}>
                          <strong>{dir === "IN" ? "In" : "Out"}:</strong>{" "}
                          {parts.map((b) => `${b.label || label(b.fluidType)} ${b.volumeMl ? `${b.volumeMl}` : ""}${b.occurrences ? ` ×${b.occurrences}` : ""}`).join(" + ")}
                          {parts.some((b) => b.volumeMl) ? ` = ${sum} ml` : ""}
                        </Box>
                      );
                    })}
                  </Typography>
                )}
                {data?.weights?.previous != null && data?.weights?.today != null && (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                    Previous weight {data.weights.previous} kg → today {data.weights.today} kg
                  </Typography>
                )}
              </Box>

              {entries.length === 0 ? (
                <Box sx={{ p: 5, textAlign: "center" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nothing recorded {dayOffset === 0 ? "today" : `on ${dayStart.format("DD MMM")}`}.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {["Time", "", "Type", "What", "Volume", "Times", "By"].map((h, i) => (
                          <TableCell key={i} sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                        ))}
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entries.map((e) => {
                        const dead = !!e.supersededByEntryId;
                        const isIn = e.direction === "IN";
                        return (
                          <TableRow key={e.fluidEntryId} hover
                            sx={{
                              opacity: dead ? 0.5 : 1,
                              "& td": { textDecoration: dead ? "line-through" : "none" },
                              bgcolor: e.correctsId ? alpha(SEMANTIC.warning, 0.06) : undefined,
                            }}>
                            <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{dayjs(e.occurredAt).format("HH:mm")}</TableCell>
                            <TableCell>
                              <Chip size="small" label={isIn ? "In" : "Out"}
                                sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(isIn ? SEMANTIC.info : SEMANTIC.warning, 0.14), color: isIn ? SEMANTIC.info : SEMANTIC.warning }} />
                            </TableCell>
                            <TableCell>{label(e.fluidType)}</TableCell>
                            <TableCell sx={{ maxWidth: 200 }}>
                              <Typography variant="body2">{e.label || ""}</Typography>
                              {e.correctsId && (
                                <Typography variant="caption" sx={{ color: SEMANTIC.warning }}>Correction: {e.correctionReason}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{e.volumeMl != null ? `${e.volumeMl} ml` : ""}</TableCell>
                            <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{e.occurrences != null ? `×${e.occurrences}` : ""}</TableCell>
                            <TableCell sx={{ color: "text.secondary", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{e.recordedBy}</TableCell>
                            <TableCell align="right">
                              {!readOnly && !dead && (
                                <Tooltip title="Correct this entry">
                                  <IconButton size="small" onClick={() => openCorrection(e)} sx={{ color: NEUTRAL.muted }}>
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
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Totals are calculated, never typed. Entries are never edited — a correction is recorded alongside.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
            {!readOnly && (
              <Button variant="contained" startIcon={<AddRounded />} onClick={openNew} sx={{ textTransform: "none" }}>
                Record entry
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={entryOpen} onClose={closeEntry} maxWidth="sm" fullWidth>
        <DialogTitle component="div">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{correcting ? "Correct an entry" : "Record intake or output"}</Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {correcting && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              The original entry stays on the chart, struck through. This records a replacement — the
              totals will follow the new value.
            </Alert>
          )}

          <ToggleButtonGroup
            exclusive size="small" value={form.direction}
            onChange={(_, v) => v && setForm({ ...form, direction: v, fluidType: v === "IN" ? "iv" : "urine" })}
          >
            <ToggleButton value="IN" sx={{ textTransform: "none", px: 3 }}>Intake</ToggleButton>
            <ToggleButton value="OUT" sx={{ textTransform: "none", px: 3 }}>Output</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField size="small" type="datetime-local" label="Time" value={form.occurredAt}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 220 }} />
            <TextField select size="small" label="Type" value={form.fluidType}
              onChange={(e) => setForm({ ...form, fluidType: e.target.value })} sx={{ width: 150 }}>
              {typeOptions.map((t) => <MenuItem key={t} value={t}>{label(t)}</MenuItem>)}
            </TextField>
          </Box>

          <TextField size="small" label="What was it?" placeholder="e.g. DNS drip, RT feed, Inj CEF"
            value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} fullWidth
            helperText="Named on the chart so a total can be checked against its parts." />

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField size="small" label="Volume (ml)" value={form.volumeMl}
              onChange={(e) => setForm({ ...form, volumeMl: e.target.value })} inputProps={{ inputMode: "numeric" }} sx={{ width: 160 }} />
            <TextField size="small" label="Number of times" value={form.occurrences}
              onChange={(e) => setForm({ ...form, occurrences: e.target.value })} inputProps={{ inputMode: "numeric" }} sx={{ width: 160 }} />
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", mt: -1 }}>
            One or both. If a volume wasn't measured, record how many times instead — don't estimate.
          </Typography>

          <TextField size="small" label="Notes" value={form.notes} fullWidth
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          {correcting && (
            <TextField size="small" label="Reason for the correction" value={reason} fullWidth required
              onChange={(e) => setReason(e.target.value)} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeEntry} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={submit}
            disabled={save.isPending || (!!correcting && !reason.trim())} sx={{ textTransform: "none" }}>
            {save.isPending ? "Saving…" : correcting ? "Record correction" : "Save entry"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
