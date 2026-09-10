import { useState } from "react";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Menu, MenuItem, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel,
} from "@mui/material";
import {
  MedicalServicesRounded, BuildRounded, CheckCircleRounded, CleaningServicesRounded,
  AddRounded, EditRounded, DeleteOutlineRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageHeader from "@/components/layout/PageHeader";

type Theatre = {
  operatingTheatreId: string;
  theatreName: string;
  theatreCode: string | null;
  theatreType: string;
  location: string | null;
  status: string;
  isActive: boolean;
  notes: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: SEMANTIC.success,
  OCCUPIED: SEMANTIC.danger,
  CLEANING: SEMANTIC.warning,
  MAINTENANCE: NEUTRAL.muted,
};
const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available", OCCUPIED: "In use", CLEANING: "Cleaning", MAINTENANCE: "Maintenance",
};
const TYPE_LABEL: Record<string, string> = {
  MAJOR: "Major OT", MINOR: "Minor OT", EMERGENCY: "Emergency OT", DAY_CARE: "Day-care OT",
};
const TYPES = ["MAJOR", "MINOR", "EMERGENCY", "DAY_CARE"];

const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
    <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

/**
 * The operating theatres, and what is in each one.
 *
 * `manage` turns on the configuration side — adding, editing and removing
 * theatres — which belongs to the Hospital Admin panel beside Ward & Bed Setup.
 * Without it this is the day-to-day board: read the theatres, and mark one
 * cleaning or back in service once a case has finished.
 */
