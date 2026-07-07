import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Grid, TextField, Slider,
  Alert, Divider, IconButton, Chip,
} from "@mui/material";
import {
  CloseRounded, FavoriteRounded, ThermostatRounded, MonitorHeartRounded,
  ScaleRounded, HeightRounded, BloodtypeRounded, SaveRounded,
  SentimentVeryDissatisfied, SentimentSatisfied, SentimentVerySatisfied,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import { useToast } from "../../contexts/ToastContext";

interface VitalsModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientId?: string;
  patientName: string;
  onSaved?: () => void;
  readonly?: boolean;
  // Where to READ vitals from. Defaults to the reception endpoint (used by the
  // reception + nurse panels). The doctor panel can't reach /reception/* — it
  // passes its own /doctor/... read path so "View Vitals" doesn't 403 into a
  // blank form. The save endpoint is unaffected (only used when !readonly, i.e.
  // never in the doctor's read-only view).
  readUrl?: string;
}

const defaultVitals = {
  bpSystolic: "",
  bpDiastolic: "",
  pulseRate: "",
  temperatureC: "",
  oxygenSaturation: "",
  heightCm: "",
  weightKg: "",
  bloodSugarLevel: "",
  painScale: 0,
  notes: "",
  ecgRequired: false,
};

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, mt: 1 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(6,182,212,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
      <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700, letterSpacing: 0.3 }}>
        {label}
      </Typography>
    </Box>
  );
}

function VitalInput({
  label, name, value, onChange, unit, type = "number", placeholder, readonly = false
}: {
  label: string; name: string; value: string; onChange: (e: any) => void;
  unit?: string; type?: string; placeholder?: string; readonly?: boolean;
}) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      InputProps={{
        readOnly: readonly,
        endAdornment: unit ? (
          <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap", pl: 0.5 }}>
            {unit}
          </Typography>
        ) : undefined,
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          "& fieldset": { borderColor: "rgba(100,116,139,0.3)" },
          "&:hover fieldset": { borderColor: "rgba(6,182,212,0.5)" },
          "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
        },
        "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
      }}
    />
  );
}

