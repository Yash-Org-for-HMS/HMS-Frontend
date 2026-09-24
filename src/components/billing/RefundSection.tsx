import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Chip, TextField, MenuItem, Typography, Radio, RadioGroup, FormControlLabel, Divider, Grid } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import {
  refundablePayments, isPendingRefund, paidTotal, refundedTotal, pendingRefundTotal, totalRefundable,
} from "@/utils/invoiceMoney";
import { formatINR } from "@/utils/format";
import RefundReceiptDialog from "@/components/billing/RefundReceiptDialog";
import { SEMANTIC, alpha } from "@/styles/accents";
import type { Invoice, Refund } from "@/types";

/**
 * One figure in the money strip.
 *
 * The four numbers that decide whether this invoice can be refunded at all used
 * to be a single run-on caption — "₹500 of ₹2,000 collected returned · ₹100
 * awaiting approval · ₹1,400 still refundable" — wrapping across two lines of
 * 12px text. They are the whole basis of the decision, so they get to be
 * figures.
 */
const Figure = ({ label, value, tone, strong }: {
  label: string; value: string; tone?: string; strong?: boolean;
}) => (
  <Grid size={{ xs: 6 }}>
    <Typography
      variant="caption"
      sx={{ display: "block", color: "text.secondary", fontWeight: 600, letterSpacing: 0.3 }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        fontWeight: strong ? 800 : 700,
        fontSize: strong ? "1.05rem" : "0.95rem",
        fontVariantNumeric: "tabular-nums",
        color: tone ?? "text.primary",
        lineHeight: 1.35,
      }}
    >
      {value}
    </Typography>
  </Grid>
);

