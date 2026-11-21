import { useState } from "react";
import { NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Chip, Button, Stack, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from "@mui/material";
import { CheckRounded, CloseRounded, PauseRounded, UndoRounded, ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { useAskReason, useConfirm } from "@/providers/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import Mascot from "../Mascot";

const DOSE_META: Record<string, { label: string; color: string; bg: string }> = {
  GIVEN: { label: "Given", color: "#047857", bg: "rgba(16,185,129,0.15)" },
  MISSED: { label: "Missed", color: "#b91c1c", bg: "rgba(239,68,68,0.15)" },
  HELD: { label: "Held", color: NEUTRAL.textSecondary, bg: "rgba(100,116,139,0.15)" },
};

// No fixed dose times: at each round the nurse records the dose as given,
// missed or held, and the chart counts the given ones against the frequency.
type ChartDose = {
  ipMedAdminId: string; status: string; scheduledAt: string; administeredAt?: string | null;
  givenBy?: string | null; notes?: string | null; infusedVolumeMl?: number | null;
};
type MarOrder = {
  ipMedOrderId: string; medicineName?: string | null; dosage?: string | null; route?: string | null;
  status: string; stopped?: boolean; frequency: string | null; carriesFluid?: boolean;
  dosesPerDay?: number | null; courseDoses?: number | null; doses?: ChartDose[];
};
/** When it happened: the time given, or for a dose not given the time it was recorded. */
const doseTime = (d: ChartDose) => dayjs(d.administeredAt ?? d.scheduledAt);
// Timed "due" slots left from before the chart stopped using fixed times are
// not doses - never shown, never counted.
const recorded = (o: MarOrder) => (o.doses || []).filter((d) => d.status !== "PENDING");
const givenCounts = (o: MarOrder, day: dayjs.Dayjs) => {
  const given = recorded(o).filter((d) => d.status === "GIVEN");
  return { total: given.length, onDay: given.filter((d) => doseTime(d).isSame(day, "day")).length };
};

/** readOnly: the doses as charted, without the buttons that chart them (a resident's view). */
export default function MarChart({ admissionId, readOnly = false }: { admissionId: string; readOnly?: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const askReason = useAskReason();
  const [busy, setBusy] = useState<string | null>(null);
  // The chart shows one day - today unless the nurse looks back.
  const [dayKey, setDayKey] = useState(() => dayjs().format("YYYY-MM-DD"));
  const day = dayjs(dayKey);
  const isToday = day.isSame(dayjs(), "day");

  const { data: orders = [], isLoading, refetch } = useQuery<MarOrder[]>({
    queryKey: ["ipd-admission-mar", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/mar`)).data.data,
    enabled: !!admissionId,
  });

  // An IV or NG dose is given IN a volume of fluid, and that volume is part of
  // the patient's intake. Asking for it here - once, where the dose is charted -
  // is what stops the nurse recording the same event again in the fluid chart.
  const [askVolumeFor, setAskVolumeFor] = useState<MarOrder | null>(null);
  const [volume, setVolume] = useState("");
  // Undoing a dose already GIVEN is a correction of the record: it needs a reason.
  const [correcting, setCorrecting] = useState<ChartDose | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");

  const post = async (o: MarOrder, body: Record<string, unknown>) => {
    setBusy(o.ipMedOrderId);
    try {
      await axiosInstance.post(`/ipd/admissions/${admissionId}/mar/unscheduled`, { ipMedOrderId: o.ipMedOrderId, ...body });
      await refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to record the dose"));
    } finally {
      setBusy(null);
    }
  };

  // Given: past the day's or the course's count it asks first - an extra dose
  // may be right, but never by a double tap.
  const give = async (o: MarOrder) => {
    const n = givenCounts(o, dayjs());
    const over = o.dosesPerDay && n.onDay >= o.dosesPerDay
      ? `${n.onDay} of ${o.dosesPerDay} doses for today are already given.`
      : o.courseDoses && n.total >= o.courseDoses ? `All ${o.courseDoses} doses of the course are already given.` : null;
    if (over && !(await confirm({ title: "Record another dose?", message: `${o.medicineName ?? "This medicine"}: ${over} Record one more only if it was really given.`, confirmText: "Record dose" }))) return;
    if (o.carriesFluid) { setVolume(""); setAskVolumeFor(o); } else post(o, { status: "GIVEN" });
  };
  // Missed or held says why (refused, nil by mouth, not available...) - the
  // doctor reading the chart needs it, and the server asks for it.
  const notGiven = async (o: MarOrder, status: "MISSED" | "HELD") => {
    const notes = await askReason({
      title: status === "MISSED" ? "Dose missed" : "Dose held",
      message: `${o.medicineName ?? "This medicine"}: ${status === "MISSED" ? "why was this dose not given?" : "why is this dose being held?"}`,
      label: "Reason",
      confirmText: status === "MISSED" ? "Mark missed" : "Mark held",
    });
    if (notes) post(o, { status, notes });
  };
  const undo = async (adminId: string, correction?: string) => {
    setBusy(adminId);
    try {
      await axiosInstance.post(`/ipd/mar/${adminId}`, { status: "PENDING", ...(correction ? { correctionReason: correction } : {}) });
      await refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to undo the dose"));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Box sx={{ py: 4, textAlign: "center" }}><HeartbeatLoader size={28} /></Box>;

  const canRecord = (o: MarOrder) => !readOnly && isToday && o.status === "ACTIVE" && !o.stopped;
  const onDay = (o: MarOrder) => recorded(o).filter((d) => doseTime(d).isSame(day, "day")).sort((a, b) => doseTime(a).valueOf() - doseTime(b).valueOf());
  // Today: every live medicine, to record against. Another day: what was recorded on it.
  const shown = orders.filter((o) => onDay(o).length > 0 || (isToday && o.status === "ACTIVE" && !o.stopped));

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton size="small" aria-label="Previous day" onClick={() => setDayKey(day.subtract(1, "day").format("YYYY-MM-DD"))}><ChevronLeftRounded /></IconButton>
        <TextField
          type="date" size="small" label="Day" value={dayKey}
          onChange={(e) => e.target.value && setDayKey(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ max: dayjs().format("YYYY-MM-DD") }} sx={{ width: 170 }}
        />
        <IconButton size="small" aria-label="Next day" disabled={isToday} onClick={() => setDayKey(day.add(1, "day").format("YYYY-MM-DD"))}><ChevronRightRounded /></IconButton>
        {!isToday && <Button size="small" onClick={() => setDayKey(dayjs().format("YYYY-MM-DD"))} sx={{ textTransform: "none" }}>Today</Button>}
        <Typography sx={{ ml: "auto", fontSize: "0.75rem", color: "text.secondary" }}>
          {isToday ? "Today" : `${day.format("dddd, DD MMM YYYY")} - read only`}
        </Typography>
      </Box>

      {shown.length === 0 ? (
        <Box sx={{ py: 2 }}>
          <Mascot pose="nothing-here-yet" title={isToday ? "No medicines to chart" : "No doses on this day"}
            subtitle={isToday ? "Medicines show here once the pharmacy gives them." : "Nothing was recorded on this day."} size={100} />
        </Box>
      ) : shown.map((o) => {
        const n = givenCounts(o, day);
        const dayDone = !!o.dosesPerDay && n.onDay >= o.dosesPerDay;
        const courseDone = !!o.courseDoses && n.total >= o.courseDoses;
        const doses = onDay(o);
        const live = canRecord(o);
        return (
          <Box key={o.ipMedOrderId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }} noWrap>{o.medicineName}</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{[o.dosage, o.frequency || "As needed", o.route].filter(Boolean).join(" · ")}</Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: dayDone ? DOSE_META.GIVEN.color : "text.primary" }}>
                  {o.dosesPerDay ? `${n.onDay} / ${o.dosesPerDay}` : n.onDay}{" "}
                  <Box component="span" sx={{ fontWeight: 500, color: "text.secondary", fontSize: "0.75rem" }}>given</Box>
                </Typography>
                {o.courseDoses ? (
                  <Typography sx={{ fontSize: "0.7rem", color: courseDone ? DOSE_META.GIVEN.color : "text.secondary" }}>
                    {courseDone ? "Course complete" : `${n.total} of ${o.courseDoses} in course`}
                  </Typography>
                ) : null}
              </Box>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexShrink: 0 }}>
                {o.stopped && <Chip label="Stopped" size="small" sx={{ fontWeight: 700 }} />}
                {o.status === "BILLED" && <Chip label="Billed" size="small" sx={{ bgcolor: "rgba(8,145,178,0.12)", color: BRAND.action, fontWeight: 700 }} />}
                {live && (
                  <>
                    <Button size="small" variant="outlined" color="success" disabled={busy === o.ipMedOrderId}
                      startIcon={busy === o.ipMedOrderId ? <HeartbeatLoader size={16} /> : <CheckRounded />}
                      onClick={() => give(o)} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
                      Give
                    </Button>
                    <Tooltip title="Missed - not given">
                      <Button size="small" variant="outlined" color="error" aria-label="Missed" disabled={busy === o.ipMedOrderId}
                        onClick={() => notGiven(o, "MISSED")} sx={{ minWidth: 0, px: 1 }}>
                        <CloseRounded fontSize="small" />
                      </Button>
                    </Tooltip>
                    <Tooltip title="Held - kept back on purpose">
                      <Button size="small" variant="outlined" aria-label="Held" disabled={busy === o.ipMedOrderId}
                        onClick={() => notGiven(o, "HELD")} sx={{ minWidth: 0, px: 1, borderColor: "divider", color: "text.secondary" }}>
                        <PauseRounded fontSize="small" />
                      </Button>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>
            <Box sx={{ px: 2, py: 1, borderTop: "1px dashed", borderColor: "divider", display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              {doses.length === 0 ? (
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Nothing recorded {isToday ? "today" : "on this day"}.</Typography>
              ) : doses.map((d) => {
                const m = DOSE_META[d.status] ?? DOSE_META.GIVEN;
                const tip = [m.label, d.givenBy ? `by ${d.givenBy}` : null, d.infusedVolumeMl ? `${d.infusedVolumeMl} ml` : null, d.notes].filter(Boolean).join(" · ");
                const canUndo = live;
                return (
                  <Tooltip key={d.ipMedAdminId} title={tip}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: canUndo ? 0.25 : 1, py: 0.25, borderRadius: 5, bgcolor: m.bg, color: m.color, fontSize: "0.75rem", fontWeight: 600 }}>
                      {d.status === "GIVEN" ? <CheckRounded sx={{ fontSize: 14 }} /> : d.status === "MISSED" ? <CloseRounded sx={{ fontSize: 14 }} /> : <PauseRounded sx={{ fontSize: 14 }} />}
                      {doseTime(d).format("HH:mm")}
                      {d.status !== "GIVEN" && <span>{m.label.toLowerCase()}</span>}
                      {d.givenBy && <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>{d.givenBy.split(" ")[0]}</Box>}
                      {canUndo && (
                        <IconButton size="small" aria-label="Undo" disabled={busy === d.ipMedAdminId}
                          onClick={() => (d.status === "GIVEN" ? (setCorrectionReason(""), setCorrecting(d)) : undo(d.ipMedAdminId))}
                          sx={{ p: 0.25, color: "text.secondary" }}>
                          <UndoRounded sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        );
      })}

      {/* Asked once, where the dose is charted. Leaving it blank still records
          the dose - a nurse who does not know the volume must not be blocked
          from charting that the medicine was given. */}
      <Dialog open={!!askVolumeFor} onClose={() => setAskVolumeFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Fluid given with this dose</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {askVolumeFor?.medicineName} · {askVolumeFor?.route}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus size="small" fullWidth label="Volume (ml)" value={volume}
            onChange={(e) => setVolume(e.target.value)}
            inputProps={{ inputMode: "numeric" }}
            helperText="Counts towards the patient's fluid intake. Leave blank if not known."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAskVolumeFor(null)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" sx={{ textTransform: "none" }}
            onClick={() => {
              const o = askVolumeFor;
              setAskVolumeFor(null);
              if (o) post(o, { status: "GIVEN", ...(volume.trim() ? { infusedVolumeMl: volume.trim() } : {}) });
            }}
          >
            Record as given
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!correcting} onClose={() => setCorrecting(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Correct a dose recorded as given</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {correcting ? `Given ${doseTime(correcting).format("DD MMM, HH:mm")}` : ""}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus size="small" fullWidth required label="Reason for the correction" value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="e.g. Charted against the wrong patient"
            helperText="The original entry is kept in the record with this reason."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCorrecting(null)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" color="warning" sx={{ textTransform: "none" }}
            disabled={correctionReason.trim().length < 3}
            onClick={() => {
              const dose = correcting;
              setCorrecting(null);
              if (dose) undo(dose.ipMedAdminId, correctionReason.trim());
            }}
          >
            Undo with reason
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
