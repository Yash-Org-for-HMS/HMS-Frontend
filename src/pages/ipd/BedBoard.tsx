import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, CircularProgress, Button, Chip, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Divider, Tooltip,
} from "@mui/material";
import {
  HotelRounded, AddRounded, EventSeatRounded, BuildRounded, CheckCircleRounded,
  PersonRounded, MeetingRoomRounded, ApartmentRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { useToast } from "../../contexts/ToastContext";

const WARD_TYPES = ["general", "surgical", "maternity", "pediatric", "ICU"];
const ROOM_TYPES = ["general", "semi_private", "private_room", "ICU", "NICU"];
const BED_TYPES = ["regular", "ICU", "HDU", "NICU", "isolation"];

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#10b981", OCCUPIED: "#ef4444", RESERVED: "#f59e0b", MAINTENANCE: "#64748b",
};

export default function BedBoard() {
  const toast = useToast();
  const [setupAnchor, setSetupAnchor] = useState<null | HTMLElement>(null);
  const [dialog, setDialog] = useState<null | "ward" | "room" | "bed">(null);
  const [bedMenu, setBedMenu] = useState<{ anchor: HTMLElement | null; bed: any }>({ anchor: null, bed: null });

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update bed");
    }
  };

  const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>Bed Management</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Ward occupancy, bed availability, and reservations</Typography>
        </Box>
        <Button variant="outlined" startIcon={<AddRounded />} onClick={(e) => setSetupAnchor(e.currentTarget)}
          sx={{ textTransform: "none", borderRadius: 2, color: "#0891b2", borderColor: "rgba(8,145,178,0.4)" }}>Setup</Button>
        <Menu anchorEl={setupAnchor} open={Boolean(setupAnchor)} onClose={() => setSetupAnchor(null)}>
          <MenuItem onClick={() => { setSetupAnchor(null); setDialog("ward"); }}><ApartmentRounded fontSize="small" sx={{ mr: 1 }} /> Add ward</MenuItem>
          <MenuItem onClick={() => { setSetupAnchor(null); setDialog("room"); }}><MeetingRoomRounded fontSize="small" sx={{ mr: 1 }} /> Add room</MenuItem>
          <MenuItem onClick={() => { setSetupAnchor(null); setDialog("bed"); }}><HotelRounded fontSize="small" sx={{ mr: 1 }} /> Add bed</MenuItem>
        </Menu>
      </Box>

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Total beds" value={summary.totalBeds} color="#0891b2" /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Available" value={summary.available} color={STATUS_COLOR.AVAILABLE} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Occupied" value={summary.occupied} color={STATUS_COLOR.OCCUPIED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Reserved" value={summary.reserved} color={STATUS_COLOR.RESERVED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Maintenance" value={summary.maintenance} color={STATUS_COLOR.MAINTENANCE} /></Grid>
        </Grid>
      )}

      {isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress sx={{ color: "#06b6d4" }} /></Box>
        : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
        : wards.length === 0 ? <Mascot pose="all-caught-up" title="No wards yet" subtitle="Use Setup to add a ward, room, and beds." />
        : (
          <Stack spacing={2.5}>
            {wards.map((w) => (
              <Paper key={w.wardId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <ApartmentRounded sx={{ color: "#0891b2" }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  <Chip label={w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Floor {w.floorNumber}</Typography>
                </Box>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: any) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Room {r.roomNumber} · {r.roomType}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: any) => {
                        const color = STATUS_COLOR[b.status] || "#64748b";
                        return (
                          <Tooltip key={b.bedId} title={b.occupant ? `${b.occupant.patientName} (${b.occupant.uhid})` : b.status}>
                            <Box onClick={(e) => setBedMenu({ anchor: e.currentTarget, bed: b })}
                              sx={{ cursor: "pointer", width: 130, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: `${color}55`, bgcolor: `${color}12`, "&:hover": { borderColor: color } }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>Bed {b.bedNumber}</Typography>
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{b.bedType}</Typography>
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

      {/* Bed status menu */}
      <Menu anchorEl={bedMenu.anchor} open={Boolean(bedMenu.anchor)} onClose={() => setBedMenu({ anchor: null, bed: null })}>
        {bedMenu.bed?.status === "OCCUPIED"
          ? <MenuItem disabled>Occupied — manage via Admissions</MenuItem>
          : [
            <MenuItem key="a" disabled={bedMenu.bed?.status === "AVAILABLE"} onClick={() => setBedStatus(bedMenu.bed.bedId, "AVAILABLE")}><CheckCircleRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.AVAILABLE }} /> Mark available</MenuItem>,
            <MenuItem key="r" disabled={bedMenu.bed?.status === "RESERVED"} onClick={() => setBedStatus(bedMenu.bed.bedId, "RESERVED")}><EventSeatRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.RESERVED }} /> Reserve</MenuItem>,
            <MenuItem key="m" disabled={bedMenu.bed?.status === "MAINTENANCE"} onClick={() => setBedStatus(bedMenu.bed.bedId, "MAINTENANCE")}><BuildRounded fontSize="small" sx={{ mr: 1, color: STATUS_COLOR.MAINTENANCE }} /> Maintenance</MenuItem>,
          ]}
      </Menu>

      {dialog && <SetupDialog kind={dialog} wards={wards} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refetch(); }} />}
    </Box>
  );
}

function SetupDialog({ kind, wards, onClose, onDone }: { kind: "ward" | "room" | "bed"; wards: any[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({ wardType: "general", roomType: "general", bedType: "regular", floorNumber: "1" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const rooms = (wards.find((w) => w.wardId === f.wardId)?.rooms) || [];

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "ward") await axiosInstance.post("/ipd/wards", { wardName: f.wardName, wardType: f.wardType, floorNumber: Number(f.floorNumber) });
      else if (kind === "room") await axiosInstance.post("/ipd/rooms", { wardId: f.wardId, roomNumber: f.roomNumber, roomType: f.roomType });
      else await axiosInstance.post("/ipd/beds", { roomId: f.roomId, bedNumber: f.bedNumber, bedType: f.bedType, dailyCharge: f.dailyCharge ? Number(f.dailyCharge) : undefined });
      toast.success(`${kind[0].toUpperCase() + kind.slice(1)} added`);
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const valid = kind === "ward" ? f.wardName && f.floorNumber : kind === "room" ? f.wardId && f.roomNumber : f.roomId && f.bedNumber;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add {kind}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {kind === "ward" && (<>
            <TextField fullWidth required label="Ward name" value={f.wardName || ""} onChange={(e) => set("wardName", e.target.value)} />
            <TextField select fullWidth label="Ward type" value={f.wardType} onChange={(e) => set("wardType", e.target.value)}>{WARD_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            <TextField fullWidth required type="number" label="Floor number" value={f.floorNumber} onChange={(e) => set("floorNumber", e.target.value)} />
          </>)}
          {kind === "room" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} onChange={(e) => set("wardId", e.target.value)}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Room number" value={f.roomNumber || ""} onChange={(e) => set("roomNumber", e.target.value)} />
            <TextField select fullWidth label="Room type" value={f.roomType} onChange={(e) => set("roomType", e.target.value)}>{ROOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace("_", " ")}</MenuItem>)}</TextField>
          </>)}
          {kind === "bed" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} onChange={(e) => { set("wardId", e.target.value); set("roomId", ""); }}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField select fullWidth required label="Room" value={f.roomId || ""} onChange={(e) => set("roomId", e.target.value)} disabled={!f.wardId} helperText={f.wardId && rooms.length === 0 ? "Add a room to this ward first" : undefined}>{rooms.map((r: any) => <MenuItem key={r.roomId} value={r.roomId}>Room {r.roomNumber}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Bed number" value={f.bedNumber || ""} onChange={(e) => set("bedNumber", e.target.value)} />
            <TextField select fullWidth label="Bed type" value={f.bedType} onChange={(e) => set("bedType", e.target.value)}>{BED_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
            <TextField fullWidth type="number" label="Daily charge (₹)" value={f.dailyCharge || ""} onChange={(e) => set("dailyCharge", e.target.value)} />
          </>)}
          <Divider />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !valid} sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
