import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, CircularProgress,
  Paper, Grid, Alert, MenuItem
} from "@mui/material";
import { SaveRounded, CameraAltRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [existingOrders, setExistingOrders] = useState<any[]>([]);

  // Form state
  const [selectedScanType, setSelectedScanType] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState(1);
  const [radiologistNotes, setRadiologistNotes] = useState("");

  useEffect(() => {
    if (consultationId) {
      fetchExistingOrders(consultationId);
    }
  }, [consultationId]);

  const fetchExistingOrders = async (id: string) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/doctor/radiology-orders/consultations/${id}`);
      setExistingOrders(res.data.data || []);
    } catch (err) {
      console.error("Failed to load radiology orders", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedScanType) {
      setError("Please select a scan type.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

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

      setSuccess("Radiology order created successfully!");
      setSelectedScanType("");
      setSelectedPriority(1);
      setRadiologistNotes("");
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh list
      fetchExistingOrders(targetConsultationId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create radiology order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {success && <Alert severity="success">{success}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

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
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
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
          <CircularProgress size={24} />
        ) : existingOrders.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>No radiology orders for this consultation.</Typography>
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
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
