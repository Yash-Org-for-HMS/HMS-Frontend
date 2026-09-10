import { useState } from "react";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Menu, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack,
  FormControlLabel, Switch,
} from "@mui/material";
import {
  EventSeatRounded, BuildRounded, CheckCircleRounded,
  PersonRounded, ApartmentRounded, MedicalServicesRounded, MeetingRoomRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: SEMANTIC.success, OCCUPIED: SEMANTIC.danger, RESERVED: SEMANTIC.warning, MAINTENANCE: NEUTRAL.muted,
};

// A bed as the board sees it. `location` is where the patient actually is —
// a held bed keeps its occupant while they are away in theatre.
type BoardOccupant = {
  admissionId: string;
  patientName: string;
  uhid: string;
  location?: string | null;
  theatreName?: string | null;
};
type BoardBed = {
  bedId: string;
  bedNumber: string;
  bedType: string;
  status: string;
  occupant?: BoardOccupant | null;
};
type PickTheatre = { operatingTheatreId: string; theatreName: string; status: string };
type PickBed = { bedId: string; bedNumber: string; label?: string };

/** Where the occupant is, when it isn't this bed. Empty string when it is. */
function awayText(o?: BoardOccupant | null): string {
  if (!o?.location || o.location === "BED") return "";
  if (o.location === "OT") return `In ${o.theatreName || "theatre"}`;
  if (o.location === "RECOVERY") return "In recovery";
  return "In pre-op";
}

// Read-only structure + day-to-day bed STATUS changes only. Adding/editing
// wards, rooms, and beds is hospital configuration, managed from the Hospital
// Admin panel (Ward & Bed Setup) — not from Reception.
// `readOnly` renders a pure oversight view (hospital-admin Operations): bed
// tiles still show live occupancy but are not clickable, so the admin can read
// the ward census without opening the status-change menu (available / reserved /
// maintenance). Defaults keep the IPD panel interactive.
const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
    <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

