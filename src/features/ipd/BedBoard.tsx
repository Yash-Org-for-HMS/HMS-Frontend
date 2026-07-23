import { useState } from "react";
import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Menu, MenuItem, Tooltip,
} from "@mui/material";
import {
  EventSeatRounded, BuildRounded, CheckCircleRounded,
  PersonRounded, ApartmentRounded,
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

// Read-only structure + day-to-day bed STATUS changes only. Adding/editing
// wards, rooms, and beds is hospital configuration, managed from the Hospital
// Admin panel (Ward & Bed Setup) — not from Reception.
// `readOnly` renders a pure oversight view (hospital-admin Operations): bed
// tiles still show live occupancy but are not clickable, so the admin can read
// the ward census without opening the status-change menu (available / reserved /
// maintenance). Defaults keep the IPD panel interactive.
export default function BedBoard({ readOnly = false }: { readOnly?: boolean } = {}) {
  const toast = useToast();
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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update bed"));
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
      <PageHeader
        title="Bed Management"
        subtitle="Ward occupancy, bed availability, and reservations. To add or edit wards, rooms, or beds, contact your hospital administrator."
      />

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Total beds" value={summary.totalBeds} color={ACCENTS.ipd} /></Grid>
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
                  <ApartmentRounded sx={{ color: ACCENTS.ipd }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  <Chip label={w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Floor {w.floorNumber}</Typography>
                </Box>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: any) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Room {r.roomNumber} · {r.roomType}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: any) => {
                        const color = STATUS_COLOR[b.status] || NEUTRAL.muted;
                        return (
                          <Tooltip key={b.bedId} title={b.occupant ? `${b.occupant.patientName} (${b.occupant.uhid})` : b.status}>
                            <Box onClick={readOnly ? undefined : (e) => setBedMenu({ anchor: e.currentTarget, bed: b })}
                              sx={{ cursor: readOnly ? "default" : "pointer", width: 130, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: `${color}55`, bgcolor: `${color}12`, ...(readOnly ? {} : { "&:hover": { borderColor: color } }) }}>
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
          </Box>
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
    </Box>
  );
}