/** A medicine from this bill that can still go back on the shelf. */
interface ReturnableMedicine {
  medicineId: string;
  medicineName: string;
  dispensed: number;
  returned: number;
  returnable: number;
}

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
  /** Units of each medicine physically handed back, keyed by medicineId. */
  const [returning, setReturning] = useState<Record<string, string>>({});

  // Medicines from this bill that can still go back on the shelf. Server-derived
  // from the stock ledger (dispensed minus already returned), so a second refund
  // on the same bill offers only what is genuinely left rather than the original
  // quantity again.
  const { data: returnable = [] } = useQuery<ReturnableMedicine[]>({
    queryKey: ["returnable-medicines", invoice?.invoiceId],
    queryFn: async () =>
      (await axiosInstance.get(`/reception/billing/invoices/${invoice!.invoiceId}/returnable-medicines`)).data.data,
    enabled: !!invoice?.invoiceId && !readOnly,
    // A returned strip changes this, and so does another desk refunding the
    // same bill; stale numbers here would let the counter over-return.
    staleTime: 0,
  });
  const canReturn = returnable.filter((r) => r.returnable > 0);

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
        // Only what was actually handed back. Money can come back without goods
        // (a billing error), so this is never inferred from the amount.
        returnedItems: canReturn
          .map((r) => ({ medicineId: r.medicineId, quantity: Number(returning[r.medicineId] || 0) }))
          .filter((r) => r.quantity > 0),
      });
      // The server's message differs when the refund only got RAISED — saying
      // "processed" for one awaiting approval would tell the desk the patient
      // had been paid when they have not.
      toast.success(res.data?.message || "Refund processed");
      setReturning({});
      reset();
      await onChanged?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Refund failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 2, border: "1px solid", borderColor: "divider",
        overflow: "hidden", bgcolor: "background.paper",
      }}
    >
      {/* Money leaving the building is the most consequential thing on a bill.
          It was drawn as a dashed purple box — and the purple was the NURSE
          panel's accent, hardcoded, so the Reception billing screen wore
          another panel's colour. Ordinary card chrome instead, with colour
          spent only where it means something: red on what can still go out,
          green on nothing-left. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>Refunds</Typography>
        {collected > 0 && (
          <Chip
            size="small"
            label={remaining > 0.005 ? `${formatINR(remaining)} refundable` : "Nothing left"}
            sx={{
              fontWeight: 700,
              bgcolor: alpha(remaining > 0.005 ? SEMANTIC.danger : SEMANTIC.success, 0.12),
              color: remaining > 0.005 ? SEMANTIC.danger : SEMANTIC.success,
            }}
          />
        )}
      </Box>
      <Divider />

      {collected > 0 && (
        <>
          <Grid container spacing={1.5} sx={{ px: 2, py: 1.75 }}>
            <Figure label="Collected" value={formatINR(collected)} />
            <Figure label="Returned" value={formatINR(returned)} />
            {awaiting > 0.005 && (
              <Figure label="Awaiting approval" value={formatINR(awaiting)} tone={SEMANTIC.warning} />
            )}
            <Figure
              label="Still refundable"
              value={remaining > 0.005 ? formatINR(remaining) : "—"}
              tone={remaining > 0.005 ? SEMANTIC.danger : "text.disabled"}
              strong
            />
          </Grid>
          <Divider />
        </>
      )}

      <Box sx={{ px: 2, py: 1.75 }}>

      {/* What has already been returned. A refund awaiting approval is listed
          too and marked as such: it explains why less is refundable than the
          payments suggest, and it has no receipt because no money has moved. */}
      {refunds.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {refunds.map((r) => {
            const pending = isPendingRefund(r);
            const rejected = String(r.refundStatus).toUpperCase() === "REJECTED";
            // Pending and rejected were both plain grey chips, though one means
            // "this money may yet go out" and the other means "it never will".
            const tone = pending ? SEMANTIC.warning : rejected ? SEMANTIC.danger : null;
            return (
              <Box
                key={r.refundId}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  px: 1.5, py: 1.25, mb: 1,
                  borderRadius: 1.5, border: "1px solid",
                  borderColor: tone ? alpha(tone, 0.35) : "divider",
                  bgcolor: tone ? alpha(tone, 0.04) : "transparent",
                  opacity: rejected ? 0.8 : 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      textDecoration: rejected ? "line-through" : "none",
                    }}
                  >
                    {formatINR(r.refundAmount)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {r.refundNumber ? `${r.refundNumber}` : ""}
                    {r.refundNumber && r.refundReason ? " · " : ""}
                    {r.refundReason || ""}
                    {paymentLabel(r.paymentId)}
                  </Typography>
                </Box>
                {(pending || rejected) && (
                  <Chip
                    size="small"
                    label={pending ? "Awaiting approval" : "Rejected"}
                    sx={{
                      fontWeight: 700, fontSize: "0.6875rem", height: 22,
                      bgcolor: alpha(tone!, 0.12), color: tone!,
                    }}
                  />
                )}
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
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Refund from the Billing panel.
          </Typography>
        )
      ) : refundable.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Nothing left to refund on this invoice.
        </Typography>
      ) : !open ? (
        <Button
          variant="outlined" onClick={begin}
          sx={{ textTransform: "none", fontWeight: 700, color: SEMANTIC.danger, borderColor: alpha(SEMANTIC.danger, 0.5) }}
        >
          Process a refund
        </Button>
      ) : (
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, lineHeight: 1, display: "block", mb: 1.5 }}>
            What is going back
          </Typography>

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

          {canReturn.length > 0 && (
            <Box sx={{ mb: 2, p: 1.75, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                Medicines handed back
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5 }}>
                Only what physically returns to the shelf. Leave at zero if the money is
                going back but the medicine is not — a broken seal cannot be resold.
              </Typography>
              {canReturn.map((r) => {
                const typed = Number(returning[r.medicineId] || 0);
                const over = typed > r.returnable;
                return (
                  <Box key={r.medicineId} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600 }} noWrap>
                      {r.medicineName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                      {r.returned > 0
                        ? `${r.returnable} of ${r.dispensed} left`
                        : `${r.dispensed} dispensed`}
                    </Typography>
                    <TextField
                      size="small" type="number" label="Back" value={returning[r.medicineId] ?? ""}
                      onChange={(e) => setReturning((prev) => ({ ...prev, [r.medicineId]: e.target.value }))}
                      inputProps={{ min: 0, max: r.returnable, step: 1 }}
                      error={over}
                      sx={{ width: 96 }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}

          {/* The one genuine decision in this flow, and it was set in 12px grey
              inside a grey box. It decides whether the services on this bill go
              back to be re-billed — so it is drawn as a decision. */}
          {canVoid && (
            <Box
              sx={{
                mb: 2, p: 1.75, borderRadius: 1.5,
                border: "1px solid", borderColor: alpha(SEMANTIC.warning, 0.4),
                bgcolor: alpha(SEMANTIC.warning, 0.05),
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                This returns everything collected on this bill
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
                Which of these happened?
              </Typography>
              <RadioGroup
                value={voidInvoice ? "void" : "owed"}
                onChange={(e) => setVoidInvoice(e.target.value === "void")}
              >
                <FormControlLabel
                  value="owed"
                  sx={{ alignItems: "flex-start", mb: 0.5, mr: 0 }}
                  control={<Radio size="small" sx={{ pt: 0.25 }} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>The charge stands</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        The patient still owes this — an overpayment returned, or they are paying again by another method.
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="void"
                  sx={{ alignItems: "flex-start", mr: 0 }}
                  control={<Radio size="small" sx={{ pt: 0.25 }} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Cancel the charge</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Nothing is owed. The bill is voided and its services go back to be re-billed.
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </Box>
          )}

          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, lineHeight: 1, display: "block", mb: 1.5 }}>
            How it goes back
          </Typography>

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

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={reset} disabled={busy}
              sx={{ color: "text.secondary", borderColor: "divider", fontWeight: 600, flexShrink: 0 }}>
              Cancel
            </Button>
            {/* The amount is on the button. A refund is irreversible once
                approved, and "Confirm refund" says nothing about how much. */}
            <Button
              fullWidth variant="contained" onClick={submit}
              disabled={busy || !paymentId || !(Number(amount) > 0) || Number(amount) > selectedMax + 0.005 || reason.trim().length < 3}
              sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: SEMANTIC.dangerDark }, fontWeight: 700 }}
            >
              {busy
                ? "Refunding…"
                : canVoid && voidInvoice
                  ? `Refund ${formatINR(Number(amount) || 0)} and void the bill`
                  : `Refund ${formatINR(Number(amount) || 0)}`}
            </Button>
          </Box>
        </Box>
      )}
      </Box>

      <RefundReceiptDialog refundId={receiptFor} open={!!receiptFor} onClose={() => setReceiptFor(null)} />
    </Box>
  );
}
