import { useState } from "react";
import { getApiErrorMessage, apiErrorText } from "../../../utils/apiError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Switch, FormControlLabel,
} from "@mui/material";
import {
  AddRounded, EditRounded, VaccinesRounded, DeleteRounded, ListAltRounded, PublicRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";
import ErrorState from "../../../components/ErrorState";
import Mascot from "../../../components/Mascot";
import DetailSkeleton from "../../../components/skeletons/DetailSkeleton";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import PageHeader from "../../../components/layout/PageHeader";

const ACCENT = "#6366f1";
const ACCENT_DARK = "#4f46e5";

type ScheduleItem = { scheduleItemId: string; doseLabel: string; ageLabel: string; recommendedAgeDays: number; sortOrder: number };
type Vaccine = { vaccineId: string; vaccineCode: string; vaccineName: string; description: string | null; price: number | string | null; isActive: boolean; isGlobal: boolean; scheduleItems: ScheduleItem[] };
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// The catalog every "+ Add Vaccine" picker (Reception patient profile) draws
// from. The shared/global UIP list (isGlobal) is read-only here — a hospital
// can only add/edit/deactivate ITS OWN vaccines, never the shared catalog.
export default function VaccineCatalog() {
  const toast = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vaccine | null>(null);
  const [dosesTarget, setDosesTarget] = useState<Vaccine | null>(null);

  const { data: vaccines = [], isLoading, isError, error, refetch } = useQuery<Vaccine[]>({
    queryKey: ["vaccine-catalog-admin"],
    queryFn: async () => (await axiosInstance.get("/vaccination/admin/vaccines")).data.data,
  });

  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["vaccine-catalog"] }); // the "+ Add Vaccine" picker on patient profiles
  };

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <PageHeader
        title="Vaccine Catalog"
        subtitle="Vaccines available to assign to patients. The shared list (e.g. the national schedule) is read-only; add your own below."
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setAddOpen(true)}
            sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add Vaccine</Button>
        }
      />

      {vaccines.length === 0 ? (
        <Mascot pose="all-caught-up" title="No vaccines yet" subtitle="Use Add Vaccine to create your first one." />
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Vaccine", "Code", "Price", "Doses", "Source", "Status", ""].map((h) => (
                    <TableCell key={h} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {vaccines.map((v) => (
                  <TableRow key={v.vaccineId} hover>
                    <TableCell sx={{ borderColor: "divider", fontWeight: 600 }}>{v.vaccineName}</TableCell>
                    <TableCell sx={{ borderColor: "divider", fontFamily: "monospace", color: "text.secondary" }}>{v.vaccineCode}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      {v.price ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{inr(v.price)}</Typography> : <Typography variant="body2" sx={{ color: "text.secondary" }}>Free</Typography>}
                    </TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      <Button size="small" startIcon={<ListAltRounded fontSize="small" />} onClick={() => setDosesTarget(v)} sx={{ textTransform: "none" }}>
                        {v.scheduleItems.length} dose{v.scheduleItems.length === 1 ? "" : "s"}
                      </Button>
                    </TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      {v.isGlobal
                        ? <Chip size="small" icon={<PublicRounded sx={{ fontSize: "14px !important" }} />} label="Shared" sx={{ bgcolor: "action.hover", fontWeight: 600 }} />
                        : <Chip size="small" label="Your hospital" sx={{ bgcolor: `${ACCENT}1f`, color: ACCENT, fontWeight: 700 }} />}
                    </TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      <Chip size="small" label={v.isActive ? "Active" : "Inactive"} sx={{ bgcolor: v.isActive ? "#10b9811f" : "#94a3b81f", color: v.isActive ? "#10b981" : "#94a3b8", fontWeight: 700 }} />
                    </TableCell>
                    <TableCell align="right" sx={{ borderColor: "divider" }}>
                      {!v.isGlobal && (
                        <Tooltip title="Edit vaccine">
                          <IconButton size="small" onClick={() => setEditTarget(v)}><EditRounded fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {addOpen && <AddVaccineDialog onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); invalidate(); }} />}
      {editTarget && <EditVaccineDialog vaccine={editTarget} onClose={() => setEditTarget(null)} onDone={() => { setEditTarget(null); invalidate(); }} />}
      {dosesTarget && <DosesDialog vaccine={dosesTarget} onClose={() => setDosesTarget(null)} onChanged={invalidate} />}
    </Box>
  );
}

function AddVaccineDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [vaccineCode, setVaccineCode] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/vaccination/admin/vaccines", { vaccineCode, vaccineName, description: description || undefined, price: price ? Number(price) : undefined });
      toast.success("Vaccine added");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add vaccine"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}><VaccinesRounded sx={{ color: ACCENT }} /> Add vaccine</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField fullWidth required label="Vaccine name" placeholder="e.g. Seasonal Flu Shot" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} />
          <TextField fullWidth required label="Code" placeholder="e.g. FLU" helperText="Short unique code, letters/numbers only" value={vaccineCode} onChange={(e) => setVaccineCode(e.target.value.toUpperCase())} />
          <TextField fullWidth type="number" label="Price (₹, optional)" placeholder="Leave blank if free" helperText="Administering this vaccine will raise a charge for this amount" value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextField fullWidth multiline minRows={2} label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !vaccineName || !vaccineCode} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function EditVaccineDialog({ vaccine, onClose, onDone }: { vaccine: Vaccine; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [vaccineName, setVaccineName] = useState(vaccine.vaccineName);
  const [description, setDescription] = useState(vaccine.description || "");
  const [price, setPrice] = useState(vaccine.price != null ? String(vaccine.price) : "");
  const [isActive, setIsActive] = useState(vaccine.isActive);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/vaccination/admin/vaccines/${vaccine.vaccineId}`, { vaccineName, description, isActive, price: price === "" ? null : Number(price) });
      toast.success("Vaccine updated");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update vaccine"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}><EditRounded sx={{ color: ACCENT }} /> Edit vaccine</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField fullWidth required label="Vaccine name" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} />
          <TextField fullWidth type="number" label="Price (₹, optional)" placeholder="Leave blank if free" helperText="Administering this vaccine will raise a charge for this amount" value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextField fullWidth multiline minRows={2} label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label={isActive ? "Active — assignable to patients" : "Inactive — hidden from the assign picker"} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !vaccineName} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function DosesDialog({ vaccine, onClose, onChanged }: { vaccine: Vaccine; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(vaccine.scheduleItems);
  const [adding, setAdding] = useState(false);
  const [doseLabel, setDoseLabel] = useState("");
  const [ageLabel, setAgeLabel] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [busy, setBusy] = useState(false);

  const addItem = async () => {
    setBusy(true);
    try {
      const res = await axiosInstance.post(`/vaccination/admin/vaccines/${vaccine.vaccineId}/schedule-items`, {
        doseLabel, ageLabel, recommendedAgeDays: Number(ageDays),
      });
      setItems((prev) => [...prev, res.data.data]);
      setDoseLabel(""); setAgeLabel(""); setAgeDays(""); setAdding(false);
      toast.success("Dose added");
      onChanged();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add dose"));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: ScheduleItem) => {
    const ok = await confirm({
      title: "Remove dose",
      message: `Remove "${item.doseLabel}" from this vaccine's schedule? This cannot be undone.`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await axiosInstance.delete(`/vaccination/admin/schedule-items/${item.scheduleItemId}`);
      setItems((prev) => prev.filter((i) => i.scheduleItemId !== item.scheduleItemId));
      toast.success("Dose removed");
      onChanged();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to remove dose"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}><ListAltRounded sx={{ color: ACCENT }} /> {vaccine.vaccineName} — doses</DialogTitle>
      <DialogContent dividers>
        {vaccine.isGlobal && (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            This is part of the shared catalog — its dose schedule can't be changed here.
          </Typography>
        )}
        <Stack spacing={1.5}>
          {items.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No fixed schedule — this vaccine is only ever assigned ad-hoc via "+ Add Vaccine" on a patient's profile.
            </Typography>
          )}
          {items.map((it) => (
            <Box key={it.scheduleItemId} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.doseLabel}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Due at {it.ageLabel} ({it.recommendedAgeDays} days from birth)</Typography>
              </Box>
              {!vaccine.isGlobal && (
                <IconButton size="small" disabled={busy} onClick={() => removeItem(it)} sx={{ color: "text.secondary" }}><DeleteRounded fontSize="small" /></IconButton>
              )}
            </Box>
          ))}
        </Stack>

        {!vaccine.isGlobal && (
          adding ? (
            <Stack spacing={1.5} sx={{ mt: 2, p: 1.5, borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
              <TextField size="small" fullWidth label="Dose label" placeholder="e.g. 1st dose" value={doseLabel} onChange={(e) => setDoseLabel(e.target.value)} />
              <TextField size="small" fullWidth label="Age label" placeholder="e.g. 6 weeks" value={ageLabel} onChange={(e) => setAgeLabel(e.target.value)} />
              <TextField size="small" fullWidth type="number" label="Age in days (from birth)" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} />
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
                <Button size="small" variant="contained" onClick={addItem} disabled={busy || !doseLabel || !ageLabel || ageDays === ""} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add dose</Button>
              </Box>
            </Stack>
          ) : (
            <Button size="small" startIcon={<AddRounded fontSize="small" />} onClick={() => setAdding(true)} sx={{ mt: 2, textTransform: "none" }}>Add a scheduled dose</Button>
          )
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
