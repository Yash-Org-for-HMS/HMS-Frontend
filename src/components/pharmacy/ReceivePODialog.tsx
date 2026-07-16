import { useEffect, useState } from "react";
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button } from "@mui/material";
import { axiosInstance } from "../../api/axios";
import { getApiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  /** The PO being received; null closes the dialog. */
  po: any | null;
  onClose: () => void;
  suppliers: any[];
  getMedicineName: (id: string) => string;
  /** Refresh inventory / POs / reference after a successful receipt. */
  onReceived: () => void | Promise<void>;
}

/**
 * Receive goods against a PO (supports partial receipts — a line left at 0 is
 * skipped and stays open). Extracted verbatim from InventoryManagement; owns its
 * own receive form state, seeded whenever a PO is opened.
 */
export default function ReceivePODialog({ po, onClose, suppliers, getMedicineName, onReceived }: Props) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [receiving, setReceiving] = useState(false);

  useEffect(() => {
    if (!po) return;
    setSupplierId(po.supplierId || "");
    // Only show items with something still outstanding.
    setItems(
      po.items
        .filter((item: any) => item.orderedQuantity - item.receivedQuantity > 0)
        .map((item: any) => ({
          ...item,
          receivedQuantity: item.orderedQuantity - item.receivedQuantity,
          batchNumber: "",
          expiryDate: "",
        }))
    );
  }, [po]);

  const handleReceive = async () => {
    if (!po.supplierId && !supplierId) {
      toast.error("Please select a supplier for this PO before receiving.");
      return;
    }
    const itemsToReceive = items.filter(i => Number(i.receivedQuantity) > 0);
    if (itemsToReceive.length === 0) {
      toast.error("Enter a received quantity greater than 0 for at least one item.");
      return;
    }
    if (itemsToReceive.some(i => !i.batchNumber || !i.expiryDate)) {
      toast.error("Please enter batch number and expiry date for each item you're receiving.");
      return;
    }
    try {
      setReceiving(true);
      await axiosInstance.put(`/pharmacy/purchase-orders/${po.purchaseOrderId}/receive`, {
        receivedItems: itemsToReceive.map(item => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          medicineId: item.medicineId,
          receivedQuantity: item.receivedQuantity,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          supplierId: po.supplierId || supplierId,
        })),
      });
      onClose();
      await onReceived();
    } catch (err: any) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Failed to receive PO"));
    } finally {
      setReceiving(false);
    }
  };

  return (
    <Dialog open={!!po} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Receive Goods (PO: {po?.purchaseOrderId.split('-')[0].toUpperCase()})</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {!po?.supplierId && (
          <TextField
            select
            label="Assign Supplier"
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            fullWidth
            SelectProps={{ native: true }}
            helperText="This Auto-Generated PO is missing a supplier. Please assign one."
            error={!supplierId}
          >
            <option value=""></option>
            {suppliers.map(sup => (
              <option key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</option>
            ))}
          </TextField>
        )}
        {items.map((item, idx) => (
          <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="primary">{getMedicineName(item.medicineId)}</Typography>
              <Typography variant="caption" color="text.secondary">Ordered: {item.orderedQuantity}</Typography>
            </Box>
            <TextField type="number" label="Receiving Qty" size="small" value={item.receivedQuantity} onChange={e => {
              const newItems = [...items];
              newItems[idx].receivedQuantity = parseInt(e.target.value) || 0;
              setItems(newItems);
            }} />
            <TextField label="Batch No." size="small" value={item.batchNumber} onChange={e => {
              const newItems = [...items];
              newItems[idx].batchNumber = e.target.value;
              setItems(newItems);
            }} />
            <TextField type="date" label="Expiry" size="small" InputLabelProps={{ shrink: true }} value={item.expiryDate} onChange={e => {
              const newItems = [...items];
              newItems[idx].expiryDate = e.target.value;
              setItems(newItems);
            }} />
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleReceive} variant="contained" color="success" disabled={receiving}>{receiving ? "Processing..." : "Confirm Receipt"}</Button>
      </DialogActions>
    </Dialog>
  );
}