export default function TheatreBoard({ manage = false }: { manage?: boolean } = {}) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; theatre: Theatre | null }>({ anchor: null, theatre: null });
  const [editing, setEditing] = useState<Theatre | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-theatres", manage],
    queryFn: async () =>
      (await axiosInstance.get("/ipd/theatres", { params: manage ? { includeInactive: true } : {} })).data.data,
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) =>
      axiosInstance.put(`/ipd/theatres/${v.id}/status`, { status: v.status }),
    onSuccess: () => { toast.success("Theatre updated"); qc.invalidateQueries({ queryKey: ["ot-theatres"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not update the theatre")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => axiosInstance.delete(`/ipd/theatres/${id}`),
    onSuccess: () => { toast.success("Theatre removed"); qc.invalidateQueries({ queryKey: ["ot-theatres"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove the theatre")),
  });

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const theatres: Theatre[] = data?.theatres ?? [];
  const s = data?.summary ?? { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };

  const askRemove = async (t: Theatre) => {
    setMenu({ anchor: null, theatre: null });
    const ok = await confirm({
      title: `Remove ${t.theatreName}?`,
      message: "It stops appearing on the board and cannot be scheduled. Past surgeries that used it are unaffected.",
      confirmText: "Remove",
    });
    if (ok) remove.mutate(t.operatingTheatreId);
  };

  return (
    <Box>
      <PageHeader
        title={manage ? "Operating Theatres" : "Theatre Board"}
        subtitle={manage ? "Define the theatres this branch operates in" : "What is running in each theatre right now"}
        actions={manage ? (
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreating(true)}>Add theatre</Button>
        ) : undefined}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Theatres" value={s.total} color={BRAND.action} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Available" value={s.available} color={STATUS_COLOR.AVAILABLE} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="In use" value={s.occupied} color={STATUS_COLOR.OCCUPIED} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Cleaning" value={s.cleaning} color={STATUS_COLOR.CLEANING} /></Grid>
      </Grid>

      {theatres.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Mascot
            pose="nothing-here-yet"
            subtitle={manage
              ? "No theatres defined yet. Add one to start scheduling surgery."
              : "No theatres have been set up. A hospital admin can add them under Operating Theatres."}
            size={130}
          />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {theatres.map((t) => {
            const color = STATUS_COLOR[t.status] ?? NEUTRAL.muted;
            return (
              <Grid key={t.operatingTheatreId} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Paper
                  elevation={0}
                  onClick={(e) => setMenu({ anchor: e.currentTarget, theatre: t })}
                  sx={{
                    p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider",
                    borderLeft: `4px solid ${color}`, cursor: "pointer", opacity: t.isActive ? 1 : 0.55,
                    transition: "box-shadow 120ms",
                    "&:hover": { boxShadow: "0 4px 16px rgba(15,23,42,0.08)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <MedicalServicesRounded sx={{ color, fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                      {t.theatreName}
                    </Typography>
                    {!t.isActive && <Chip size="small" label="Inactive" sx={{ height: 20, fontSize: "0.65rem" }} />}
                  </Box>
                  <Chip
                    size="small" label={STATUS_LABEL[t.status] ?? t.status}
                    sx={{ bgcolor: `${color}1a`, color, fontWeight: 700, mb: 1 }}
                  />
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {TYPE_LABEL[t.theatreType] ?? t.theatreType}
                    {t.theatreCode ? ` · ${t.theatreCode}` : ""}
                  </Typography>
                  {t.location && (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
                      {t.location}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, theatre: null })}>
        {menu.theatre?.status === "OCCUPIED"
          // Occupied is set by moving a patient in and cleared by moving them
          // out. Offering it here would let a theatre read free while somebody
          // is still on the table.
          ? [<MenuItem key="busy" disabled>A patient is in this theatre</MenuItem>]
          : [
              <MenuItem key="avail" onClick={() => { setStatus.mutate({ id: menu.theatre!.operatingTheatreId, status: "AVAILABLE" }); setMenu({ anchor: null, theatre: null }); }}>
                <CheckCircleRounded sx={{ mr: 1.5, fontSize: 20, color: SEMANTIC.success }} /> Mark available
              </MenuItem>,
              <MenuItem key="clean" onClick={() => { setStatus.mutate({ id: menu.theatre!.operatingTheatreId, status: "CLEANING" }); setMenu({ anchor: null, theatre: null }); }}>
                <CleaningServicesRounded sx={{ mr: 1.5, fontSize: 20, color: SEMANTIC.warning }} /> Mark cleaning
              </MenuItem>,
              <MenuItem key="maint" onClick={() => { setStatus.mutate({ id: menu.theatre!.operatingTheatreId, status: "MAINTENANCE" }); setMenu({ anchor: null, theatre: null }); }}>
                <BuildRounded sx={{ mr: 1.5, fontSize: 20, color: NEUTRAL.muted }} /> Mark under maintenance
              </MenuItem>,
              ...(manage ? [
                <MenuItem key="edit" onClick={() => { setEditing(menu.theatre); setMenu({ anchor: null, theatre: null }); }}>
                  <EditRounded sx={{ mr: 1.5, fontSize: 20, color: SEMANTIC.info }} /> Edit details
                </MenuItem>,
                <MenuItem key="del" onClick={() => askRemove(menu.theatre!)} sx={{ color: SEMANTIC.danger }}>
                  <DeleteOutlineRounded sx={{ mr: 1.5, fontSize: 20 }} /> Remove
                </MenuItem>,
              ] : []),
            ]}
      </Menu>

      {(creating || editing) && (
        <TheatreDialog
          theatre={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["ot-theatres"] }); }}
        />
      )}
    </Box>
  );
}

function TheatreDialog({ theatre, onClose, onSaved }: { theatre: Theatre | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    theatreName: theatre?.theatreName ?? "",
    theatreCode: theatre?.theatreCode ?? "",
    theatreType: theatre?.theatreType ?? "MAJOR",
    location: theatre?.location ?? "",
    notes: theatre?.notes ?? "",
    isActive: theatre?.isActive ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        theatreName: form.theatreName.trim(),
        theatreCode: form.theatreCode.trim() || undefined,
        theatreType: form.theatreType,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
        ...(theatre ? { isActive: form.isActive } : {}),
      };
      return theatre
        ? axiosInstance.put(`/ipd/theatres/${theatre.operatingTheatreId}`, body)
        : axiosInstance.post("/ipd/theatres", body);
    },
    onSuccess: () => { toast.success(theatre ? "Theatre updated" : "Theatre added"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the theatre")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{theatre ? "Edit theatre" : "Add theatre"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Theatre name" required autoFocus fullWidth
            placeholder="e.g. OT 1"
            value={form.theatreName}
            onChange={(e) => setForm({ ...form, theatreName: e.target.value })}
            helperText="Must be unique within this branch"
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Type" fullWidth value={form.theatreType}
              onChange={(e) => setForm({ ...form, theatreType: e.target.value })}>
              {TYPES.map((t) => <MenuItem key={t} value={t}>{TYPE_LABEL[t]}</MenuItem>)}
            </TextField>
            <TextField label="Code (optional)" fullWidth value={form.theatreCode}
              onChange={(e) => setForm({ ...form, theatreCode: e.target.value })} />
          </Stack>
          <TextField label="Location (optional)" fullWidth placeholder="e.g. 2nd floor, east wing"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <TextField label="Notes (optional)" fullWidth multiline rows={2}
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {theatre && (
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active — an inactive theatre stays on record but cannot be scheduled"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.theatreName.trim() || save.isPending}
          onClick={() => save.mutate()}
          sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Saving…" : theatre ? "Save changes" : "Add theatre"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
