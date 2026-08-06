import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogActions, Button, TextField,
  Box, Typography, IconButton, Chip, CircularProgress, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AddRounded, DeleteOutlineRounded, ScienceRounded, BiotechRounded,
  FormatListBulletedRounded, CheckCircleRounded, CloseRounded,
} from "@mui/icons-material";
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

  const validCount = params.filter((p) => p.name.trim()).length;

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
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.12), color: ACCENT, flexShrink: 0 }}>
          <ScienceRounded />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>Lab test structure</Typography>
          <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>{itemName}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving}><CloseRounded fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ height: 470, display: "flex", flexDirection: "column", gap: 2, p: 2.25 }}>
        {isLoading ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}><CircularProgress size={28} sx={{ color: ACCENT }} /></Box>
        ) : isError ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center" }}>
            <Box>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>Couldn't load the structure.</Typography>
              <Button size="small" variant="outlined" onClick={() => refetch()}>Retry</Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Mode picker — two selectable cards */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <ModeCard
                selected={!isProfile} onClick={() => setIsProfile(false)}
                icon={<BiotechRounded />} title="Single test"
                desc="One result value, with an optional unit & reference range."
              />
              <ModeCard
                selected={isProfile} onClick={() => setIsProfile(true)}
                icon={<FormatListBulletedRounded />} title="Profile / Panel"
                desc="Several parameters — each becomes its own result line."
              />
            </Box>

            {!isProfile ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0 }}>
                <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
                  <TextField label="Unit (optional)" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth placeholder="e.g. g/dL" />
                  <TextField label="Reference range (optional)" value={normalRange} onChange={(e) => setNormalRange(e.target.value)} fullWidth placeholder="e.g. 13–17" />
                </Box>
                {/* Live preview of how a technician will enter the result */}
                <Box sx={{ mt: "auto", p: 1.75, borderRadius: 2, bgcolor: alpha(ACCENT, 0.05), border: `1px dashed ${alpha(ACCENT, 0.35)}` }}>
                  <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 0.5 }}>Result entry preview</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>{itemName}</Typography>
                    <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", color: "text.disabled", fontSize: "0.85rem" }}>value</Box>
                    {unit.trim() && <Typography variant="body2" sx={{ color: "text.secondary" }}>{unit.trim()}</Typography>}
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Normal: <b style={{ color: normalRange.trim() ? undefined : "var(--mui-palette-text-disabled)" }}>{normalRange.trim() || "—"}</b>
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Parameters</Typography>
                  {validCount > 0 && <Chip size="small" label={validCount} sx={{ height: 20, fontWeight: 700, bgcolor: alpha(ACCENT, 0.14), color: ACCENT }} />}
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" startIcon={<AddRounded />} onClick={addParam} sx={{ textTransform: "none", color: ACCENT }}>Add parameter</Button>
                </Box>

                {params.length === 0 ? (
                  <Box sx={{ flex: 1, display: "grid", placeItems: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 3, textAlign: "center" }}>
                    <Box>
                      <FormatListBulletedRounded sx={{ fontSize: 34, color: "text.disabled", mb: 0.5 }} />
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>No parameters yet — a panel needs at least one.</Typography>
                      <Button variant="outlined" size="small" startIcon={<AddRounded />} onClick={addParam} sx={{ textTransform: "none", color: ACCENT, borderColor: alpha(ACCENT, 0.5) }}>Add first parameter</Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    {/* Column headers */}
                    <Box sx={{ display: "flex", gap: 1, px: 0.5, pb: 0.5, color: "text.secondary" }}>
                      <Typography variant="caption" sx={{ width: 22 }}>#</Typography>
                      <Typography variant="caption" sx={{ flex: 2, fontWeight: 700 }}>Parameter name</Typography>
                      <Typography variant="caption" sx={{ flex: 1, fontWeight: 700 }}>Unit</Typography>
                      <Typography variant="caption" sx={{ flex: 1.5, fontWeight: 700 }}>Reference range</Typography>
                      <Box sx={{ width: 32 }} />
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                      {params.map((p, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                          <Typography variant="caption" sx={{ width: 22, textAlign: "center", color: "text.disabled", fontWeight: 700 }}>{i + 1}</Typography>
                          <TextField size="small" placeholder="e.g. Hemoglobin" value={p.name} onChange={(e) => setParam(i, "name", e.target.value)} sx={{ flex: 2 }} />
                          <TextField size="small" placeholder="g/dL" value={p.unit} onChange={(e) => setParam(i, "unit", e.target.value)} sx={{ flex: 1 }} />
                          <TextField size="small" placeholder="13–17" value={p.normalRange} onChange={(e) => setParam(i, "normalRange", e.target.value)} sx={{ flex: 1.5 }} />
                          <Tooltip title="Remove parameter">
                            <IconButton size="small" onClick={() => removeParam(i)} sx={{ width: 32 }}><DeleteOutlineRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.25, py: 1.75, borderTop: "1px solid", borderColor: "divider" }}>
        <Button color="inherit" onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: "text.secondary" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || isLoading || (isProfile && validCount === 0)}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <CheckCircleRounded />}
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: ACCENT, "&:hover": { bgcolor: "#0e9f6e" } }}>
          {saving ? "Saving…" : "Save structure"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// A selectable mode tile.
function ModeCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Box
      role="button" onClick={onClick}
      sx={{
        cursor: "pointer", p: 1.5, borderRadius: 2, position: "relative",
        border: "1.5px solid", borderColor: selected ? ACCENT : "divider",
        bgcolor: selected ? alpha(ACCENT, 0.06) : "transparent",
        transition: "border-color .12s, background-color .12s",
        "&:hover": { borderColor: selected ? ACCENT : alpha(ACCENT, 0.5) },
      }}
    >
      {selected && <CheckCircleRounded sx={{ position: "absolute", top: 8, right: 8, fontSize: 18, color: ACCENT }} />}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, color: selected ? ACCENT : "text.primary" }}>
        {icon}
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.35 }}>{desc}</Typography>
    </Box>
  );
}
