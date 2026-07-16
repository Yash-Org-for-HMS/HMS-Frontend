import { useEffect, useState } from "react";
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button, MenuItem } from "@mui/material";
import { axiosInstance } from "../../api/axios";
import { getApiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  suppliers: any[];
  medicines: any[];
  /** Called after a PO is created so the parent can jump to page 1 and refresh. */
  onCreated: () => void | Promise<void>;
}

const emptyItem = () => ({ medicineId: "", orderedQuantity: 0, unitPrice: 0 });

/**
 * Raise a purchase order by hand (supplier + line items). Extracted verbatim
 * from InventoryManagement; owns its own form state, which resets each time the
 * dialog opens.
 */
export default function CreatePODialog({ open, onClose, suppliers, medicines, onCreated }: Props) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<any[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  // Fresh form each open (matches the previous reset on the "Create PO" button).
  useEffect(() => {
    if (open) {
      setSupplierId("");
      setItems([emptyItem()]);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!supplierId || items.some(item => !item.medicineId || item.orderedQuantity <= 0)) {
      toast.error("Please fill all fields properly.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        supplierId,
        orderDate: new Date(),
        items: items.map(item => ({ ...item, totalPrice: item.orderedQuantity * item.unitPrice })),
      };
      await axiosInstance.post("/pharmacy/purchase-orders", payload);
      onClose();
      await onCreated();
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage((err as any), "Failed to create PO"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Raise Purchase Order</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField select label="Supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)} fullWidth>
          {suppliers.map(sup => (
            <MenuItem key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</MenuItem>
          ))}
        </TextField>

        <Typography variant="subtitle2">Order Items</Typography>
        {items.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField select label="Medicine" value={item.medicineId} onChange={e => {
              const newItems = [...items];
              newItems[idx].medicineId = e.target.value;
              setItems(newItems);
            }} sx={{ flex: 2 }}>
              {medicines.map(med => <MenuItem key={med.medicineId} value={med.medicineId}>{med.medicineName} ({med.genericName})</MenuItem>)}
            </TextField>
            <TextField type="number" label="Qty" value={item.orderedQuantity} onChange={e => {
              const newItems = [...items];
              newItems[idx].orderedQuantity = parseInt(e.target.value) || 0;
              setItems(newItems);
            }} sx={{ flex: 1 }} />
            <TextField type="number" label="Unit Price" value={item.unitPrice} onChange={e => {
              const newItems = [...items];
              newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
              setItems(newItems);
            }} sx={{ flex: 1 }} />
          </Box>
        ))}
        <Button onClick={() => setItems([...items, emptyItem()])} variant="text" sx={{ alignSelf: 'flex-start' }}>
          + Add Item
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={saving}>{saving ? "Creating..." : "Create PO"}</Button>
      </DialogActions>
    </Dialog>
  );
}
