import { useEffect, useState } from "react";
import { SEMANTIC } from "@/styles/accents";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button,
  MenuItem, Select, IconButton, Chip, Autocomplete, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";

const HEAD_SX = { fontWeight: 700, textTransform: "none", letterSpacing: "normal", fontSize: "inherit", color: "inherit" } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  lowStockAlerts: any[];
  medicines: any[];
  suppliers: any[];
  /** Refresh the parent (jump to page 1 + reload POs/reference) after generating. */
  onGenerated: () => void | Promise<void>;
}

// Suggested order qty / cost mirror the server's auto-generate formulas so the
// pre-filled numbers match what one-click generation would have produced.
// Nets out stock already on a pending PO — otherwise this would suggest
// ordering the full gap again on top of a delivery that's already in motion.
const suggestedQty = (minStock: number, currentStock: number, pendingStock: number) =>
  Math.max((minStock || 0) * 2 - (currentStock || 0) - (pendingStock || 0), 0);
/**
 * What to order a line at.
 *
 * `resolvedCost` is the server's answer — the latest supplier-confirmed price,
 * then one typed on the medicine. Falling back to a fraction of the SELLING
 * price is a last resort for a medicine nobody has ever costed; it was the
 * default here, so this screen offered 22.75 for a drug the same payload said
 * costs 20.40.
 */
const suggestedPrice = (med: any) =>
  med?.resolvedCost != null
    ? Number(med.resolvedCost)
    : Number(((Number(med?.sellingPrice) || 0) * 0.7).toFixed(2));
const rowFromMedicine = (med: any, currentStock: number | null, pendingStock: number, low: boolean) => ({
  medicineId: med.medicineId,
  medicineName: med.medicineName,
  genericName: med.genericName,
  currentStock,
  pendingStock,
  minStockLevel: med.minStockLevel ?? 0,
  // A low-stock row can legitimately suggest 0 (a pending PO already covers
  // the gap) — that row gets filtered out before it ever reaches here. A
  // hand-added row has no such "already covered" reading, so it always gets
  // at least 1.
  orderedQuantity: low
    ? suggestedQty(med.minStockLevel ?? 0, currentStock ?? 0, pendingStock)
    : Math.max(suggestedQty(med.minStockLevel ?? 0, currentStock ?? 0, pendingStock), med.minStockLevel || 1),
  unitPrice: suggestedPrice(med),
  // So the row can say where its price came from rather than implying it is known.
  costKnown: med?.resolvedCost != null,
  supplierId: med.defaultSupplierId || "",
  low,
});

/**
 * Reviewable auto-generate: pre-filled from the low-stock list with suggested
 * quantities/costs, but editable and extendable with hand-picked medicines
 * before the POs are created. Items are grouped by supplier into separate POs
 * (unsupplied items → one null-supplier PO). Extracted verbatim from
 * InventoryManagement; owns its own row/generating state.
 */