export default function BedBoard({ readOnly = false }: { readOnly?: boolean } = {}) {
  const toast = useToast();
  const [bedMenu, setBedMenu] = useState<{ anchor: HTMLElement | null; bed: BoardBed | null }>({ anchor: null, bed: null });
  const [moveDialog, setMoveDialog] = useState<{ mode: "send" | "return"; bed: BoardBed | null } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-structure"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
  });
  const summary = data?.summary;
  const wards: any[] = data?.wards || [];

  const setBedStatus = async (bedId: string, status: string) => {
    setBedMenu({ anchor: null, bed: null });
    try {
      await axiosInstance.put(`/ipd/beds/${bedId}/status`, { status });
      toast.success(`Bed marked ${status.toLowerCase()}`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update bed"));
    }
  };


  return (
    <Box>
      <PageHeader
        title="Bed Management"
        subtitle="Ward occupancy, bed availability, and reservations. To add or edit wards, rooms, or beds, contact your hospital administrator."
      />

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Total beds" value={summary.totalBeds} color={BRAND.action} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Available" value={summary.available} color={STATUS_COLOR.AVAILABLE} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Occupied" value={summary.occupied} color={STATUS_COLOR.OCCUPIED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Reserved" value={summary.reserved} color={STATUS_COLOR.RESERVED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Maintenance" value={summary.maintenance} color={STATUS_COLOR.MAINTENANCE} /></Grid>
        </Grid>
      )}

      {isLoading ? <ListSkeleton />
        : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        : wards.length === 0 ? <Mascot pose="all-caught-up" title="No wards yet" subtitle="Ask your hospital administrator to set up wards, rooms, and beds." />
        : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {wards.map((w) => (
              <Paper key={w.wardId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <ApartmentRounded sx={{ color: BRAND.action }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  <Chip label={w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Floor {w.floorNumber}</Typography>
                </Box>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: any) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Room {r.roomNumber} · {r.roomType}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: BoardBed) => {
                        const color = STATUS_COLOR[b.status] || NEUTRAL.muted;
                        return (
                          // The tile is 130px wide, so a theatre called
                          // "Cardiac Theatre 2" clips. The tooltip is where
                          // the full name has to be readable.
                          <Tooltip key={b.bedId} title={b.occupant ? `${b.occupant.patientName} (${b.occupant.uhid})${awayText(b.occupant) ? ` — ${awayText(b.occupant)}` : ""}` : b.status}>
                            <Box onClick={readOnly ? undefined : (e) => setBedMenu({ anchor: e.currentTarget, bed: b })}
                              sx={{ cursor: readOnly ? "default" : "pointer", width: 130, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: `${color}55`, bgcolor: `${color}12`, ...(readOnly ? {} : { "&:hover": { borderColor: color } }) }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>Bed {b.bedNumber}</Typography>
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{b.bedType}</Typography>
                              {b.occupant ? (
                                <>
                                  <Typography variant="caption" sx={{ color, fontWeight: 600, display: "flex", alignItems: "center", gap: 0.3 }} noWrap><PersonRounded sx={{ fontSize: 12 }} /> {b.occupant.patientName}</Typography>
                                  {/* A patient in theatre is still admitted to this bed, and is not
                                      in it. Saying so is the whole point of the movement work —
                                      a nurse looking for them should not be sent to an empty bed. */}
                                  {awayText(b.occupant) && (
                                    <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.3 }} noWrap>
                                      <MedicalServicesRounded sx={{ fontSize: 12 }} />
                                      {awayText(b.occupant)}
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography variant="caption" sx={{ color, fontWeight: 700, textTransform: "capitalize" }}>{b.status.toLowerCase()}</Typography>
                              )}
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Paper>
            ))}
          </Box>
        )}

      {/* Bed status menu */}
      <Menu anchorEl={bedMenu.anchor} open={Boolean(bedMenu.anchor)} onClose={() => setBedMenu({ anchor: null, bed: null })}>
        {bedMenu.bed?.status === "OCCUPIED"
          ? (awayText(bedMenu.bed?.occupant)
            ? [
                <MenuItem key="back" onClick={() => setMoveDialog({ mode: "return", bed: bedMenu.bed })}>
                  <MeetingRoomRounded fontSize="small" sx={{ mr: 1, color: SEMANTIC.success }} /> Bring back from theatre
                </MenuItem>,
              ]
            : [
                <MenuItem key="ot" onClick={() => setMoveDialog({ mode: "send", bed: bedMenu.bed })}>
                  <MedicalServicesRounded fontSize="small" sx={{ mr: 1, color: SEMANTIC.warning }} /> Send to theatre
                </MenuItem>,
              ])
          : [
            <MenuItem key="a" disabled={bedMenu.bed?.status === "AVAILABLE"} onClick={() => bedMenu.bed && setBedStatus(bedMenu.bed.bedId, "AVAILABLE")}><CheckCircleRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.AVAILABLE }} /> Mark available</MenuItem>,
            <MenuItem key="r" disabled={bedMenu.bed?.status === "RESERVED"} onClick={() => bedMenu.bed && setBedStatus(bedMenu.bed.bedId, "RESERVED")}><EventSeatRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.RESERVED }} /> Reserve</MenuItem>,
            <MenuItem key="m" disabled={bedMenu.bed?.status === "MAINTENANCE"} onClick={() => bedMenu.bed && setBedStatus(bedMenu.bed.bedId, "MAINTENANCE")}><BuildRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.MAINTENANCE }} /> Maintenance</MenuItem>,
          ]}
      </Menu>

      {moveDialog && (
        <TheatreMoveDialog
          mode={moveDialog.mode}
          bed={moveDialog.bed}
          onClose={() => { setMoveDialog(null); setBedMenu({ anchor: null, bed: null }); }}
          onDone={() => { setMoveDialog(null); setBedMenu({ anchor: null, bed: null }); refetch(); }}
        />
      )}
    </Box>
  );
}

