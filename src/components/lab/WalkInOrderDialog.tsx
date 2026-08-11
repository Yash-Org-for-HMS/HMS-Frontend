import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Autocomplete, MenuItem, Box, Typography, Chip,
} from "@mui/material";
import HeartbeatLoader from "../HeartbeatLoader";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import { CameraAltRounded, ScienceRounded } from "@mui/icons-material";
import RadiologyTestPicker, { type PickedRadTest } from "@/components/lab/RadiologyTestPicker";
import LabTestPicker, { type PickedLabTest } from "@/components/lab/LabTestPicker";
import { useToast } from "@/providers/ToastContext";

interface WalkInOrderDialogProps {
  open: boolean;
  kind: "lab" | "radiology";
  onClose: () => void;
  /** Called after a walk-in order is created so the caller can refetch its queue. */
  onCreated: () => void;
}

const PRIORITIES = [
  { value: 1, label: "Routine" },
  { value: 2, label: "Urgent" },
  { value: 3, label: "STAT" },
];

// Mirrors the doctor's RadiologyOrderForm scan list so walk-ins and
// consultation orders use the same scan vocabulary.

/**
 * Create a walk-in lab or radiology order (no originating consultation) for a
 * registered patient, straight from the lab counter. Mirrors how pharmacy
 * handles walk-in sales. The order is created UNPAID, so it shows up in the
 * patient's billing unbilled list.
 */
export default function WalkInOrderDialog({ open, kind, onClose, onCreated }: WalkInOrderDialogProps) {
  const toast = useToast();

  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [priority, setPriority] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Lab-specific — a basket of SOC lab tests picked via the browse picker.
  const [labBasket, setLabBasket] = useState<PickedLabTest[]>([]);
  const [labPickerOpen, setLabPickerOpen] = useState(false);
  // Radiology-specific — the test is chosen from the SOC radiology catalogue.
  const [selectedTest, setSelectedTest] = useState<PickedRadTest | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const labSelectedIds = new Set(labBasket.map((t) => t.chargeItemId));
  const toggleLabTest = (t: PickedLabTest) =>
    setLabBasket((prev) => prev.some((i) => i.chargeItemId === t.chargeItemId) ? prev.filter((i) => i.chargeItemId !== t.chargeItemId) : [...prev, t]);

  // Patient search (shared endpoint used by the billing screen). Only fires
  // once the user has typed enough to narrow results.
  const { data: patients = [], isFetching: searchingPatients } = useQuery<any[]>({
    queryKey: ["walkin-patient-search", patientQuery],
    queryFn: async () => (await axiosInstance.get("/reception/patients", { params: { search: patientQuery } })).data.data || [],
    enabled: open && patientQuery.trim().length >= 2,
  });

  const reset = () => {
    setPatientQuery("");
    setSelectedPatient(null);
    setPriority(1);
    setLabBasket([]);
    setSelectedTest(null);
    setNotes("");
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error("Please select a patient.");
      return;
    }
    if (kind === "lab" && labBasket.length === 0) {
      toast.error("Please add at least one test.");
      return;
    }
    if (kind === "radiology" && !selectedTest) {
      toast.error("Please select a radiology test.");
      return;
    }

    try {
      setSubmitting(true);
      if (kind === "lab") {
        await axiosInstance.post("/lab/orders", {
          patientId: selectedPatient.patientId,
          priorityId: priority,
          chargeItemIds: labBasket.map((t) => t.chargeItemId),
        });
      } else {
        await axiosInstance.post("/lab/radiology-orders", {
          patientId: selectedPatient.patientId,
          priorityId: priority,
          chargeItemId: selectedTest!.chargeItemId,
          scanType: selectedTest!.testName,
          radiologistNotes: notes,
        });
      }
      toast.success(`Walk-in ${kind === "lab" ? "lab" : "radiology"} order created`);
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to create walk-in order"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Walk-in {kind === "lab" ? "Lab" : "Radiology"} Order</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          <Autocomplete
            fullWidth
            options={patients}
            value={selectedPatient}
            loading={searchingPatients}
            getOptionLabel={(p) => (p ? `${p.firstName} ${p.lastName || ""} (${p.uhidNumber})` : "")}
            isOptionEqualToValue={(o, v) => o.patientId === v?.patientId}
            onInputChange={(_, v) => setPatientQuery(v)}
            onChange={(_, v) => setSelectedPatient(v)}
            noOptionsText={patientQuery.trim().length < 2 ? "Type at least 2 characters" : "No matching patients"}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Patient"
                placeholder="Search by name or UHID"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchingPatients ? <HeartbeatLoader size={22} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {kind === "lab" ? (
            <Box>
              <Button variant="outlined" startIcon={<ScienceRounded />} onClick={() => setLabPickerOpen(true)} sx={{ textTransform: "none" }}>
                {labBasket.length ? `${labBasket.length} test${labBasket.length === 1 ? "" : "s"} selected — add / change` : "Select lab tests"}
              </Button>
              {labBasket.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                  {labBasket.map((t) => (
                    <Chip key={t.chargeItemId} label={`${t.testName} · ${formatINR(Number(t.price))}`} size="small" onDelete={() => toggleLabTest(t)} />
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Button variant="outlined" startIcon={<CameraAltRounded />} onClick={() => setPickerOpen(true)} sx={{ textTransform: "none" }}>
                  {selectedTest ? "Change test" : "Select radiology test"}
                </Button>
                {selectedTest && (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedTest.testName} <Typography component="span" sx={{ color: "text.secondary" }}>· {formatINR(Number(selectedTest.price))}</Typography>
                  </Typography>
                )}
              </Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Clinical Notes for Radiologist"
                placeholder="e.g. Suspected fracture in left tibia..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </>
          )}

          <TextField select fullWidth label="Priority" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            {PRIORITIES.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>

          <Typography variant="caption" color="text.secondary">
            The order is created unpaid and will appear in the patient's billing list for invoicing.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? <HeartbeatLoader size={22} /> : "Create Order"}
        </Button>
      </DialogActions>
      <RadiologyTestPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => setSelectedTest(t)}
        catalogUrl="/lab/radiology-catalog"
      />
      <LabTestPicker
        open={labPickerOpen}
        onClose={() => setLabPickerOpen(false)}
        onToggle={toggleLabTest}
        selectedIds={labSelectedIds}
        catalogUrl="/lab/tests"
      />
    </Dialog>
  );
}