export default function VitalsModal({ open, onClose, appointmentId, patientId, patientName, onSaved, readonly = false, readUrl }: VitalsModalProps) {
  const vitalsReadUrl = readUrl || `/reception/appointments/${appointmentId}/vitals`;
  const [form, setForm] = useState(defaultVitals);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  // Vitals load only when the dialog is open. A missing record is a normal
  // state (patient has no vitals yet), so query errors are intentionally not
  // surfaced — the form just falls back to defaults.
  const { data: existingVitals, isLoading: loading } = useQuery({
    queryKey: ["vitals", appointmentId, vitalsReadUrl],
    queryFn: async () => (await axiosInstance.get(vitalsReadUrl)).data.data,
    enabled: open && !!appointmentId,
  });
  // BMI calculation
  const bmi = form.heightCm && form.weightKg
    ? (Number(form.weightKg) / Math.pow(Number(form.heightCm) / 100, 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? Number(bmi) < 18.5 ? { label: "Underweight", color: "#3b82f6" }
      : Number(bmi) < 25 ? { label: "Normal", color: "#10b981" }
        : Number(bmi) < 30 ? { label: "Overweight", color: "#f59e0b" }
          : { label: "Obese", color: "#ef4444" }
    : null;

  const painIcon = form.painScale <= 3
    ? <SentimentVerySatisfied sx={{ color: "#10b981" }} />
    : form.painScale <= 6
      ? <SentimentSatisfied sx={{ color: "#f59e0b" }} />
      : <SentimentVeryDissatisfied sx={{ color: "#ef4444" }} />;

  const painColor = form.painScale <= 3 ? "#10b981" : form.painScale <= 6 ? "#f59e0b" : "#ef4444";

  // Seed the form when the dialog opens (with fetched/cached vitals), and
  // reset to defaults when it closes.
  useEffect(() => {
    if (!open) {
      setForm(defaultVitals);
      setSuccess(false);
      return;
    }
    if (existingVitals) {
      const v = existingVitals;
      setForm({
        bpSystolic: v.bpSystolic || "",
        bpDiastolic: v.bpDiastolic || "",
        pulseRate: v.pulseRate || "",
        temperatureC: v.temperatureC || "",
        oxygenSaturation: v.oxygenSaturation || "",
        heightCm: v.heightCm || "",
        weightKg: v.weightKg || "",
        bloodSugarLevel: v.bloodSugarLevel || "",
        painScale: v.painScale || 0,
        notes: v.notes || "",
        ecgRequired: v.ecgRequired || false,
      });
    }
  }, [open, existingVitals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/reception/vitals", {
        appointmentId,
        patientId,
        ...form,
        bpSystolic: Number(form.bpSystolic) || 0,
        bpDiastolic: Number(form.bpDiastolic) || 0,
        pulseRate: Number(form.pulseRate) || 0,
        temperatureC: Number(form.temperatureC) || 0,
        oxygenSaturation: Number(form.oxygenSaturation) || 0,
        heightCm: Number(form.heightCm) || 0,
        weightKg: Number(form.weightKg) || 0,
        bloodSugarLevel: Number(form.bloodSugarLevel) || 0,
        painScale: Number(form.painScale) || 0,
      });
      setSuccess(true);
      toast.success("Vitals saved successfully");
      onSaved?.();
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save vitals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          backgroundImage: "none",
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          maxHeight: "90vh",
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            px: 3, py: 2.5,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid", borderColor: "divider",
            background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(16,185,129,0.05) 100%)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 2,
                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(6,182,212,0.3)",
              }}
            >
              <MonitorHeartRounded sx={{ color: "#fff", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, lineHeight: 1 }}>
                Record Vitals
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {patientName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
            <CloseRounded />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, overflowY: "auto" }}>
        {loading ? (
          <PageLoader />
        ) : (
          <>
{/* ── Section 1: Blood Pressure & Pulse ── */}
            <SectionHeader icon={<FavoriteRounded sx={{ color: "#ef4444", fontSize: 20 }} />} label="Cardiovascular" />
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <VitalInput label="Systolic BP" name="bpSystolic" value={form.bpSystolic} onChange={handleChange} unit="mmHg" placeholder="120" readonly={readonly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <VitalInput label="Diastolic BP" name="bpDiastolic" value={form.bpDiastolic} onChange={handleChange} unit="mmHg" placeholder="80" readonly={readonly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <VitalInput label="Pulse Rate" name="pulseRate" value={form.pulseRate} onChange={handleChange} unit="bpm" placeholder="72" readonly={readonly} />
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: "divider", mb: 2 }} />

            {/* ── Section 2: Temperature & SpO2 ── */}
            <SectionHeader icon={<ThermostatRounded sx={{ color: "#f59e0b", fontSize: 20 }} />} label="Respiratory & Temperature" />
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <VitalInput label="Temperature" name="temperatureC" value={form.temperatureC} onChange={handleChange} unit="°C" placeholder="37.0" readonly={readonly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <VitalInput label="Oxygen Saturation (SpO₂)" name="oxygenSaturation" value={form.oxygenSaturation} onChange={handleChange} unit="%" placeholder="98" readonly={readonly} />
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: "divider", mb: 2 }} />

            {/* ── Section 3: Height, Weight & BMI ── */}
            <SectionHeader icon={<ScaleRounded sx={{ color: "#10b981", fontSize: 20 }} />} label="Anthropometrics" />
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <VitalInput label="Height" name="heightCm" value={form.heightCm} onChange={handleChange} unit="cm" placeholder="170" readonly={readonly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <VitalInput label="Weight" name="weightKg" value={form.weightKg} onChange={handleChange} unit="kg" placeholder="70" readonly={readonly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <Box
                  sx={{
                    height: "100%", minHeight: 40, borderRadius: 1.5,
                    border: "1px dashed", borderColor: bmiCategory ? bmiCategory.color : "divider",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", bgcolor: bmiCategory ? `${bmiCategory.color}11` : "transparent",
                    px: 1,
                  }}
                >
                  {bmi ? (
                    <>
                      <Typography variant="h6" sx={{ color: bmiCategory?.color, fontWeight: 800, lineHeight: 1 }}>{bmi}</Typography>
                      <Typography variant="caption" sx={{ color: bmiCategory?.color, fontSize: "0.75rem", fontWeight: 600 }}>BMI</Typography>
                      <Typography variant="caption" sx={{ color: bmiCategory?.color, fontSize: "0.75rem" }}>{bmiCategory?.label}</Typography>
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center", fontSize: "0.75rem" }}>BMI auto</Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: "divider", mb: 2 }} />

            {/* ── Section 4: Blood Sugar ── */}
            <SectionHeader icon={<BloodtypeRounded sx={{ color: "#8b5cf6", fontSize: 20 }} />} label="Blood Sugar" />
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <VitalInput label="Blood Sugar Level" name="bloodSugarLevel" value={form.bloodSugarLevel} onChange={handleChange} unit="mg/dL" placeholder="90" readonly={readonly} />
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: "divider", mb: 2 }} />

            {/* ── Section 5: Pain Scale ── */}
            <SectionHeader icon={painIcon} label={`Pain Scale — ${form.painScale}/10`} />
            <Box sx={{ px: 1, mb: 3 }}>
              <Slider
                value={form.painScale}
                onChange={(_, val) => setForm(prev => ({ ...prev, painScale: val as number }))}
                min={0} max={10} step={1}
                disabled={readonly}
                marks={[
                  { value: 0, label: "0\nNone" },
                  { value: 5, label: "5\nModerate" },
                  { value: 10, label: "10\nWorst" },
                ]}
                valueLabelDisplay="auto"
                sx={{
                  color: painColor,
                  "& .MuiSlider-thumb": { boxShadow: `0 0 0 4px ${painColor}22` },
                  "& .MuiSlider-markLabel": { color: "text.secondary", fontSize: "0.75rem" },
                }}
              />
            </Box>

            <Divider sx={{ borderColor: "divider", mb: 2 }} />

            {/* ── Notes ── */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Clinical Notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any additional observations, symptoms, or nurse notes..."
              InputProps={{ readOnly: readonly }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(100,116,139,0.3)" },
                  "&:hover fieldset": { borderColor: "rgba(6,182,212,0.5)" },
                  "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
                },
                "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
              }}
            />
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3, py: 2,
          borderTop: "1px solid", borderColor: "divider",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {bmi && (
            <Chip
              label={`BMI: ${bmi} — ${bmiCategory?.label}`}
              size="small"
              sx={{ bgcolor: `${bmiCategory?.color}22`, color: bmiCategory?.color, fontWeight: 600, fontSize: "0.75rem" }}
            />
          )}
          {form.bpSystolic && form.bpDiastolic && (
            <Chip
              label={`BP: ${form.bpSystolic}/${form.bpDiastolic} mmHg`}
              size="small"
              sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#f87171", fontWeight: 600, fontSize: "0.75rem" }}
            />
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none", "&:hover": { borderColor: "text.secondary" } }}
          >
            Cancel
          </Button>
          {!readonly && (
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={saving || success}
              startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
              id="vitals-save-button"
              sx={{
                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                boxShadow: "0 4px 12px rgba(6,182,212,0.3)",
                "&:hover": { background: "linear-gradient(135deg, #0891b2, #0e7490)" },
              }}
            >
              {saving ? "Saving..." : success ? "Saved!" : "Save Vitals"}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
