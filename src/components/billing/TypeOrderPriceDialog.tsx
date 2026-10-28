import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import type { TypedPrice } from "./PointOfCarePOS";

/**
 * Price at billing for a lab or radiology order that is billed later (on the
 * discharge bill, or on a pay-later invoice): the counter types each open test's
 * price here. The point-of-care payment takes the same prices inline.
 */
export default function TypeOrderPriceDialog({ open, kind, id, tests, onClose, onSaved }: {
  open: boolean;
  kind: "LAB" | "RADIOLOGY";
  id: string;
  tests: TypedPrice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = (t: TypedPrice) => typed[t.chargeItemId] ?? (t.price != null ? String(t.price) : "");
  const missing = tests.some((t) => !(Number(value(t)) > 0));

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      await axiosInstance.post("/billing/order-prices", { kind, id, prices: tests.map((t) => ({ chargeItemId: t.chargeItemId, price: Number(value(t)) })) });
      onSaved();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Could not save the price"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Type the price</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tests.length > 1 ? "These tests are" : "This test is"} priced at billing. The price is kept on the order and billed with it.
        </Typography>
        {tests.map((t) => (
          <TextField key={t.chargeItemId} label={`${t.itemName} (₹)`} type="number" size="small" fullWidth sx={{ mb: 1.5 }} autoFocus={t === tests[0]}
            value={value(t)} onChange={(e) => setTyped((p) => ({ ...p, [t.chargeItemId]: e.target.value }))}
            error={!(Number(value(t)) > 0)} inputProps={{ min: 0.01, step: "0.01" }} />
        ))}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || missing}>Save price</Button>
      </DialogActions>
    </Dialog>
  );
}
