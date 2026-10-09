import { useState } from "react";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Chip, Menu, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack,
  FormControlLabel, Switch,
} from "@mui/material";
import {
  EventSeatRounded, BuildRounded, CheckCircleRounded, BlockRounded, CleaningServicesRounded, CoronavirusRounded, PowerSettingsNewRounded,
  PersonRounded, ApartmentRounded, MedicalServicesRounded, MeetingRoomRounded, HistoryRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import PatientHistoryButton, { PatientHistoryDialog } from "@/components/clinical/PatientHistoryButton";
import { usePanelBase } from "./panelBase";

/**
 * Fallback colours for before the status list has loaded. The real ones come
 * from the platform's bed-status master (workbook 06 bed_board_colour), sent
 * with the board, so every hospital's board reads the same.
 */
const FALLBACK_COLOR: Record<string, string> = {
  AVAILABLE: "#C8E6C9", RESERVED: "#FFF59D", OCCUPIED: "#EF9A9A", DISCHARGE_INITIATED: "#FFCC80",
  VACATED: "#B0BEC5", CLEANING: "#90CAF9", TERMINAL_CLEAN: "#CE93D8", MAINTENANCE: "#BCAAA4", BLOCKED: "#9E9E9E", INACTIVE: "#616161",
};
type StatusDef = { code: string; name: string; colorHex: string; allowedNext: string[]; isOccupied: boolean; meaning: string };
const OCCUPIED = ["OCCUPIED", "DISCHARGE_INITIATED"];
const TO_CLEAN = ["VACATED", "CLEANING", "TERMINAL_CLEAN"];
/** The hands-on moves, worded for the state a bed is leaving. */
const MOVE_LABEL = (from: string, to: string): string => {
  if (to === "AVAILABLE") return TO_CLEAN.includes(from) ? "Cleaned — make available" : from === "RESERVED" ? "Release reservation" : from === "BLOCKED" ? "Unblock" : "Back in use";
  return ({ RESERVED: "Reserve…", BLOCKED: "Block…", MAINTENANCE: "Under maintenance", INACTIVE: "Decommission", CLEANING: "Start cleaning", TERMINAL_CLEAN: "Terminal clean (after an infectious patient)" } as Record<string, string>)[to] ?? to;
};
const MOVE_ICON: Record<string, typeof CheckCircleRounded> = {
  AVAILABLE: CheckCircleRounded, RESERVED: EventSeatRounded, BLOCKED: BlockRounded, MAINTENANCE: BuildRounded,
  INACTIVE: PowerSettingsNewRounded, CLEANING: CleaningServicesRounded, TERMINAL_CLEAN: CoronavirusRounded,
};
const MANUAL = ["AVAILABLE", "RESERVED", "BLOCKED", "MAINTENANCE", "INACTIVE", "CLEANING", "TERMINAL_CLEAN"];

// A bed as the board sees it. `location` is where the patient actually is —
// a held bed keeps its occupant while they are away in theatre.
type BoardOccupant = {
  admissionId: string;
  patientId?: string | null;
  patientName: string;
  uhid: string;
  location?: string | null;
  theatreName?: string | null;
};
type BoardBed = {
  bedId: string;
  bedNumber: string;
  bedType: string;
  /** The hospital's name for the bed type, and the bed's code. */
  bedTypeName?: string | null;
  bedCode?: string | null;
  status: string;
  occupant?: BoardOccupant | null;
  reservedUntil?: string | null;
  statusReason?: string | null;
};
type PickTheatre = { operatingTheatreId: string; theatreName: string; status: string };
type PickBed = { bedId: string; bedNumber: string; label?: string };
type BedlessPatient = {
  admissionId: string;
  admissionNumber: string;
  patientId?: string | null;
  patientName: string;
  uhid: string;
  location: string;
  theatreName: string | null;
};

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

/** Housekeeping turns beds round: from vacated / being cleaned, to cleaning or cleaned. */
const HOUSEKEEPING_FROM = ["VACATED", "CLEANING", "TERMINAL_CLEAN"];
const HOUSEKEEPING_TO = ["CLEANING", "TERMINAL_CLEAN", "AVAILABLE"];

export default function BedBoard({ readOnly = false, housekeeping = false }: { readOnly?: boolean; housekeeping?: boolean } = {}) {
  const toast = useToast();
  const [bedMenu, setBedMenu] = useState<{ anchor: HTMLElement | null; bed: BoardBed | null }>({ anchor: null, bed: null });
  // Held by the board, not by the menu: closing a Menu unmounts its children,
  // and a dialog rendered inside it would go with it before it painted.
  const [historyFor, setHistoryFor] = useState<BoardOccupant | BedlessPatient | null>(null);
  const basePath = usePanelBase();
  const [moveDialog, setMoveDialog] = useState<{ mode: "send" | "return"; bed: BoardBed | null } | null>(null);
  const [placing, setPlacing] = useState<BedlessPatient | null>(null);
  /** Reserve and block ask one more thing first — for how long, and why. */
  const [asking, setAsking] = useState<{ bed: BoardBed; status: "RESERVED" | "BLOCKED" } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-structure"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
  });
  const summary = data?.summary;
  // Several branches at once ("All branches"): grouped by branch, each ward named with its branch.
  const wards: any[] = [...(data?.wards || [])].sort((a, b) => (a.branchName ?? "").localeCompare(b.branchName ?? ""));
  const statuses: StatusDef[] = data?.statuses ?? [];
  const statusOf = (code: string) => statuses.find((x) => x.code === code);
  const colorOf = (code: string) => statusOf(code)?.colorHex ?? FALLBACK_COLOR[code] ?? "#9E9E9E";
  const nameOf = (code: string) => statusOf(code)?.name ?? code.toLowerCase();
  /** The moves the status master allows from here, that are made by hand. */
  const movesFrom = (code: string) => {
    const next = (statusOf(code)?.allowedNext ?? []).filter((c) => MANUAL.includes(c));
    // A vacated bed is cleaned and released in one tap (the API records both steps).
    const all = code === "VACATED" ? ["AVAILABLE", ...next] : next;
    // Housekeeping (15_System_Roles) only turns beds round — the API holds it to the same.
    return housekeeping ? (HOUSEKEEPING_FROM.includes(code) ? all.filter((c) => HOUSEKEEPING_TO.includes(c)) : []) : all;
  };
  /** Admitted with no bed — invisible on this board without their own strip. */
  const awaitingBed = (data?.awaitingBed ?? []) as BedlessPatient[];

  const setBedStatus = async (bedId: string, status: string, extra: Record<string, unknown> = {}) => {
    setBedMenu({ anchor: null, bed: null });
    try {
      await axiosInstance.put(`/ipd/beds/${bedId}/status`, { status, ...extra });
      toast.success(`Bed ${nameOf(status).toLowerCase()}`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update bed"));
    }
  };


  return (
    <Box>
      <PageHeader
        title={housekeeping ? "Beds to turn round" : "Bed Management"}
        subtitle={housekeeping
          ? "Tap a vacated or cleaning bed to mark it as being cleaned or cleaned. Other beds are shown so you can find your way round the ward."
          : "Ward occupancy, bed availability, and reservations. To add or edit wards, rooms, or beds, contact your hospital administrator."}
      />

      {summary && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", lg: "repeat(7, 1fr)" }, gap: 2, mb: 2 }}>
          <Tile label="Total beds" value={summary.totalBeds} color={BRAND.action} />
          <Tile label="Available" value={summary.available} color={SEMANTIC.success} />
          <Tile label="Occupied" value={summary.occupied} color={SEMANTIC.danger} />
          <Tile label="Discharge started" value={summary.dischargeInitiated ?? 0} color={SEMANTIC.warning} />
          <Tile label="Awaiting cleaning" value={summary.awaitingCleaning ?? 0} color={BRAND.action} />
          <Tile label="Reserved" value={summary.reserved} color={SEMANTIC.warning} />
          <Tile label="Blocked / maintenance" value={(summary.blocked ?? 0) + summary.maintenance} color={NEUTRAL.muted} />
        </Box>
      )}

      {/* The key to the colours below — the platform's bed statuses (workbook 06). */}
      {statuses.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 3 }}>
          {statuses.map((st) => (
            <Tooltip key={st.code} title={st.meaning}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: st.colorHex, border: "1px solid rgba(0,0,0,0.15)" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{st.name}</Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}

      {/* Admitted, but in no bed at all — most often just out of theatre with
          the bed released on the way in. This board draws patients through
          beds, so without this strip they appear nowhere on it: no bed, the
          theatre already freed, and a nurse looking for them has nothing to
          look at. They are the first thing on the screen because somebody has
          to find them a bed. */}
      {!housekeeping && awaitingBed.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: "2px solid", borderColor: SEMANTIC.warning, bgcolor: `${SEMANTIC.warning}0a` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <MeetingRoomRounded sx={{ color: SEMANTIC.warning }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {awaitingBed.length} patient{awaitingBed.length === 1 ? "" : "s"} with no bed
            </Typography>
          </Box>
          <Stack spacing={1}>
            {awaitingBed.map((a) => (
              <Box key={a.admissionId} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <PersonRounded sx={{ color: SEMANTIC.warning }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{a.patientName} · {a.uhid}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {a.location === "RECOVERY" ? "In recovery"
                      : a.location === "OT" ? `In ${a.theatreName || "theatre"}`
                      : a.location === "PRE_OP" ? "In pre-op"
                      : "Waiting for a bed"}
                    {" · "}{a.admissionNumber}
                  </Typography>
                </Box>
                {/* Not gated on readOnly: reading a history is not an action on
                    the patient, and an oversight panel that cannot open the bed
                    menu would otherwise have no way in at all. */}
                <PatientHistoryButton variant="icon" patientId={a.patientId}
                  patientName={a.patientName} uhid={a.uhid}
                  profilePath={`${basePath}/patients/${a.patientId}`} />
                {!readOnly && a.location !== "OT" && (
                  <Button size="small" variant="contained" sx={{ textTransform: "none", fontWeight: 700 }}
                    onClick={() => setPlacing(a)}>
                    Place in a bed
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {isLoading ? <ListSkeleton />
        : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        : wards.length === 0 ? <Mascot pose="nothing-here-yet" title="No wards yet" subtitle="Ask your hospital administrator to set up wards, rooms, and beds." />
        : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {wards.map((w) => (
              <Paper key={w.wardId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <ApartmentRounded sx={{ color: BRAND.action }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  <Chip label={w.wardTypeName ?? w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                  {w.branchName && <Chip label={w.branchName} size="small" variant="outlined" sx={{ fontWeight: 700, borderColor: BRAND.action, color: BRAND.action }} />}
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{w.floorLabel ?? `Floor ${w.floorNumber}`}</Typography>
                </Box>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: any) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Room {r.roomNumber} · {r.roomTypeName ?? r.roomType}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: BoardBed) => {
                        const color = colorOf(b.status);
                        const held = b.reservedUntil ? `held until ${new Date(b.reservedUntil).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "";
                        const tip = b.occupant && !housekeeping
                          ? `${b.occupant.patientName} (${b.occupant.uhid})${awayText(b.occupant) ? ` — ${awayText(b.occupant)}` : ""}${b.status === "DISCHARGE_INITIATED" ? " — discharge started" : ""}`
                          : [nameOf(b.status), held, b.statusReason].filter(Boolean).join(" — ");
                        // Housekeeping opens only a bed it can do something with.
                        const clickable = !readOnly && (!housekeeping || movesFrom(b.status).length > 0);
                        return (
                          // The tile is 130px wide, so a theatre called
                          // "Cardiac Theatre 2" clips. The tooltip is where
                          // the full name has to be readable.
                          <Tooltip key={b.bedId} title={tip}>
                            <Box onClick={clickable ? (e) => setBedMenu({ anchor: e.currentTarget, bed: b }) : undefined}
                              sx={{ cursor: clickable ? "pointer" : "default", width: 130, p: 1.25, borderRadius: 2, border: housekeeping && clickable ? "2px solid" : "1px solid", borderColor: color, bgcolor: `${color}40`, ...(clickable ? { "&:hover": { bgcolor: `${color}70` } } : {}) }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>Bed {b.bedNumber}</Typography>
                                <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, border: "1px solid rgba(0,0,0,0.25)" }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>{b.bedTypeName ?? b.bedType}</Typography>
                              {b.occupant && housekeeping ? (
                                <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700, display: "block" }} noWrap>{nameOf(b.status)}</Typography>
                              ) : b.occupant ? (
                                <>
                                  <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.3 }} noWrap><PersonRounded sx={{ fontSize: 12 }} /> {b.occupant.patientName}</Typography>
                                  {b.status === "DISCHARGE_INITIATED" && (
                                    <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 700, display: "block" }} noWrap>Discharge started</Typography>
                                  )}
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
                                <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700, display: "block" }} noWrap>{nameOf(b.status)}</Typography>
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
        {/* First, because it is the only item here that answers a question
            rather than moving somebody: what is this patient in for. */}
        {bedMenu.bed?.occupant?.patientId && (
          <MenuItem onClick={() => { setHistoryFor(bedMenu.bed!.occupant!); setBedMenu({ anchor: null, bed: null }); }}>
            <HistoryRounded fontSize="small" sx={{ mr: 1 }} /> Patient history
          </MenuItem>
        )}
        {bedMenu.bed && OCCUPIED.includes(bedMenu.bed.status)
          ? (awayText(bedMenu.bed?.occupant)
            ? [
                <MenuItem key="back" onClick={() => setMoveDialog({ mode: "return", bed: bedMenu.bed })}>
                  <MeetingRoomRounded fontSize="small" sx={{ mr: 1, color: SEMANTIC.success }} />
                  {bedMenu.bed?.occupant?.location === "RECOVERY" ? "Bring back from recovery" : "Bring back from theatre"}
                </MenuItem>,
              ]
            : [
                <MenuItem key="ot" onClick={() => setMoveDialog({ mode: "send", bed: bedMenu.bed })}>
                  <MedicalServicesRounded fontSize="small" sx={{ mr: 1, color: SEMANTIC.warning }} /> Send to theatre
                </MenuItem>,
              ])
          : (bedMenu.bed ? movesFrom(bedMenu.bed.status) : []).map((to) => {
            const Icon = MOVE_ICON[to] ?? CheckCircleRounded;
            const bed = bedMenu.bed!;
            return (
              <MenuItem key={to} onClick={() => (to === "RESERVED" || to === "BLOCKED")
                ? (setAsking({ bed, status: to }), setBedMenu({ anchor: null, bed: null }))
                : setBedStatus(bed.bedId, to)}>
                <Icon fontSize="small" sx={{ mr: 1, color: colorOf(to), filter: "brightness(0.7)" }} /> {MOVE_LABEL(bed.status, to)}
              </MenuItem>
            );
          })}
      </Menu>

      {asking && (
        <AskDialog kind={asking.status} bedLabel={`Bed ${asking.bed.bedNumber}`} onClose={() => setAsking(null)}
          onSave={(extra) => { const b = asking.bed; setAsking(null); setBedStatus(b.bedId, asking.status, extra); }} />
      )}

      <PatientHistoryDialog
        open={!!historyFor} onClose={() => setHistoryFor(null)}
        patientId={historyFor?.patientId} patientName={historyFor?.patientName} uhid={historyFor?.uhid}
        profilePath={historyFor?.patientId ? `${basePath}/patients/${historyFor.patientId}` : undefined} />

      {moveDialog && (
        <TheatreMoveDialog
          mode={moveDialog.mode}
          bed={moveDialog.bed}
          onClose={() => { setMoveDialog(null); setBedMenu({ anchor: null, bed: null }); }}
          onDone={() => { setMoveDialog(null); setBedMenu({ anchor: null, bed: null }); refetch(); }}
        />
      )}
      {placing && (
        <PlaceInBedDialog
          patient={placing}
          onClose={() => setPlacing(null)}
          onDone={() => { setPlacing(null); refetch(); }}
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
        {mode === "send" ? "Send to theatre"
          : bed?.occupant?.location === "RECOVERY" ? "Bring back from recovery"
          : "Bring back from theatre"}
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

/**
 * Giving a bed to a patient who has none.
 *
 * Reached from the strip at the top of the board. The usual case is a patient
 * just out of theatre whose bed was released on the way in — they are in
 * recovery and somebody has to decide where they go next, which is exactly the
 * decision releasing the bed deferred.
 */
function PlaceInBedDialog({ patient, onClose, onDone }: {
  patient: BedlessPatient; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [toBedId, setToBedId] = useState("");

  const { data: freeBeds, isLoading } = useQuery({
    queryKey: ["free-beds-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
  });

  const go = useMutation({
    mutationFn: async () =>
      axiosInstance.post(`/ipd/admissions/${patient.admissionId}/return-from-theatre`, { toBedId, reason: "Placed from recovery" }),
    onSuccess: () => { toast.success("Patient placed in a bed"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not place them")),
  });

  const beds = (freeBeds ?? []) as PickBed[];

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Place in a bed</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {patient.patientName} · {patient.uhid} · {patient.location === "RECOVERY" ? "in recovery" : "waiting"}
        </Typography>
        <TextField select required fullWidth label="Bed" value={toBedId} onChange={(e) => setToBedId(e.target.value)}
          helperText={isLoading ? "Loading…" : beds.length ? "Beds free right now" : "No bed is free"}>
          {beds.map((b) => (
            <MenuItem key={b.bedId} value={b.bedId}>{b.label || b.bedNumber}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" sx={{ textTransform: "none" }} disabled={!toBedId || go.isPending} onClick={() => go.mutate()}>
          {go.isPending ? "Placing…" : "Place them"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Reserve (for how long, and for whom) or block (why) — the two moves that need a word first. */
function AskDialog({ kind, bedLabel, onClose, onSave }: { kind: "RESERVED" | "BLOCKED"; bedLabel: string; onClose: () => void; onSave: (extra: Record<string, unknown>) => void }) {
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("24");
  const reserving = kind === "RESERVED";
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{reserving ? "Reserve" : "Block"} {bedLabel}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {reserving && (
            <TextField select fullWidth label="Hold for" value={hours} onChange={(e) => setHours(e.target.value)}
              helperText="After this the bed reads as available again — nobody has to remember to release it.">
              {[["2", "2 hours"], ["4", "4 hours"], ["8", "8 hours"], ["24", "1 day"], ["48", "2 days"], ["72", "3 days"]].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          )}
          <TextField fullWidth required={!reserving} label={reserving ? "For (optional)" : "Why is it blocked?"} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder={reserving ? "Planned admission — Mr Shah, 4 pm" : "Cohorting / gender / staffing"}
            slotProps={{ htmlInput: { maxLength: 200 } }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={!reserving && !reason.trim()}
          onClick={() => onSave({ reason: reason.trim() || undefined, ...(reserving ? { holdHours: Number(hours) } : {}) })}>
          {reserving ? "Reserve" : "Block"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
