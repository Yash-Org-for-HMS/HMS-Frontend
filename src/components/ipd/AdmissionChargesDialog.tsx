import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  IconButton, TextField, Divider, Chip, Tooltip,
} from "@mui/material";
import { AddRounded, DeleteRounded, Inventory2Rounded, CloseRounded } from "@mui/icons-material";
import SocChargePicker, { type PickedCharge } from "@/components/billing/SocChargePicker";
import { axiosInstance } from "@/api/axios";
import { BRAND, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { formatINR, formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ReasonDialog from "@/components/ReasonDialog";

interface ChargeRow {
  admissionChargeId: string;
  description: string;
  category?: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status: string;
  notes?: string | null;
  recordedAt: string;
  recordedByName?: string | null;
  voidReason?: string | null;
}

/** A line queued for recording. Price is display-only — the server re-prices. */
type Line = { chargeItemId: string; itemName: string; price: number; quantity: number };

/**
 * What the ward used, recorded where it was used.
 *
 * Everything else on an IP bill accrues from an action somebody already
 * performs — ordering a lab, assigning a medicine. Opening a box of gloves has
 * no such action, so consumables reached the bill only if reception guessed at
 * them during discharge, having never been on the ward. This is that action.
 */
export default function AdmissionChargesDialog({
  admission, open, onClose,
}: {
  admission: { admissionId: string; patientName?: string | null; uhid?: string | null; bed?: { label?: string | null } | null };
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [voidTarget, setVoidTarget] = useState<ChargeRow | null>(null);
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [basket, setBasket] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ rows: ChargeRow[]; totals: { count: number; amount: string | number } }>({
    queryKey: ["admission-charges", admission.admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/charges`)).data.data,
    enabled: open,
  });
  const rows = data?.rows ?? [];

  const addToBasket = (c: PickedCharge) => {
    setBasket((prev) => {
      // Picking the same item twice means two of it, not two lines.
      const at = prev.findIndex((l) => l.chargeItemId === c.chargeItemId);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + 1 };
        return next;
      }
      return [...prev, { chargeItemId: c.chargeItemId, itemName: c.itemName, price: Number(c.price), quantity: 1 }];
    });
  };
  const setQty = (i: number, q: number) =>
    setBasket((prev) => prev.map((l, ix) => (ix === i ? { ...l, quantity: Math.max(1, q) } : l)));
  const removeLine = (i: number) => setBasket((prev) => prev.filter((_, ix) => ix !== i));
  const basketTotal = basket.reduce((s, l) => s + l.price * l.quantity, 0);

  const save = async () => {
    if (!basket.length) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/charges`, {
        items: basket.map((l) => ({ chargeItemId: l.chargeItemId, quantity: l.quantity })),
      });
      toast.success(`${basket.length} item${basket.length === 1 ? "" : "s"} recorded`);
      setBasket([]);
      refetch();
      // The discharge preview reads the same rows, so it must not go stale.
      qc.invalidateQueries({ queryKey: ["ipd-admission", admission.admissionId] });
      qc.invalidateQueries({ queryKey: ["admissions"] });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not record these items"));
    } finally {
      setSaving(false);
    }
  };

  const voidCharge = async (reason: string): Promise<boolean> => {
    if (!voidTarget) return true;
    try {
      await axiosInstance.put(`/ipd/admissions/${admission.admissionId}/charges/${voidTarget.admissionChargeId}/void`, { reason });
      toast.success("Item removed from the bill");
      setVoidTarget(null);
      refetch();
      // The discharge preview reads the same rows, so it must not go stale.
      qc.invalidateQueries({ queryKey: ["ipd-admission", admission.admissionId] });
      return true;
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not remove this item"));
      return false;
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Inventory2Rounded sx={{ color: BRAND.action }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Consumables &amp; equipment</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {admission.patientName}{admission.uhid ? ` · ${admission.uhid}` : ""}{admission.bed?.label ? ` · ${admission.bed.label}` : ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" disabled={saving}><CloseRounded /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setPickerOpen(true)} sx={{ textTransform: "none" }}>
            Add from Schedule of Charges
          </Button>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Priced at this patient's room class; rolls onto the discharge bill.
          </Typography>
        </Box>

        {basket.length > 0 && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
              TO RECORD
            </Typography>
            {basket.map((l, i) => (
              <Box key={l.chargeItemId} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.6 }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{l.itemName}</Typography>
                <TextField
                  size="small" type="number" label="Qty" value={l.quantity}
                  onChange={(e) => setQty(i, Number(e.target.value))}
                  inputProps={{ min: 1, max: 9999 }} sx={{ width: 92 }}
                />
                <Typography variant="body2" sx={{ width: 90, textAlign: "right", fontWeight: 600 }}>
                  {formatINR(l.price * l.quantity)}
                </Typography>
                <IconButton size="small" onClick={() => removeLine(i)} aria-label={`Remove ${l.itemName}`}>
                  <DeleteRounded fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, alignItems: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{basket.length} item{basket.length === 1 ? "" : "s"}</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{formatINR(basketTotal)}</Typography>
              <Button variant="contained" onClick={save} disabled={saving}
                startIcon={saving ? <HeartbeatLoader size={18} /> : undefined} sx={{ textTransform: "none" }}>
                Record
              </Button>
            </Box>
          </Box>
        )}

        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
          RECORDED THIS STAY
          {data?.totals ? ` · ${data.totals.count} billable · ${formatINR(data.totals.amount)}` : ""}
        </Typography>

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>
            Nothing recorded yet. Anything added here appears on the discharge bill.
          </Typography>
        ) : (
          <Box>
            {rows.map((r) => {
              const voided = r.status === "VOIDED";
              const billed = r.status === "BILLED";
              return (
                <Box key={r.admissionChargeId}
                  sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", opacity: voided ? 0.55 : 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, textDecoration: voided ? "line-through" : "none" }}>
                      {r.description}{r.quantity > 1 ? ` × ${r.quantity}` : ""}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {formatDateTime(r.recordedAt)}{r.recordedByName ? ` · ${r.recordedByName}` : ""}
                      {voided && r.voidReason ? ` · removed: ${r.voidReason}` : ""}
                    </Typography>
                  </Box>
                  {billed && <Chip label="On the bill" size="small" sx={{ height: 20, fontWeight: 700, bgcolor: `${SEMANTIC.success}22`, color: SEMANTIC.success }} />}
                  {voided && <Chip label="Removed" size="small" sx={{ height: 20, fontWeight: 700, bgcolor: `${NEUTRAL.muted}22`, color: NEUTRAL.muted }} />}
                  <Typography variant="body2" sx={{ width: 90, textAlign: "right", fontWeight: 600 }}>
                    {formatINR(r.totalPrice)}
                  </Typography>
                  {/* Only an unbilled line can be pulled back — once it is on an
                      invoice the invoice itself has to be amended. */}
                  {r.status === "ACTIVE" ? (
                    <Tooltip title="Remove from the bill">
                      <IconButton size="small" onClick={() => setVoidTarget(r)} aria-label={`Remove ${r.description}`}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Box sx={{ width: 34 }} />
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving} sx={{ textTransform: "none" }}>Close</Button>
      </DialogActions>

      <SocChargePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addToBasket}
        accent={BRAND.action}
        preferCategories={["Consumab", "Equipment"]}
      />

      {/* A reason is required: the row is kept rather than deleted, so "why did
          this come off the bill" stays answerable. */}
      {voidTarget && (
        <ReasonDialog
          open
          title="Remove from the bill"
          description={`${voidTarget.description} — ${formatINR(voidTarget.totalPrice)}. The item stays on the record with your reason.`}
          reasonLabel="Reason"
          reasons={["Recorded in error", "Recorded twice", "Not actually used", "Wrong patient", "Wrong quantity"]}
          confirmLabel="Remove"
          busyLabel="Removing…"
          onClose={() => setVoidTarget(null)}
          onConfirm={voidCharge}
        />
      )}
    </Dialog>
  );
}