export default function AutoGeneratePODialog({ open, onClose, lowStockAlerts, medicines, suppliers, onGenerated }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Pre-fill one row per low-stock alert whenever the dialog opens — except
  // one already fully covered by a pending PO (suggested qty nets to 0),
  // which has nothing left to order.
  useEffect(() => {
    if (open) {
      setRows(
        lowStockAlerts
          .map((a) => rowFromMedicine(a, a.currentStock ?? 0, a.pendingStock ?? 0, true))
          .filter((r) => r.orderedQuantity > 0)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // How many low-stock medicines were dropped because a delivery already
  // covers them. Without this the dialog opens empty beside a "Low Stock
  // Alerts 3" badge and reads as broken rather than as nothing-to-do.
  const coveredByPending = lowStockAlerts.filter(
    (a: any) => suggestedQty(a.minStockLevel ?? 0, a.currentStock ?? 0, a.pendingStock ?? 0) <= 0,
  ).length;

  const addMedicine = (med: any) => {
    if (!med || rows.some((r) => r.medicineId === med.medicineId)) return;
    setRows((rs) => [...rs, rowFromMedicine(med, null, 0, false)]);
  };
  const updateRow = (idx: number, patch: any) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  // Distinct supplier buckets = number of POs that will be created.
  const poCount = new Set(rows.map((r) => r.supplierId || "__none__")).size;

  const handleGenerate = async () => {
    if (rows.length === 0) { toast.error("Add at least one medicine."); return; }
    if (rows.some((r) => !r.medicineId || r.orderedQuantity <= 0)) { toast.error("Every line needs a medicine and a quantity above zero."); return; }

    const groups = new Map<string, any[]>();
    rows.forEach((r) => {
      const key = r.supplierId || "__none__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    try {
      setGenerating(true);
      let created = 0;
      for (const [key, groupRows] of groups) {
        await axiosInstance.post("/pharmacy/purchase-orders", {
          supplierId: key === "__none__" ? null : key,
          orderDate: new Date(),
          isAutoGenerated: true,
          items: groupRows.map((r) => ({ medicineId: r.medicineId, orderedQuantity: r.orderedQuantity, unitPrice: r.unitPrice, totalPrice: r.orderedQuantity * r.unitPrice })),
        });
        created++;
      }
      toast.success(`Created ${created} purchase order${created === 1 ? "" : "s"}`);
      onClose();
      await onGenerated();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to generate purchase orders"));
      // Some POs may have been created before the failure — refresh so the list is honest.
      await onGenerated();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !generating && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>Auto-Generate Purchase Orders</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Pre-filled from low-stock items with suggested quantities. Adjust anything, remove what you don't need, or add other medicines below. Items are grouped by supplier into separate POs.
        </Typography>

        <Autocomplete
          fullWidth
          options={medicines.filter((m) => !rows.some((r) => r.medicineId === m.medicineId))}
          getOptionLabel={(m: any) => (m ? `${m.medicineName}${m.genericName ? ` (${m.genericName})` : ""}` : "")}
          isOptionEqualToValue={(o: any, v: any) => o.medicineId === v?.medicineId}
          value={null}
          onChange={(_, v) => v && addMedicine(v)}
          renderInput={(params) => <TextField {...params} label="Add another medicine" placeholder="Search by name or generic…" />}
        />

        {rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {/* An empty list beside a "Low Stock Alerts 3" badge reads as broken.
                Naming the reason turns it into a finished answer. */}
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {coveredByPending > 0
                ? `Nothing to order — a purchase order already on the way covers ${coveredByPending === 1 ? "the low-stock medicine" : `all ${coveredByPending} low-stock medicines`}.`
                : "Nothing is below its reorder level right now."}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Add a medicine above to order anyway.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD_SX}>Medicine</TableCell>
                  <TableCell sx={HEAD_SX} align="center">Stock (cur / min)</TableCell>
                  <TableCell sx={HEAD_SX}>Supplier</TableCell>
                  <TableCell sx={HEAD_SX} align="right">Qty</TableCell>
                  <TableCell sx={HEAD_SX} align="right">Unit price</TableCell>
                  <TableCell sx={HEAD_SX} align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r.medicineId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.medicineName}
                        {!r.low && <Chip label="added" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(8,145,178,0.12)', color: '#0891b2' }} />}
                      </Typography>
                      {r.genericName && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.genericName}</Typography>}
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary' }}>
                      {r.currentStock == null ? "—" : r.currentStock} / {r.minStockLevel}
                      {r.pendingStock > 0 && (
                        <Typography variant="caption" sx={{ display: 'block', color: SEMANTIC.warning }}>
                          +{r.pendingStock} already on order
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select size="small" value={r.supplierId} displayEmpty onChange={(e) => updateRow(idx, { supplierId: e.target.value })} sx={{ minWidth: 150 }}>
                        <MenuItem value=""><em>— No supplier —</em></MenuItem>
                        {suppliers.map((sup) => <MenuItem key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell align="right">
                      <TextField type="number" size="small" value={r.orderedQuantity} onChange={(e) => updateRow(idx, { orderedQuantity: parseInt(e.target.value) || 0 })} inputProps={{ min: 1, style: { textAlign: 'right', width: 70 } }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField type="number" size="small" value={r.unitPrice} onChange={(e) => updateRow(idx, { unitPrice: parseFloat(e.target.value) || 0 })} inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', width: 80 } }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeRow(idx)} sx={{ color: SEMANTIC.danger }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {rows.length} item{rows.length === 1 ? "" : "s"} · {poCount} purchase order{poCount === 1 ? "" : "s"}
        </Typography>
        <Box>
          <Button onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={handleGenerate} variant="contained" color="warning" disabled={generating || rows.length === 0} sx={{ ml: 1 }}>
            {generating ? "Generating…" : `Generate ${poCount} PO${poCount === 1 ? "" : "s"}`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
