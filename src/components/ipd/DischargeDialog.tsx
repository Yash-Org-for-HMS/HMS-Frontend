import { useState } from "react";
import type { AdmissionClaimRef, AdmissionDetail, BedSegment, PendingCharge, RoomClassRef } from "@/features/ipd/ipd.types";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Box, IconButton, Divider,
  RadioGroup, FormControlLabel, Radio, Alert,
} from "@mui/material";
import { LogoutRounded, AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";
import { unitCount } from "@/features/ipd/billingUnit";
import SocChargePicker, { type PickedCharge } from "@/components/billing/SocChargePicker";
import { chargePriceFor } from "@/components/billing/chargePrice";
import TypeOrderPriceDialog from "@/components/billing/TypeOrderPriceDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  admissionId: string;
}


export default function DischargeDialog({ open, onClose, onDone, admissionId }: Props) {
  const toast = useToast();
  const [summary, setSummary] = useState("");
  // A row is either a free-text charge (editable description + amount) or one picked
  // from the Schedule of Charges (carries chargeItemId + its base/room-class prices so
  // the preview can re-derive when the room class changes; the server prices it).
  type Extra = { description: string; amount: string; qty: string; chargeItemId?: string; basePrice?: number; roomPrices?: { roomClassId: string; price: number | string }[]; listPrices?: PickedCharge["listPrices"]; taxPercent?: number; priceAtBilling?: boolean };
  const [extras, setExtras] = useState<Extra[]>([]);
  const [saving, setSaving] = useState(false);
  const [socPickerOpen, setSocPickerOpen] = useState(false);
  // Room class used to price picked SOC charges. `null` = follow the patient's bed
  // (the detail's derived roomClassId); a non-null value is an explicit override.
  const [roomClassOverride, setRoomClassOverride] = useState<string | null>(null);

  // Pull the admission detail for the bed-charge preview.
  const { data: detail, isLoading: detailLoading, isError: detailError, refetch: refetchDetail } = useQuery<AdmissionDetail>({
    queryKey: ["ipd-admission", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}`)).data.data,
    enabled: open,
  });

  // An open insurance/scheme claim for this admission (if any) - its approved
  // amount tells us how much of this bill the payer covers vs the patient.
  const { data: claims = [] } = useQuery({
    queryKey: ["ipd-admission-claim", admissionId],
    queryFn: async () => (await axiosInstance.get("/claims", { params: { admissionId } })).data.data as AdmissionClaimRef[],
    enabled: open,
  });
  const claim = claims[0];
  const claimApproved = claim ? Number(claim.preAuthApprovedAmount || 0) : 0;

  // Active room classes (Schedule of Charges) - options for the pricing override.
  const { data: roomClasses = [] } = useQuery<RoomClassRef[]>({
    queryKey: ["soc-room-classes"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/room-classes")).data.data,
    enabled: open,
  });
  // The class actually used for pricing: the operator's override, else the bed's class.
  const billRoomClassId: string = roomClassOverride !== null ? roomClassOverride : (detail?.roomClassId || "");
  // Only active classes are selectable, but keep the currently-selected one even if it
  // was later deactivated (so the Select never renders an out-of-range/blank value).
  const roomClassOptions: RoomClassRef[] = roomClasses.filter((rc) => rc.isActive || rc.roomClassId === billRoomClassId);
  const billRoomClassName: string | null = roomClasses.find((rc) => rc.roomClassId === billRoomClassId)?.name ?? detail?.roomClassName ?? null;

  // Effective preview amount for a row. Picked SOC rows re-derive from the CURRENT
  // room class (matrix price else base), so the preview matches what the server will
  // bill even after the class is changed; free-text rows use their typed amount.
  // An insured stay's rate list comes first, as on the bill.
  const lineAmount = (e: Extra): number => {
    if (!e.chargeItemId || e.priceAtBilling) return Number(e.amount) || 0;
    return chargePriceFor({ ...e, basePrice: e.basePrice ?? (Number(e.amount) || 0) }, billRoomClassId, detail?.serviceRateListId) || 0;
  };

  // A package on the stay takes off what it covers: room rent & nursing (worked
  // out by the server) and, while it still applies, the extras added here - in
  // its "Other charges" or as its included services, as the server bills them.
  const stayPackage = detail?.stayPackage ?? null;
  const packageBedCovered = Number(detail?.packageBedCovered || 0);
  const extraInPackage: boolean[] = (() => {
    const left = new Map((stayPackage?.contents ?? []).filter((c) => c.chargeItemId).map((c) => [c.chargeItemId!, c.left]));
    return extras.map((e) => {
      if (!stayPackage?.appliesNow) return false;
      if (stayPackage.covers.includes("OTHER")) return true;
      const n = e.chargeItemId ? left.get(e.chargeItemId) ?? 0 : 0;
      if (n > 0) left.set(e.chargeItemId!, n - 1);
      return n > 0;
    });
  })();
  // How many: oxygen by the hour, a monitor by the day - the rate card prices one.
  const qtyOf = (e: Extra): number => Number(e.qty);
  const qtyOk = (e: Extra): boolean => Number.isInteger(qtyOf(e)) && qtyOf(e) >= 1 && qtyOf(e) <= 999;
  // A line the bill cannot carry blocks the discharge instead of being dropped:
  // the server refuses it, and the total here must be the total billed.
  const extraProblem = (e: Extra): string | null => {
    if (!qtyOk(e)) return "Quantity 1 to 999";
    if (e.chargeItemId) return null;
    if (!e.description.trim()) return "Add a description";
    if (!(Number(e.amount) > 0)) return "Amount above 0";
    return null;
  };
  const extraAmount = (e: Extra, i: number): number => (extraInPackage[i] || extraProblem(e) ? 0 : lineAmount(e) * qtyOf(e));
  const extrasInvalid = extras.some((e) => extraProblem(e) !== null);

  const bedCharge = Number(detail?.estimatedBedCharge || 0);
  // The nursing charge a bed tariff carries, billed per unit beside the rent.
  const nursingCharge = Number(detail?.estimatedNursingCharge || 0);
  const bedSegments: BedSegment[] = detail?.bedSegments || [];
  // Clinical charges (doctor visits / lab / radiology) accrued during the stay
  // that will roll onto the final bill - previewed so the total is honest.
  const pendingCharges: PendingCharge[] = detail?.pendingCharges || [];
  // Price at billing: a lab/radiology test still to be priced holds the discharge bill.
  const [priceCharge, setPriceCharge] = useState<PendingCharge | null>(null);
  const unpriced = pendingCharges.filter((c) => c.blocked);
  const pendingTotal = Number(detail?.pendingChargesTotal || 0);
  // Requested, not dispensed: shown but never added to the total.
  const awaitingPharmacy = detail?.awaitingPharmacy ?? [];
  const theatreWarnings = detail?.theatreWarnings ?? [];
  const awaitingPharmacyTotal = Number(detail?.awaitingPharmacyTotal || 0);
  const extrasTotal = extras.reduce((s, e, i) => s + extraAmount(e, i), 0);
  // Per-line GST, from BOTH sources. Charges accrued during the stay carry
  // their own tax - a dispensed medicine is taxed at its rate-card GST - and
  // so do charges picked here. Only the picked ones used to be counted, so a
  // stay with any medicines showed a "Final bill total" below the invoice the
  // patient actually received. Mirrors the server, which re-taxes
  // authoritatively from the rate card.
  const pendingTax = pendingCharges.reduce((s, c) => s + (Number(c.taxAmount) || 0), 0);
  const taxTotal = pendingTax + extras.reduce((s, e, i) => s + extraAmount(e, i) * ((e.taxPercent || 0) / 100), 0);
  const total = bedCharge + nursingCharge - packageBedCovered + pendingTotal + extrasTotal + taxTotal;
  const deposit = Number(detail?.depositBalance || 0);
  // With a claim still open the advance is kept aside, not put on the bill: the
  // payer is claimed the whole bill, and the advance is used on what it leaves
  // (from the admissions list) once it settles. The server decides the same way.
  const claimOpen = !!claim && !["SETTLED", "CLOSED", "REJECTED", "PREAUTH_REJECTED"].includes(String(claim.status ?? ""));
  const depositApplied = claimOpen ? 0 : Math.min(deposit, total);
  const payable = Math.max(0, total - depositApplied);
  const depositRefundable = claimOpen ? 0 : Math.max(0, deposit - depositApplied);
  // What the patient must cover after insurance approval (shortfall).
  const patientShortfall = claim ? Math.max(0, total - claimApproved) : null;
  // How far the bill runs past the policy's cover, when the desk entered one.
  const overCover = claim?.sumInsured != null ? Math.max(0, total - Number(claim.sumInsured)) : 0;

  // Leftover advance: the desk has to say what happens to it before the
  // discharge goes through. This used to be a caption suggesting they refund it
  // from a menu afterwards, which is how an admission was discharged still
  // holding ₹97,635 that nobody returned.
  const [advanceAction, setAdvanceAction] = useState<"" | "REFUND" | "HOLD">("");
  const [holdReason, setHoldReason] = useState("");

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/ipd/admissions/${admissionId}/discharge`, {
        dischargeSummary: summary || undefined,
        roomClassId: billRoomClassId || undefined,
        extraCharges: extras
          .map((e) => ({ ...(e.chargeItemId ? (e.priceAtBilling ? { chargeItemId: e.chargeItemId, amount: Number(e.amount) } : { chargeItemId: e.chargeItemId }) : { description: e.description.trim(), amount: Number(e.amount) }), quantity: qtyOf(e) })),
        advanceHoldReason: advanceAction === "HOLD" ? holdReason.trim() : undefined,
        refundLeftover: advanceAction === "REFUND" || undefined,
      });
      const inv = res.data?.data?.invoice;
      const advanceLeft = Number(res.data?.data?.depositRemaining ?? 0);
      toast.success(inv ? `Discharged - invoice ${inv.invoiceNumber} (${formatINR(inv.netAmount)})` : "Patient discharged");
      const refundRequested = Number(res.data?.data?.refundRequested ?? 0);
      if (refundRequested > 0) {
        toast.info(`Refund of ${formatINR(refundRequested)} sent for admin approval`);
      } else if (advanceAction === "REFUND" && advanceLeft > 0) {
        toast.info(`${formatINR(advanceLeft)} advance is still held - use the refund action on this admission to return it.`);
      }
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to discharge"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LogoutRounded sx={{ color: SEMANTIC.danger }} /> Discharge - {detail?.patientName || "Patient"}
      </DialogTitle>
      <DialogContent dividers>
        {detailLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><HeartbeatLoader size={30} /></Box>
        ) : detailError || !detail ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>Couldn't load the discharge bill preview.</Typography>
            <Button size="small" variant="outlined" onClick={() => refetchDetail()}>Retry</Button>
          </Box>
        ) : (
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            {bedSegments.length > 1 || bedSegments.some((s) => (s.unit ?? "day") !== "day") ? (
              // Patient was transferred mid-stay, or a bed is billed by the hour,
              // session or visit - show each bed in its own unit at its own rate,
              // instead of one line for the whole stay in days.
              <Stack spacing={0.75}>
                {bedSegments.map((seg, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {seg.label} - {unitCount(seg.days, seg.unit)}{seg.unit === null || seg.days === 0 ? "" : (seg.runs?.length ?? 1) > 1 ? ` at ${seg.runs!.length} rates` : ` @ ${formatINR(Number(seg.dailyCharge))}`}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(seg.amount))}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Bed charges total</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Bed charges ({detail?.days ?? "-"} day{detail?.days === 1 ? "" : "s"}{(bedSegments[0]?.runs?.length ?? 1) > 1 ? `, ${bedSegments[0].runs!.length} rates` : ""})
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
              </Box>
            )}
            {nursingCharge > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Nursing charges (from the bed tariff)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(nursingCharge)}</Typography>
              </Box>
            )}
            {packageBedCovered > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                <Typography variant="body2" sx={{ color: "#7C3AED" }}>In package ({stayPackage?.name}) - room rent & nursing</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#7C3AED" }}>- {formatINR(packageBedCovered)}</Typography>
              </Box>
            )}
          </Box>

          {pendingCharges.length > 0 && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.75 }}>
                Charges during stay (auto-added to bill)
              </Typography>
              <Stack spacing={0.5}>
                {pendingCharges.map((c, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>{c.description}</Typography>
                    {c.blocked && c.typedPrices && c.sourceId ? (
                      <Button size="small" variant="outlined" color="warning" sx={{ py: 0 }} onClick={() => setPriceCharge(c)}>Type price</Button>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(c.totalPrice))}</Typography>
                    )}
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Clinical charges total</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(pendingTotal)}</Typography>
                </Box>
                {unpriced.length > 0 && (
                  <Typography variant="caption" color="warning.dark">
                    Type the price of {unpriced.length === 1 ? "the test" : `the ${unpriced.length} tests`} priced at billing before discharging.
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          {/* Requested but not dispensed, so correctly outside the total above.
              Left unsaid, though, a stay whose medicines are all still waiting
              looks exactly like a stay that had none - and discharging on that
              figure means the pharmacy's confirmation lands after the bill. */}
          {/* A theatre case puts nothing on this bill until it is finished and
              its charges are added on the case's Bill tab. Said here, before
              the bill is made, not found afterwards. */}
          {theatreWarnings.length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Theatre charges missing from this bill
              </Typography>
              <Stack spacing={0.25}>
                {theatreWarnings.map((w) => (
                  <Typography key={w.surgeryId} variant="body2">{w.message}</Typography>
                ))}
              </Stack>
            </Alert>
          )}

          {awaitingPharmacy.length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {awaitingPharmacy.length} medicine{awaitingPharmacy.length === 1 ? "" : "s"} still awaiting pharmacy - not in this bill
              </Typography>
              <Stack spacing={0.25} sx={{ mb: 0.75 }}>
                {awaitingPharmacy.map((m) => (
                  <Box key={m.ipMedOrderId} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {m.medicineName || "Medicine"}{m.quantity ? ` × ${m.quantity}` : ""}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatINR(Number(m.totalPrice || 0))}</Typography>
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Nothing has been dispensed, so these are not billable yet. Have the pharmacy
                confirm or reject them before discharging, or roughly {formatINR(awaitingPharmacyTotal)} will
                fall outside this bill.
              </Typography>
            </Alert>
          )}

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Additional charges</Typography>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Button size="small" onClick={() => setSocPickerOpen(true)} sx={{ textTransform: "none", color: BRAND.action }}>Pick from Schedule of Charges</Button>
                <Button size="small" startIcon={<AddRounded />} onClick={() => setExtras((x) => [...x, { description: "", amount: "", qty: "1" }])} sx={{ textTransform: "none", color: BRAND.action }}>Custom</Button>
              </Box>
            </Box>
            {roomClassOptions.length > 0 && (
              <TextField
                select size="small" fullWidth label="Room class (for Schedule-of-Charges pricing)" value={billRoomClassId}
                onChange={(e) => setRoomClassOverride(e.target.value)} sx={{ mb: 1.5 }}
                helperText={detail?.roomClassName ? `Defaults to the patient's bed (${detail.roomClassName}); change to re-price rate-card charges.` : "Sets which price column applies to picked rate-card charges."}
              >
                <MenuItem value=""><em>None (base price)</em></MenuItem>
                {roomClassOptions.map((rc) => <MenuItem key={rc.roomClassId} value={rc.roomClassId}>{rc.name}{rc.isActive ? "" : " (inactive)"}</MenuItem>)}
              </TextField>
            )}
            {extras.map((e, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                {/* Rate-card rows are priced by the server, so name + amount are read-only here.
                    Picked rows show the CURRENT room-class price so the preview tracks the server. */}
                <TextField size="small" fullWidth placeholder="Description" value={e.description} disabled={!!e.chargeItemId}
                  onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, description: ev.target.value } : r))}
                  error={!e.chargeItemId && extraProblem(e) === "Add a description"}
                  helperText={nursingCharge > 0 && /nursing/i.test(e.description) ? "Nursing is already charged from the bed tariff above" : undefined}
                  FormHelperTextProps={{ sx: { color: SEMANTIC.warning, mx: 0 } }} />
                <TextField size="small" type="number" sx={{ width: 80, flexShrink: 0 }} label="Qty" value={e.qty}
                  onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, qty: ev.target.value } : r))}
                  error={!qtyOk(e)} slotProps={{ htmlInput: { min: 1, max: 999, step: 1 } }} />
                <TextField size="small" type="number" sx={{ width: 130, flexShrink: 0 }} placeholder="Amount" value={e.chargeItemId ? String(lineAmount(e)) : e.amount} disabled={!!e.chargeItemId}
                  onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, amount: ev.target.value } : r))}
                  error={!e.chargeItemId && extraProblem(e) === "Amount above 0"}
                  helperText={extraInPackage[i] ? "In package - not billed" : (!e.chargeItemId && extraProblem(e) === "Amount above 0" ? "Must be above 0" : undefined)}
                  FormHelperTextProps={{ sx: { color: extraInPackage[i] ? "#7C3AED" : undefined, mx: 0 } }} />
                <IconButton size="small" onClick={() => setExtras((x) => x.filter((_, ri) => ri !== i))}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box>

          {claim && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(59,130,246,0.08)", border: "1px solid", borderColor: "rgba(59,130,246,0.25)" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: SEMANTIC.info, display: "block", mb: 0.5 }}>
                Insurance claim {claim.claimNumber}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Pre-auth approved</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: SEMANTIC.info }}>{formatINR(claimApproved)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Patient shortfall (bill − approved)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: patientShortfall! > 0 ? SEMANTIC.danger : SEMANTIC.success }}>{formatINR(patientShortfall || 0)}</Typography>
              </Box>
              {overCover > 0 && (
                <Typography variant="body2" sx={{ color: SEMANTIC.danger, fontWeight: 600, mt: 0.5 }}>
                  The bill is {formatINR(overCover)} over the sum insured of {formatINR(Number(claim.sumInsured))} - the payer will not pay past it.
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                The bill is auto-linked to this claim on discharge; record the payer settlement from the claim page.
              </Typography>
            </Box>
          )}

          <Divider />
          {taxTotal > 0 && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Subtotal</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(total - taxTotal)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Tax (CGST + SGST)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(taxTotal)}</Typography>
              </Box>
            </>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Bill total (estimated)</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(total)}</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            Estimate up to now - bed days and any new orders are finalized when you discharge.
          </Typography>
          {deposit > 0 && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit held</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: BRAND.action }}>{formatINR(deposit)}</Typography>
              </Box>
              {claimOpen ? (
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Kept aside for the insurance claim, not taken off the bill. Once the payer settles, use it on what is left from the admissions list, and refund the rest.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit applied</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#8b5cf6" }}>- {formatINR(depositApplied)}</Typography>
                </Box>
              )}
            </>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: deposit > 0 ? "1px dashed" : "none", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{deposit > 0 ? "Payable now" : "Final bill total"}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: payable > 0 ? SEMANTIC.danger : SEMANTIC.success }}>{formatINR(payable)}</Typography>
          </Box>
          {depositRefundable > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {formatINR(depositRefundable)} of this patient's advance is left over
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                It stays with the hospital until someone returns it. Say what happens to it.
              </Typography>
              <RadioGroup value={advanceAction} onChange={(e) => setAdvanceAction(e.target.value as "REFUND" | "HOLD")} sx={{ mt: 1 }}>
                <FormControlLabel value="REFUND" control={<Radio size="small" />}
                  label={<Typography variant="body2">Refund it to the patient <Box component="span" sx={{ color: "text.secondary" }}>- sent to an admin for approval</Box></Typography>} />
                <FormControlLabel value="HOLD" control={<Radio size="small" />}
                  label={<Typography variant="body2">Hold it for now</Typography>} />
              </RadioGroup>
              {advanceAction === "HOLD" && (
                <TextField
                  fullWidth size="small" sx={{ mt: 1 }}
                  label="Why is it being held? (required)"
                  placeholder="e.g. bill under dispute, cheque awaited"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                />
              )}
            </Alert>
          )}

          <TextField fullWidth label="Discharge summary" value={summary} onChange={(e) => setSummary(e.target.value)} multiline rows={3} placeholder="Condition at discharge, instructions, follow-up…" />
        </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        {/* Block discharge until the bill preview has actually loaded - otherwise the
            operator could confirm on a misleading ₹0 total. */}
        {/* A leftover advance has to be dealt with explicitly: refund or hold,
            and a hold carries its reason. */}
        <Button variant="contained" onClick={submit}
          disabled={saving || !detail || unpriced.length > 0 || extrasInvalid || (depositRefundable > 0 && (!advanceAction || (advanceAction === "HOLD" && holdReason.trim().length < 3)))}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <LogoutRounded />}
          sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: SEMANTIC.dangerDark } }}>
          Discharge & Bill
        </Button>
      </DialogActions>
    </Dialog>
    {priceCharge?.typedPrices && priceCharge.sourceId && (priceCharge.sourceType === "LAB" || priceCharge.sourceType === "RADIOLOGY") && (
      <TypeOrderPriceDialog open kind={priceCharge.sourceType} id={priceCharge.sourceId} tests={priceCharge.typedPrices}
        onClose={() => setPriceCharge(null)}
        onSaved={() => { setPriceCharge(null); refetchDetail(); }} />
    )}
    <SocChargePicker
      open={socPickerOpen}
      onClose={() => setSocPickerOpen(false)}
      onPick={(c) => setExtras((x) => [...x, { description: c.itemName, amount: String(c.price), qty: "1", chargeItemId: c.chargeItemId, basePrice: c.basePrice, roomPrices: c.roomPrices, listPrices: c.listPrices, taxPercent: c.taxPercent, priceAtBilling: c.priceAtBilling }])}
      accent={BRAND.action}
      roomClassId={billRoomClassId || undefined}
      rateListId={detail?.serviceRateListId}
      roomClassName={billRoomClassName || undefined}
    />
    </>
  );
}
