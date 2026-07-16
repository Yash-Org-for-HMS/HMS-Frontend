import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button } from "@mui/material";
import { axiosInstance } from "../../api/axios";
import { getApiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  /** The inventory row being corrected; null closes the dialog. */
  item: any | null;
  onClose: () => void;
  /** Resolve a medicine id to its display name (owned by the parent's catalog). */
  getMedicineName: (id: string) => string;
  /** Called after a successful save so the parent can refresh its inventory list. */
  onSaved: () => void | Promise<void>;
}

/**
 * Correct a mis-entered batch number / expiry date on an already-received
 * inventory row. Quantity isn't editable here — that only moves via a tracked
 * stock transaction (receiving, dispensing, ward issue/return).
 *
 * Extracted verbatim from InventoryManagement; owns only its own form state.
 */
export default function EditBatchDialog({ item, onClose, getMedicineName, onSaved }: Props) {
  const toast = useToast();
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed the form from the row whenever a new one is opened.
  useEffect(() => {
    if (!item) return;
    setBatchNumber(item.batchNumber || "");
    setExpiryDate(item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "");
  }, [item]);

  const handleSave = async () => {
    if (!item || !batchNumber.trim() || !expiryDate) {
      toast.error("Batch number and expiry date are required.");
      return;
    }
    try {
      setSaving(true);
      await axiosInstance.put(`/pharmacy/inventory/${item.inventoryId}`, {
        batchNumber: batchNumber.trim(),
        expiryDate,
      });
      toast.success("Batch updated");
      onClose();
      await onSaved();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update this batch"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Batch — {item ? getMedicineName(item.medicineId) : ""}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
        <TextField
          label="Batch No."
          value={batchNumber}
          onChange={e => setBatchNumber(e.target.value)}
          fullWidth
          required
        />
        <TextField
          type="date"
          label="Expiry Date"
          InputLabelProps={{ shrink: true }}
          value={expiryDate}
          onChange={e => setExpiryDate(e.target.value)}
          fullWidth
          required
        />
        <Typography variant="caption" color="text.secondary">
          Quantity isn't editable here — it only changes via receiving, dispensing, or ward stock issue/return.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
