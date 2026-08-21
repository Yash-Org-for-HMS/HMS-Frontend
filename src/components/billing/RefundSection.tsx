import { useState } from "react";
import { Box, Button, Chip, TextField, MenuItem, Typography, Radio, RadioGroup, FormControlLabel } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import {
  refundablePayments, isPendingRefund, paidTotal, refundedTotal, pendingRefundTotal, totalRefundable,
} from "@/utils/invoiceMoney";
import { formatINR } from "@/utils/format";
import RefundReceiptDialog from "@/components/billing/RefundReceiptDialog";
import { SEMANTIC } from "@/styles/accents";
import type { Invoice, Refund } from "@/types";

/**
 * Refunding money already collected on an invoice: what has been returned, and
 * the control to return more.
 *
 * Shared deliberately. This lived only inside the appointment billing screen,
 * which meant it could only be reached for an invoice that HAS an appointment —
 * so every IPD bill and every hand-generated OPD invoice was unrefundable
 * through the UI (23 of 27 invoices holding money, on the live data). Refunding
 * belongs to the invoice, not to the appointment that happened to create it, so
 * it lives here and both screens mount it.
 *
 * One definition also means the two screens cannot drift apart on a money rule.
 */
export default function RefundSection({
  invoice, onChanged, readOnly = false, paymentMethods = [],
}: {
  invoice: (Partial<Invoice> & { invoiceId?: string; Refund?: Refund[] | null }) | null | undefined;
  onChanged?: () => void | Promise<unknown>;
  readOnly?: boolean;
  paymentMethods?: { paymentMethodId: number; methodName: string }[];
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [methodId, setMethodId] = useState<string>("");
  const [reference, setReference] = useState("");
  // "the charge stands" is the safe default: it leaves the bill collectable,
  // which is reversible, where voiding hands the charges back to be re-billed.
  const [voidInvoice, setVoidInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);

  const refunds = invoice?.Refund ?? [];
  const refundable = refundablePayments(invoice);
  const selectedMax = refundable.find((p) => p.paymentId === paymentId)?.refundable ?? 0;

  // The position in one line, so nobody has to add up the rows below to work out
  // whether this invoice can be refunded again. Reading the individual refunds
  // and inferring it was the reason a fully-refunded bill looked refundable.
  const collected = paidTotal(invoice);
  const returned = refundedTotal(invoice);
  const awaiting = pendingRefundTotal(invoice);
  const remaining = totalRefundable(invoice);

  // Which payment a refund was taken from — ambiguous from the amount alone once
  // an invoice has more than one payment, which is exactly when it matters.
  const paymentLabel = (id: string): string => {
    const all = invoice?.Payment ?? [];
    if (all.length < 2) return "";
    const idx = all.findIndex((p) => p.paymentId === id);
    if (idx < 0) return "";
    const p = all[idx];
    return ` · from payment ${idx + 1} (${p.paymentMethod?.methodName || "payment"} ${formatINR(p.paidAmount)})`;
  };

  // Nothing collected and nothing returned — there is no refund story to tell.
  if (!invoice || (refunds.length === 0 && refundable.length === 0)) return null;

  const begin = () => {
    setOpen(true);
    const first = refundable[0];
    if (first) { setPaymentId(first.paymentId); setAmount(first.refundable.toFixed(2)); }
  };

  const reset = () => {
    setOpen(false); setPaymentId(""); setAmount(""); setReason(""); setMethodId(""); setReference("");
    setVoidInvoice(false);
  };

  // Does this refund hand back everything the invoice is holding? Only then is
  // there a decision to make — and only then will the server accept one.
  const clearsTheBill = Number(amount) > 0 && Number(amount) >= remaining - 0.005;
  // An IPD bill is voided at its admission, not here.
  const canVoid = clearsTheBill && !invoice?.admissionId;

  const submit = async () => {
    const amt = Number(amount);
    if (!paymentId || !(amt > 0) || reason.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/refund`, {
        paymentId,
        amount: amt,
        reason: reason.trim(),
        paymentMethodId: methodId === "" ? null : Number(methodId),
        voidInvoice: canVoid && voidInvoice,
        referenceNumber: reference.trim() || null,
      });
      // The server's message differs when the refund only got RAISED — saying
      // "processed" for one awaiting approval would tell the desk the patient
      // had been paid when they have not.
      toast.success(res.data?.message || "Refund processed");
      reset();
      await onChanged?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Refund failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(139,92,246,0.06)", border: "1px dashed rgba(139,92,246,0.3)" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#7c3aed" }}>Refunds</Typography>
        {collected > 0 && (
          <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
            {formatINR(returned)} of {formatINR(collected)} collected returned
            {awaiting > 0 ? ` · ${formatINR(awaiting)} awaiting approval` : ""}
            {" · "}
            <Box component="span" sx={{ fontWeight: 700, color: remaining > 0.005 ? "text.primary" : SEMANTIC.success }}>
              {remaining > 0.005 ? `${formatINR(remaining)} still refundable` : "nothing left to refund"}
            </Box>
          </Typography>
        )}
      </Box>

      {/* What has already been returned. A refund awaiting approval is listed
          too and marked as such: it explains why less is refundable than the
          payments suggest, and it has no receipt because no money has moved. */}
      {refunds.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          {refunds.map((r) => {
            const pending = isPendingRefund(r);
            const rejected = String(r.refundStatus).toUpperCase() === "REJECTED";
            return (
              <Box key={r.refundId} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{ flex: 1, color: "text.secondary", textDecoration: rejected ? "line-through" : "none" }}
                >
                  {r.refundNumber ? `${r.refundNumber} · ` : ""}
                  {formatINR(r.refundAmount)}
                  {r.refundReason ? ` — ${r.refundReason}` : ""}
                  {paymentLabel(r.paymentId)}
                </Typography>
                {pending && <Chip size="small" label="Awaiting approval" sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700 }} />}
                {rejected && <Chip size="small" label="Rejected" sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700 }} />}
                {!pending && !rejected && (
                  <Button size="small" onClick={() => setReceiptFor(r.refundId)} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>
                    Receipt
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {readOnly ? (
        refundable.length > 0 && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Refund from the Billing panel.
          </Typography>
        )
      ) : refundable.length === 0 ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Nothing left to refund on this invoice.
        </Typography>
      ) : !open ? (
        <Button size="small" onClick={begin} sx={{ color: "#8b5cf6", textTransform: "none", fontWeight: 600 }}>
          Process a refund
        </Button>
      ) : (
        <Box sx={{ mt: 1 }}>
          <TextField
            select fullWidth size="small" label="Refund against payment" value={paymentId}
            onChange={(e) => {
              setPaymentId(e.target.value);
              const p = refundable.find((x) => x.paymentId === e.target.value);
              if (p) setAmount(p.refundable.toFixed(2));
            }}
            sx={{ mb: 2 }}
          >
            {refundable.map((p) => (
              <MenuItem key={p.paymentId} value={p.paymentId}>
                {p.paymentMethod?.methodName || "Payment"} — {Number(p.paidAmount).toFixed(2)} (refundable {p.refundable.toFixed(2)})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth size="small" type="number" label="Refund amount (INR)" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ min: 0, max: selectedMax, step: "0.01" }}
            error={Number(amount) > selectedMax + 0.005}
            helperText={`Max refundable: ${selectedMax.toFixed(2)} INR`}
            sx={{ mb: 2 }}
          />

          {canVoid && (
            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="caption" sx={{ display: "block", fontWeight: 700, color: "text.primary", mb: 0.5 }}>
                This returns everything collected on this bill. What happened?
              </Typography>
              <RadioGroup
                value={voidInvoice ? "void" : "owed"}
                onChange={(e) => setVoidInvoice(e.target.value === "void")}
              >
                <FormControlLabel
                  value="owed"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      <b>The charge stands</b> — the patient still owes this (overpayment returned, or paying again by another method)
                    </Typography>
                  }
                />
                <FormControlLabel
                  value="void"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      <b>Cancel the charge</b> — nothing is owed. The bill is voided and its services go back to be re-billed
                    </Typography>
                  }
                />
              </RadioGroup>
            </Box>
          )}

          {/* How the money physically goes back. Recorded rather than inferred:
              the cash book otherwise assumes a refund left by the method the
              payment arrived on, so cash handed back on a card payment books as
              a card reversal and the drawer will not reconcile. */}
          <TextField
            select fullWidth size="small" label="Refunded by" value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            helperText="Blank assumes the original method"
            sx={{ mb: 2 }}
          >
            <MenuItem value="">Same as the original payment</MenuItem>
            {paymentMethods.map((m) => (
              <MenuItem key={m.paymentMethodId} value={String(m.paymentMethodId)}>{m.methodName}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth size="small" label="Reference / UTR (optional)"
            placeholder="Bank or UPI reference for a non-cash refund"
            value={reference} onChange={(e) => setReference(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth size="small" label="Reason (required)"
            placeholder="e.g. Service cancelled, overcharge"
            value={reason} onChange={(e) => setReason(e.target.value)}
            multiline rows={2} sx={{ mb: 2 }}
          />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={reset} disabled={busy}
              sx={{ color: "text.secondary", borderColor: "divider", fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              fullWidth variant="contained" onClick={submit}
              disabled={busy || !paymentId || !(Number(amount) > 0) || Number(amount) > selectedMax + 0.005 || reason.trim().length < 3}
              sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: SEMANTIC.dangerDark }, fontWeight: 700 }}
            >
              {busy ? "Refunding…" : canVoid && voidInvoice ? "Refund and void the bill" : "Confirm refund"}
            </Button>
          </Box>
        </Box>
      )}

      <RefundReceiptDialog refundId={receiptFor} open={!!receiptFor} onClose={() => setReceiptFor(null)} />
    </Box>
  );
}