/**
 * Moving a patient to theatre, or bringing them back.
 *
 * Send asks which theatre, and whether to keep the bed. Held is the default and
 * the safe one: release it and the patient can come out of theatre to find
 * somebody else in it, which is the argument the ward has at six o'clock.
 *
 * Return asks where they are going — back to the bed being held, a different
 * bed, or recovery — because a post-operative patient often does not go back
 * to the ward they came from.
 */
function TheatreMoveDialog({ mode, bed, onClose, onDone }: { mode: "send" | "return"; bed: BoardBed | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [theatreId, setTheatreId] = useState("");
  const [releaseBed, setReleaseBed] = useState(false);
  const [reason, setReason] = useState("");
  const admissionId = bed?.occupant?.admissionId;
  // A patient shown on a bed tile while away in theatre is holding that bed,
  // so it is the obvious place to bring them back to — and it is not in the
  // free-bed list, since it is still marked occupied for them.
  const heldBedId = mode === "return" && bed?.bedId ? bed.bedId : "";
  const [toBedId, setToBedId] = useState(heldBedId);

  const { data: theatres } = useQuery({
    queryKey: ["ot-theatres-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/theatres")).data.data,
    enabled: mode === "send",
  });
  const { data: freeBeds } = useQuery({
    queryKey: ["free-beds-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
    enabled: mode === "return",
  });

  const go = useMutation({
    mutationFn: async () =>
      mode === "send"
        ? axiosInstance.post(`/ipd/admissions/${admissionId}/send-to-theatre`, { theatreId, releaseBed, reason: reason.trim() || undefined })
        : axiosInstance.post(`/ipd/admissions/${admissionId}/return-from-theatre`, { toBedId: toBedId || undefined, reason: reason.trim() || undefined }),
    onSuccess: () => { toast.success(mode === "send" ? "Patient sent to theatre" : "Patient back from theatre"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not move the patient")),
  });

  const available: PickTheatre[] = (theatres?.theatres ?? []).filter((t: PickTheatre) => t.status === "AVAILABLE");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {mode === "send" ? "Send to theatre" : "Bring back from theatre"}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {bed?.occupant?.patientName} · {bed?.occupant?.uhid} · Bed {bed?.bedNumber}
          {awayText(bed?.occupant) ? ` · ${awayText(bed?.occupant)}` : ""}
        </Typography>
        <Stack spacing={2}>
          {mode === "send" ? (
            <>
              <TextField select label="Theatre" required fullWidth value={theatreId} onChange={(e) => setTheatreId(e.target.value)}
                helperText={available.length ? "Only theatres that are free right now" : "No theatre is free — one may be in use, being cleaned, or under maintenance"}>
                {available.map((t) => (
                  <MenuItem key={t.operatingTheatreId} value={t.operatingTheatreId}>{t.theatreName}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch checked={!releaseBed} onChange={(e) => setReleaseBed(!e.target.checked)} />}
                label={releaseBed
                  ? "Bed will be released — they will need a new one on the way back"
                  : "Keep this bed for them"}
              />
            </>
          ) : (
            <TextField select label="Where to" fullWidth value={toBedId} onChange={(e) => setToBedId(e.target.value)}
              helperText={heldBedId
                ? `Bed ${bed?.bedNumber} is being held for them either way — recovery just records that they are not in it yet`
                : "No bed is being held — pick one, or send them to recovery"}>
              {heldBedId && (
                <MenuItem value={heldBedId}>Back to bed {bed?.bedNumber} (held for them)</MenuItem>
              )}
              <MenuItem value=""><em>Recovery</em></MenuItem>
              {(freeBeds ?? []).map((b: PickBed) => (
                <MenuItem key={b.bedId} value={b.bedId}>{b.label || b.bedNumber}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField label="Reason (optional)" fullWidth value={reason} onChange={(e) => setReason(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" sx={{ textTransform: "none" }}
          disabled={go.isPending || (mode === "send" && !theatreId)}
          onClick={() => go.mutate()}>
          {go.isPending ? "Moving…" : mode === "send" ? "Send to theatre" : "Bring back"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
