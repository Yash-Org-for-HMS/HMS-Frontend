import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from "@mui/material";
import { formatINR } from "@/utils/format";

export type PriceChange = { price: number; reason: string };

/**
 * Change one line's price on this bill only (the rate card is untouched), so a
 * wrong price never holds up the counter. A reason is required; the bill keeps
 * the original price, the reason and who changed it.
 */
export default function ChangePriceDialog({ itemName, ratePrice, maxPrice, current, onClose, onSave }: {
  itemName: string;
  /** The price the rate card gives (0 = none set). */
  ratePrice: number;
  /** A medicine: the price (MRP, GST inside) it can be lowered from, never raised above. */
  maxPrice?: number;
  current?: PriceChange | null;
  onClose: () => void;
  /** null = back to the rate-card price. */
  onSave: (change: PriceChange | null) => void;
}) {
  const [price, setPrice] = useState(current ? String(current.price) : "");
  const [reason, setReason] = useState(current?.reason ?? "");
  const value = Number(price);
  const overMax = maxPrice != null && value > maxPrice + 0.005;
  const valid = value > 0 && !overMax && reason.trim().length >= 3;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change price</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{itemName}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {maxPrice != null ? `Price: ${formatINR(maxPrice)} each, GST included. It can only be lowered.` : `Rate card: ${ratePrice > 0 ? formatINR(ratePrice) : "no price set"}.`} The new price is for this bill only.
        </Typography>
        <TextField fullWidth size="small" type="number" label="New price (₹)" value={price} autoFocus
          onChange={(e) => setPrice(e.target.value)} inputProps={{ min: 0.01, step: "0.01", ...(maxPrice != null ? { max: maxPrice } : {}) }} sx={{ mb: 2 }}
          error={overMax} helperText={overMax ? `Not above ${formatINR(maxPrice!)}` : undefined} />
        <TextField fullWidth size="small" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}
          inputProps={{ maxLength: 200 }} helperText="Required, e.g. rate card wrong" />
      </DialogContent>
      <DialogActions>
        {current && <Button color="inherit" onClick={() => onSave(null)} sx={{ textTransform: "none", mr: "auto" }}>Use rate card price</Button>}
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onSave({ price: value, reason: reason.trim() })} sx={{ textTransform: "none" }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
