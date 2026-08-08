import { useState, useEffect } from "react";
import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Button, Chip, Menu, MenuItem, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Divider, Tooltip, InputAdornment,
} from "@mui/material";
import {
  HotelRounded, AddRounded, PersonRounded, MeetingRoomRounded, ApartmentRounded, EditRounded, PaymentsRounded, InfoOutlined,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";

const ACCENT = ACCENTS.hospital;
const ACCENT_DARK = ACCENTS.hospitalDark;

const WARD_TYPES = ["general", "surgical", "maternity", "pediatric", "ICU"];
const ROOM_TYPES = ["general", "semi_private", "private_room", "ICU", "NICU"];
const BED_TYPES = ["regular", "ICU", "HDU", "NICU", "isolation"];

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: SEMANTIC.success, OCCUPIED: SEMANTIC.danger, RESERVED: SEMANTIC.warning, MAINTENANCE: NEUTRAL.muted,
};

// Ward/room/bed SETUP lives here (Hospital Admin) — day-to-day bed STATUS
// changes (available/reserved/maintenance) remain in the Reception panel's
// Bed Management screen, since that's operational, not configuration.
export default function FacilitySetup() {
  const toast = useToast();
  const [setupAnchor, setSetupAnchor] = useState<null | HTMLElement>(null);
  const [dialog, setDialog] = useState<null | { kind: "ward" | "room" | "bed"; edit?: any }>(null);
  const [rentOpen, setRentOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-structure"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
  });
  const summary = data?.summary;
  const wards: any[] = data?.wards || [];

  // Active room classes (Schedule of Charges) — pickable per bed to drive room-wise
  // pricing of charges on the discharge bill.
  const { data: roomClasses = [] } = useQuery<any[]>({
    queryKey: ["soc-room-classes"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/room-classes")).data.data,
  });

  const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Paper>
  );

  return (
    <Box>
      <PageHeader
        title="Ward & Bed Setup"
        subtitle="Define the wards, rooms, and beds available for admission. Day-to-day bed status is managed from the Reception panel."
        actions={
          <>
            <Button variant="outlined" startIcon={<PaymentsRounded />} onClick={() => setRentOpen(true)}
              sx={{ textTransform: "none", mr: 1, borderColor: ACCENT, color: ACCENT }}>
              Room rent
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={(e) => setSetupAnchor(e.currentTarget)}
              sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add</Button>
            <Menu anchorEl={setupAnchor} open={Boolean(setupAnchor)} onClose={() => setSetupAnchor(null)}>
              <MenuItem onClick={() => { setSetupAnchor(null); setDialog({ kind: "ward" }); }}><ApartmentRounded fontSize="small" sx={{ mr: 1 }} /> Add ward</MenuItem>
              <MenuItem onClick={() => { setSetupAnchor(null); setDialog({ kind: "room" }); }}><MeetingRoomRounded fontSize="small" sx={{ mr: 1 }} /> Add room</MenuItem>
              <MenuItem onClick={() => { setSetupAnchor(null); setDialog({ kind: "bed" }); }}><HotelRounded fontSize="small" sx={{ mr: 1 }} /> Add bed</MenuItem>
            </Menu>
          </>
        }
      />

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Total beds" value={summary.totalBeds} color={ACCENT} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Available" value={summary.available} color={STATUS_COLOR.AVAILABLE} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Occupied" value={summary.occupied} color={STATUS_COLOR.OCCUPIED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Reserved" value={summary.reserved} color={STATUS_COLOR.RESERVED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Maintenance" value={summary.maintenance} color={STATUS_COLOR.MAINTENANCE} /></Grid>
        </Grid>
      )}

      {isLoading ? <ListSkeleton />
        : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        : wards.length === 0 ? <Mascot pose="all-caught-up" title="No wards yet" subtitle="Use Add to create a ward, room, and beds." />
        : (
          <Stack spacing={2.5}>
            {wards.map((w) => (
              <Paper key={w.wardId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <ApartmentRounded sx={{ color: ACCENT }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  <Chip label={w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Floor {w.floorNumber}</Typography>
                  <Tooltip title="Edit ward">
                    <IconButton size="small" sx={{ ml: "auto", color: "text.secondary" }} onClick={() => setDialog({ kind: "ward", edit: w })}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: any) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Room {r.roomNumber} · {r.roomType}</Typography>
                      <Tooltip title="Edit room">
                        <IconButton size="small" sx={{ p: 0.25, color: "text.secondary" }} onClick={() => setDialog({ kind: "room", edit: { ...r, wardId: w.wardId } })}>
                          <EditRounded sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: any) => {
                        const color = STATUS_COLOR[b.status] || NEUTRAL.muted;
                        return (
                          <Tooltip key={b.bedId} title={b.occupant ? `${b.occupant.patientName} (${b.occupant.uhid}) — edit details` : `${b.status} — click to edit details`}>
                            <Box onClick={() => setDialog({ kind: "bed", edit: { ...b, roomId: r.roomId, wardId: w.wardId } })}
                              sx={{ cursor: "pointer", width: 130, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: `${color}55`, bgcolor: `${color}12`, position: "relative", "&:hover": { borderColor: color } }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>Bed {b.bedNumber}</Typography>
                                <EditRounded sx={{ fontSize: 13, color: "text.disabled" }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{b.bedType}{b.roomClassName ? ` · ${b.roomClassName}` : ""}</Typography>
                              {b.occupant ? (
                                <Typography variant="caption" sx={{ color, fontWeight: 600, display: "flex", alignItems: "center", gap: 0.3 }} noWrap><PersonRounded sx={{ fontSize: 12 }} /> {b.occupant.patientName}</Typography>
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
          </Stack>
        )}

      {dialog && <SetupDialog kind={dialog.kind} edit={dialog.edit} wards={wards} roomClasses={roomClasses} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refetch(); }} />}
      {rentOpen && <RoomRentDialog onClose={() => setRentOpen(false)} onDone={() => { setRentOpen(false); refetch(); }} />}
    </Box>
  );
}

// Simple room-rent editor: a daily rate per room class, in one place. Saving
// writes the SOC "Room rent" item + its per-class prices AND applies them to every
// bed — so nobody has to build a charge item or matrix by hand.
function RoomRentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rents, setRents] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<any>({
    queryKey: ["room-class-rents"],
    queryFn: async () => (await axiosInstance.get("/ipd/room-class-rents")).data.data,
  });
  const classes: any[] = data?.rents || [];

  useEffect(() => {
    if (!data) return;
    const m: Record<string, string> = {};
    for (const c of data.rents || []) m[c.roomClassId] = c.rent != null ? String(c.rent) : "";
    setRents(m);
  }, [data]);

  const save = async () => {
    const payload = classes
      .map((c) => ({ roomClassId: c.roomClassId, rent: Number(rents[c.roomClassId]) }))
      .filter((r) => Number.isFinite(r.rent) && r.rent >= 0);
    if (!payload.length) { toast.error("Enter a rent for at least one class"); return; }
    setSaving(true);
    try {
      await axiosInstance.put("/ipd/room-class-rents", { rents: payload });
      await axiosInstance.post("/ipd/beds/resync-rents");
      toast.success("Room rents saved and applied to beds");
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't save rents"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentsRounded sx={{ color: ACCENT }} /> Room rent — daily charge per class
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : classes.length === 0 ? (
          <Box sx={{ display: "flex", gap: 1.25, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <InfoOutlined sx={{ fontSize: 20, color: "text.secondary", mt: 0.1, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No room classes yet. Room classes are your pricing tiers (e.g. General, Private) and are managed in{" "}
              <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Schedule of Charges → Room classes</Box>. Add them there, then set each one's daily rent here.
            </Typography>
          </Box>
        ) : (
          <>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {classes.map((c) => (
                <Box key={c.roomClassId} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{c.name}</Typography>
                  <TextField size="small" type="number" value={rents[c.roomClassId] ?? ""} onChange={(e) => setRents({ ...rents, [c.roomClassId]: e.target.value })}
                    sx={{ width: 140 }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment>, endAdornment: <InputAdornment position="end">/day</InputAdornment> }} />
                </Box>
              ))}
            </Stack>
            <Box sx={{ display: "flex", gap: 1.25, mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
              <InfoOutlined sx={{ fontSize: 18, color: "text.secondary", mt: 0.15, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Saving sets every bed's daily charge to match its room class.
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                  Need another tier (e.g. Deluxe)? Add it in{" "}
                  <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Schedule of Charges → Room classes</Box>, then it'll appear here.
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || classes.length === 0} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>
          {saving ? "Saving…" : "Save rents"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SetupDialog({ kind, edit, wards, roomClasses, onClose, onDone }: { kind: "ward" | "room" | "bed"; edit?: any; wards: any[]; roomClasses: any[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const isEdit = Boolean(edit?.wardId || edit?.roomId || edit?.bedId);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>(() => {
    const base = { wardType: "general", roomType: "general", bedType: "regular", floorNumber: "1", roomClassId: "" };
    if (!edit) return base;
    return {
      ...base,
      wardId: edit.wardId,
      roomId: edit.roomId,
      bedId: edit.bedId,
      wardName: edit.wardName,
      wardType: edit.wardType ?? base.wardType,
      floorNumber: edit.floorNumber != null ? String(edit.floorNumber) : base.floorNumber,
      roomNumber: edit.roomNumber,
      roomType: edit.roomType ?? base.roomType,
      bedNumber: edit.bedNumber,
      bedType: edit.bedType ?? base.bedType,
      dailyCharge: edit.dailyCharge != null ? String(edit.dailyCharge) : "",
      roomClassId: edit.roomClassId ?? "",
    };
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  // SOC-driven daily rent per room class — used to auto-fill the bed's daily charge.
  const { data: rentInfo } = useQuery<any>({
    queryKey: ["room-class-rents"],
    queryFn: async () => (await axiosInstance.get("/ipd/room-class-rents")).data.data,
    enabled: kind === "bed",
  });
  const rentFor = (rcId: string): number | null => {
    if (!rentInfo?.configured) return null;
    const row = (rentInfo.rents || []).find((r: any) => r.roomClassId === rcId);
    return row && row.rent != null ? Number(row.rent) : (rentInfo.baseRent ?? null);
  };
  // Picking a room class fills the daily rent from SOC (still editable afterwards).
  const pickClass = (rcId: string) => {
    set("roomClassId", rcId);
    const r = rentFor(rcId);
    if (r != null) set("dailyCharge", String(r));
  };

  const rooms = (wards.find((w) => w.wardId === f.wardId)?.rooms) || [];
  const editingWard = kind === "ward" && isEdit;
  const editingRoom = kind === "room" && isEdit;
  const editingBed = kind === "bed" && isEdit;

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "ward") {
        const body = { wardName: f.wardName, wardType: f.wardType, floorNumber: Number(f.floorNumber) };
        if (editingWard) await axiosInstance.put(`/ipd/wards/${f.wardId}`, body);
        else await axiosInstance.post("/ipd/wards", body);
      } else if (kind === "room") {
        if (editingRoom) await axiosInstance.put(`/ipd/rooms/${f.roomId}`, { roomNumber: f.roomNumber, roomType: f.roomType });
        else await axiosInstance.post("/ipd/rooms", { wardId: f.wardId, roomNumber: f.roomNumber, roomType: f.roomType });
      } else {
        const charge = f.dailyCharge === "" ? null : Number(f.dailyCharge);
        // Empty room-class clears the link; the backend treats "" / null as no class.
        if (editingBed) await axiosInstance.put(`/ipd/beds/${f.bedId}`, { bedNumber: f.bedNumber, bedType: f.bedType, dailyCharge: charge, roomClassId: f.roomClassId || null });
        else await axiosInstance.post("/ipd/beds", { roomId: f.roomId, bedNumber: f.bedNumber, bedType: f.bedType, dailyCharge: f.dailyCharge ? Number(f.dailyCharge) : undefined, roomClassId: f.roomClassId || undefined });
      }
      toast.success(`${kind[0].toUpperCase() + kind.slice(1)} ${isEdit ? "updated" : "added"}`);
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const valid = kind === "ward" ? f.wardName && f.floorNumber : kind === "room" ? f.wardId && f.roomNumber : f.roomId && f.bedNumber;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEdit ? "Edit" : "Add"} {kind}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {kind === "ward" && (<>
            <TextField fullWidth required label="Ward name" value={f.wardName || ""} onChange={(e) => set("wardName", e.target.value)} />
            <TextField select fullWidth label="Ward type" value={f.wardType} onChange={(e) => set("wardType", e.target.value)}>{WARD_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            <TextField fullWidth required type="number" label="Floor number" value={f.floorNumber} onChange={(e) => set("floorNumber", e.target.value)} />
          </>)}
          {kind === "room" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} disabled={editingRoom} onChange={(e) => set("wardId", e.target.value)}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Room number" value={f.roomNumber || ""} onChange={(e) => set("roomNumber", e.target.value)} />
            <TextField select fullWidth label="Room type" value={f.roomType} onChange={(e) => set("roomType", e.target.value)}>{ROOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace("_", " ")}</MenuItem>)}</TextField>
          </>)}
          {kind === "bed" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} disabled={editingBed} onChange={(e) => { set("wardId", e.target.value); set("roomId", ""); }}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField select fullWidth required label="Room" value={f.roomId || ""} disabled={editingBed || !f.wardId} onChange={(e) => set("roomId", e.target.value)} helperText={!editingBed && f.wardId && rooms.length === 0 ? "Add a room to this ward first" : undefined}>{rooms.map((r: any) => <MenuItem key={r.roomId} value={r.roomId}>Room {r.roomNumber}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Bed number" value={f.bedNumber || ""} onChange={(e) => set("bedNumber", e.target.value)} />
            <TextField select fullWidth label="Bed type" value={f.bedType} onChange={(e) => set("bedType", e.target.value)}>{BED_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            <TextField select fullWidth label="Room class (pricing)" value={f.roomClassId || ""} onChange={(e) => pickClass(e.target.value)}
              helperText="Sets the price tier for this bed's charges — and fills the daily rent from the Schedule of Charges.">
              <MenuItem value=""><em>None (base price)</em></MenuItem>
              {/* Active classes, plus the bed's current class even if later deactivated. */}
              {roomClasses.filter((rc: any) => rc.isActive || rc.roomClassId === f.roomClassId).map((rc: any) => <MenuItem key={rc.roomClassId} value={rc.roomClassId}>{rc.name}{rc.isActive ? "" : " (inactive)"}</MenuItem>)}
            </TextField>
            <TextField fullWidth type="number" label="Daily charge (₹)" value={f.dailyCharge || ""} onChange={(e) => set("dailyCharge", e.target.value)}
              helperText={rentInfo?.configured
                ? (rentFor(f.roomClassId) != null ? `Auto-filled from Schedule of Charges (₹${rentFor(f.roomClassId)}) — editable` : "Editable")
                : "Tip: add a 'Room rent' charge (type Bed) in the Schedule of Charges to auto-fill this."}
              InputProps={rentInfo?.configured && rentFor(f.roomClassId) != null ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Reset to the SOC price for this room class">
                      <Button size="small" onClick={() => set("dailyCharge", String(rentFor(f.roomClassId)))} sx={{ textTransform: "none", minWidth: 0, px: 1 }}>SOC</Button>
                    </Tooltip>
                  </InputAdornment>
                ),
              } : undefined} />
          </>)}
          <Divider />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !valid} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
