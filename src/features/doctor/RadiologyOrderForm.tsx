import { BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, TextField, IconButton,
  Paper, MenuItem, Link
} from "@mui/material";
import RadiologyTestPicker, { type PickedRadTest } from "@/components/lab/RadiologyTestPicker";
import type { RadiologyOrderRow, RadiologyReportRow } from "@/features/lab/labOrders.types";
import { SaveRounded, CameraAltRounded, DescriptionRounded, AddRounded, DeleteRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { assetUrl } from "@/utils/assetUrl";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

const DOCTOR_BLUE = BRAND.action;

/** One scan queued for submission. price is display-only — the server prices from SOC. */
type RadiologyScanLine = { chargeItemId: string; scanType: string; radiologistNotes: string; price: number };

interface RadiologyOrderFormProps {
  consultationId?: string | null;
  patientId?: string;
  onRequireSave: () => Promise<string | undefined>;
}

const priorities = [
  { value: 1, label: "Routine" },
  { value: 2, label: "Urgent" },
  { value: 3, label: "STAT" }
];

export default function RadiologyOrderForm({ consultationId, patientId, onRequireSave }: RadiologyOrderFormProps) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  // Form state — the test is chosen from the SOC radiology catalogue via a picker,
  // so its chargeItemId is the price master.
  const [selectedTest, setSelectedTest] = useState<PickedRadTest | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState(1);
  const [radiologistNotes, setRadiologistNotes] = useState("");
  // A radiology order holds one scan, so ordering several means several orders.
  // Notes ride on each line: "suspected tibial fracture" belongs to the X-ray,
  // not to a chest CT ordered in the same breath.
  const [basket, setBasket] = useState<RadiologyScanLine[]>([]);

  const lineFor = (t: PickedRadTest): RadiologyScanLine => ({
    chargeItemId: t.chargeItemId,
    scanType: t.testName,
    radiologistNotes: radiologistNotes.trim(),
    price: Number(t.price),
  });

  const addToBasket = () => {
    if (!selectedTest) return;
    setBasket((prev) => [...prev, lineFor(selectedTest)]);
    setSelectedTest(null);
    setRadiologistNotes("");
  };
  const removeFromBasket = (idx: number) => setBasket((prev) => prev.filter((_, i) => i !== idx));

  // A scan picked but not yet "added" still counts, so ordering a single scan
  // needs no extra Add click — Add is only for stacking several.
  const effectiveScans = selectedTest ? [...basket, lineFor(selectedTest)] : basket;
  const estTotal = effectiveScans.reduce((sum, s) => sum + (s.price || 0), 0);

  const { data: existingOrders = [], isLoading: loading, isError, error, refetch } = useQuery<RadiologyOrderRow[]>({
    queryKey: ["radiology-orders", consultationId],
    queryFn: async () => (await axiosInstance.get(`/doctor/radiology-orders/consultations/${consultationId}`)).data.data || [],
    enabled: !!consultationId,
  });

  const handleSubmit = async () => {
    if (effectiveScans.length === 0) {
      toast.error("Please select a radiology test.");
      return;
    }

    try {
      setSaving(true);
      let targetConsultationId = consultationId;

      if (!targetConsultationId) {
        targetConsultationId = await onRequireSave();
        if (!targetConsultationId) {
          throw new Error("Could not create consultation draft. Save failed.");
        }
      }

      // Send each SOC test's chargeItemId (price master) + its name for display.
      await axiosInstance.post(`/doctor/radiology-orders/consultations/${targetConsultationId}`, {
        patientId,
        priorityId: selectedPriority,
        scans: effectiveScans.map((s) => ({
          chargeItemId: s.chargeItemId,
          scanType: s.scanType,
          radiologistNotes: s.radiologistNotes,
        })),
      });

      toast.success(`${effectiveScans.length} radiology order${effectiveScans.length === 1 ? "" : "s"} created successfully!`);
      setSelectedTest(null);
      setSelectedPriority(1);
      setRadiologistNotes("");
      setBasket([]);
      // Refresh list (covers both the existing consultation and a freshly-created one)
      qc.invalidateQueries({ queryKey: ["radiology-orders"] });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, (err instanceof Error && err.message) || "Failed to create radiology order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
<Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Create Radiology Order</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Button variant="outlined" startIcon={<CameraAltRounded />} onClick={() => setPickerOpen(true)}
              sx={{ textTransform: "none" }}>
              {selectedTest ? "Change test" : "Select radiology test"}
            </Button>
            {selectedTest && (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedTest.testName} <Typography component="span" sx={{ color: "text.secondary" }}>· ₹{Number(selectedTest.price).toFixed(0)}</Typography>
              </Typography>
            )}
            <Button onClick={addToBasket} disabled={!selectedTest} startIcon={<AddRounded />}
              sx={{ textTransform: "none", ml: "auto", color: DOCTOR_BLUE }}>
              Add another
            </Button>
          </Box>

          {basket.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {basket.map((s, idx) => (
                <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: "action.hover" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.scanType}</Typography>
                    {s.radiologistNotes && (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{s.radiologistNotes}</Typography>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>₹{(s.price || 0).toFixed(0)}</Typography>
                  <IconButton size="small" onClick={() => removeFromBasket(idx)} aria-label={`Remove ${s.scanType}`}>
                    <DeleteRounded fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
          <TextField
            select
            fullWidth
            size="small"
            label="Priority"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(Number(e.target.value))}
          >
            {priorities.map(p => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Clinical Notes for Radiologist"
            placeholder="e.g. Suspected fracture in left tibia..."
            value={radiologistNotes}
            onChange={(e) => setRadiologistNotes(e.target.value)}
          />
        </Box>
        
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, mt: 2 }}>
          {effectiveScans.length > 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {effectiveScans.length} scan{effectiveScans.length === 1 ? "" : "s"} · <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>₹{estTotal.toFixed(0)}</Box>
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            sx={{ bgcolor: DOCTOR_BLUE }}
            onClick={handleSubmit}
            disabled={saving || effectiveScans.length === 0}
          >
            Submit Radiology Order{effectiveScans.length > 1 ? "s" : ""}
          </Button>
        </Box>
      </Paper>

      {/* Existing Orders */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <CameraAltRounded sx={{ color: "text.secondary" }} fontSize="small" /> Previously Ordered Scans
        </Typography>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, "Failed to load radiology orders")} onRetry={refetch} />
        ) : existingOrders.length === 0 ? (
          <Mascot pose="nothing-here-yet" subtitle="No radiology orders for this consultation yet." size={130} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {existingOrders.map((order, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {order.scanType}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                    Priority: {priorities.find(p => p.value === order.priorityId)?.label || "Unknown"}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                  {order.radiologistNotes || "No clinical notes provided."}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Status:</Typography>
                  <Typography variant="caption" sx={{
                    color: order.status === "PENDING" ? "warning.main" : "success.main",
                    fontWeight: 600
                  }}>
                    {order.status}
                  </Typography>
                </Box>

                {/* Radiologist's report(s): findings/impression + a link to any
                    uploaded file. Populated once the radiologist saves results
                    or uploads a report from the lab queue. */}
                {Array.isArray(order.reports) && order.reports.length > 0 && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                      <DescriptionRounded fontSize="inherit" /> Report
                    </Typography>
                    {order.reports.map((r: RadiologyReportRow, rIdx: number) => (
                      <Box key={rIdx} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {r.findings && (
                          <Typography variant="body2"><strong>Findings:</strong> {r.findings}</Typography>
                        )}
                        {r.impression && (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}><strong>Impression:</strong> {r.impression}</Typography>
                        )}
                        {r.reportUrl && (
                          <Link href={assetUrl(r.reportUrl)} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                            View Report File
                          </Link>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      <RadiologyTestPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => setSelectedTest(t)}
        catalogUrl="/doctor/radiology-orders/catalog"
        accent={DOCTOR_BLUE}
      />
    </Box>
  );
}
