import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, IconButton, Stack, ToggleButtonGroup, ToggleButton, CircularProgress,
} from "@mui/material";
import { AddRounded, DeleteOutlineRounded, ScienceRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";

const ACCENT = "#10b981";
type Param = { parameterTestId?: string | null; name: string; unit: string; normalRange: string };

// Define the clinical structure of a SOC Lab-test charge: a single test (unit +
// reference range) or a profile/panel (parameters, each with unit + range). The
// server fans a profile out into per-parameter result rows at order time.
export default function LabStructureDialog({ chargeItemId, itemName, onClose }: { chargeItemId: string; itemName: string; onClose: () => void }) {
  const toast = useToast();
  const [isProfile, setIsProfile] = useState(false);
  const [unit, setUnit] = useState("");
  const [normalRange, setNormalRange] = useState("");
  const [params, setParams] = useState<Param[]>([]);
  const [saving, setSaving] = useState(false);

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ["lab-structure", chargeItemId],
    queryFn: async () => {
      const d = (await axiosInstance.get(`/lab/tests/${chargeItemId}/structure`)).data.data;
      setIsProfile(!!d.isProfile);
      setUnit(d.unit ?? "");
      setNormalRange(d.normalRange ?? "");
      setParams((d.parameters ?? []).map((p: any) => ({ parameterTestId: p.parameterTestId, name: p.name ?? "", unit: p.unit ?? "", normalRange: p.normalRange ?? "" })));
      return d;
    },
  });

  const addParam = () => setParams((p) => [...p, { name: "", unit: "", normalRange: "" }]);
  const setParam = (i: number, k: keyof Param, v: string) => setParams((p) => p.map((r, ri) => (ri === i ? { ...r, [k]: v } : r)));
  const removeParam = (i: number) => setParams((p) => p.filter((_, ri) => ri !== i));

  const save = async () => {
    const clean = params.filter((p) => p.name.trim());
    if (isProfile && clean.length === 0) { toast.error("Add at least one parameter, or switch to a single test."); return; }
    setSaving(true);
    try {
      await axiosInstance.put(`/lab/tests/${chargeItemId}/structure`, {
        isProfile,
        unit: unit.trim() || undefined,
        normalRange: normalRange.trim() || undefined,
        parameters: isProfile
          ? clean.map((p) => ({ parameterTestId: p.parameterTestId || undefined, name: p.name.trim(), unit: p.unit.trim() || undefined, normalRange: p.normalRange.trim() || undefined }))
          : [],
      });
      toast.success("Lab structure saved");
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to save lab structure"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ScienceRounded sx={{ color: ACCENT }} /> Lab test structure
        <Typography variant="caption" sx={{ display: "block", color: "text.secondary", width: "100%" }}>{itemName}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={26} /></Box>
        ) : isError ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>Couldn't load the structure.</Typography>
            <Button size="small" variant="outlined" onClick={() => refetch()}>Retry</Button>
          </Box>
        ) : (
          <>
            <ToggleButtonGroup exclusive size="small" value={isProfile ? "profile" : "single"}
              onChange={(_, v) => { if (v) setIsProfile(v === "profile"); }} sx={{ mb: 2 }}>
              <ToggleButton value="single" sx={{ textTransform: "none" }}>Single test</ToggleButton>
              <ToggleButton value="profile" sx={{ textTransform: "none" }}>Profile (panel)</ToggleButton>
            </ToggleButtonGroup>

            {!isProfile ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Unit (optional)" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth placeholder="e.g. g/dL" />
                <TextField label="Reference range (optional)" value={normalRange} onChange={(e) => setNormalRange(e.target.value)} fullWidth placeholder="e.g. 13–17" />
              </Stack>
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Parameters</Typography>
                <Stack spacing={1}>
                  {params.map((p, i) => (
                    <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <TextField size="small" label="Name" value={p.name} onChange={(e) => setParam(i, "name", e.target.value)} sx={{ flex: 2 }} />
                      <TextField size="small" label="Unit" value={p.unit} onChange={(e) => setParam(i, "unit", e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Reference range" value={p.normalRange} onChange={(e) => setParam(i, "normalRange", e.target.value)} sx={{ flex: 1.5 }} />
                      <IconButton size="small" onClick={() => removeParam(i)}><DeleteOutlineRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton>
                    </Box>
                  ))}
                  {params.length === 0 && <Typography variant="body2" sx={{ color: "text.secondary" }}>No parameters yet.</Typography>}
                </Stack>
                <Button startIcon={<AddRounded />} onClick={addParam} sx={{ mt: 1, textTransform: "none", color: ACCENT }}>Add parameter</Button>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || isLoading} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
