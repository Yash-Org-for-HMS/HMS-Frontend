import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, TextField,
  Paper, Grid, Alert, MenuItem, Link
} from "@mui/material";
import { SaveRounded, CameraAltRounded, DescriptionRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { assetUrl } from "../../utils/assetUrl";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../../components/HeartbeatLoader";

const DOCTOR_BLUE = "#3b82f6";

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

const scanTypes = [
  "X-Ray",
  "CT Scan",
  "MRI Scan",
  "Ultrasound",
  "PET Scan",
  "Mammography"
];

export default function RadiologyOrderForm({ consultationId, patientId, onRequireSave }: RadiologyOrderFormProps) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  // Form state
  const [selectedScanType, setSelectedScanType] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState(1);
  const [radiologistNotes, setRadiologistNotes] = useState("");

  const { data: existingOrders = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["radiology-orders", consultationId],
    queryFn: async () => (await axiosInstance.get(`/doctor/radiology-orders/consultations/${consultationId}`)).data.data || [],
    enabled: !!consultationId,
  });

  const handleSubmit = async () => {
    if (!selectedScanType) {
      toast.error("Please select a scan type.");
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

      await axiosInstance.post(`/doctor/radiology-orders/consultations/${targetConsultationId}`, {
        patientId,
        priorityId: selectedPriority,
        scanType: selectedScanType,
        radiologistNotes
      });

      toast.success("Radiology order created successfully!");
      setSelectedScanType("");
      setSelectedPriority(1);
      setRadiologistNotes("");
      // Refresh list (covers both the existing consultation and a freshly-created one)
      qc.invalidateQueries({ queryKey: ["radiology-orders"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create radiology order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
<Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Create Radiology Order</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Scan Type"
            value={selectedScanType}
            onChange={(e) => setSelectedScanType(e.target.value)}
          >
            {scanTypes.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
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
        
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <Button 
            variant="contained" 
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            sx={{ bgcolor: DOCTOR_BLUE }}
            onClick={handleSubmit}
            disabled={saving}
          >
            Submit Radiology Order
          </Button>
        </Box>
      </Paper>

      {/* Existing Orders */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <CameraAltRounded sx={{ color: "text.secondary" }} fontSize="small" /> Previously Ordered Scans
        </Typography>
        {loading ? (
          <HeartbeatLoader size={48} />
        ) : isError ? (
          <ErrorState message={(error as any)?.response?.data?.message || "Failed to load radiology orders"} onRetry={refetch} />
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
                    {order.reports.map((r: any, rIdx: number) => (
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
    </Box>
  );
}
