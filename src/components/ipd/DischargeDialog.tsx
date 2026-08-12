import { useState } from "react";
import { ACCENTS, SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Box, IconButton, Divider,
} from "@mui/material";
import { LogoutRounded, AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";
import SocChargePicker from "@/components/billing/SocChargePicker";

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
  type Extra = { description: string; amount: string; chargeItemId?: string; basePrice?: number; roomPrices?: { roomClassId: string; price: number | string }[]; taxPercent?: number };
  const [extras, setExtras] = useState<Extra[]>([]);
  const [saving, setSaving] = useState(false);
  const [socPickerOpen, setSocPickerOpen] = useState(false);
  // Room class used to price picked SOC charges. `null` = follow the patient's bed
  // (the detail's derived roomClassId); a non-null value is an explicit override.
  const [roomClassOverride, setRoomClassOverride] = useState<string | null>(null);

  // Pull the admission detail for the bed-charge preview.
  const { data: detail, isLoading: detailLoading, isError: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ["ipd-admission", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}`)).data.data,
    enabled: open,
  });

  // An open insurance/scheme claim for this admission (if any) — its approved
  // amount tells us how much of this bill the payer covers vs the patient.
  const { data: claims = [] } = useQuery({
    queryKey: ["ipd-admission-claim", admissionId],
    queryFn: async () => (await axiosInstance.get("/claims", { params: { admissionId } })).data.data as any[],
    enabled: open,
  });
  const claim = claims[0];
  const claimApproved = claim ? Number(claim.preAuthApprovedAmount || 0) : 0;

  // Active room classes (Schedule of Charges) — options for the pricing override.
  const { data: roomClasses = [] } = useQuery<any[]>({
    queryKey: ["soc-room-classes"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/room-classes")).data.data,
    enabled: open,
  });
  // The class actually used for pricing: the operator's override, else the bed's class.
  const billRoomClassId: string = roomClassOverride !== null ? roomClassOverride : (detail?.roomClassId || "");
  // Only active classes are selectable, but keep the currently-selected one even if it
  // was later deactivated (so the Select never renders an out-of-range/blank value).
  const roomClassOptions: any[] = roomClasses.filter((rc) => rc.isActive || rc.roomClassId === billRoomClassId);
  const billRoomClassName: string | null = roomClasses.find((rc) => rc.roomClassId === billRoomClassId)?.name ?? detail?.roomClassName ?? null;

  // Effective preview amount for a row. Picked SOC rows re-derive from the CURRENT
  // room class (matrix price else base), so the preview matches what the server will
  // bill even after the class is changed; free-text rows use their typed amount.
  const lineAmount = (e: Extra): number => {
    if (!e.chargeItemId) return Number(e.amount) || 0;
    if (billRoomClassId) {
      const rp = e.roomPrices?.find((r) => r.roomClassId === billRoomClassId);
      if (rp != null) return Number(rp.price);
    }
    return Number(e.basePrice ?? e.amount) || 0;
  };

  const bedCharge = Number(detail?.estimatedBedCharge || 0);
  const bedSegments: any[] = detail?.bedSegments || [];
  // Clinical charges (doctor visits / lab / radiology) accrued during the stay
  // that will roll onto the final bill — previewed so the total is honest.
  const pendingCharges: any[] = detail?.pendingCharges || [];
  const pendingTotal = Number(detail?.pendingChargesTotal || 0);
  const extrasTotal = extras.reduce((s, e) => s + lineAmount(e), 0);
  // Per-line GST on picked charges (0% = exempt; bed/clinical/free-text carry none).
  // Mirrors the server, which re-taxes authoritatively from the rate card.
  const taxTotal = extras.reduce((s, e) => s + lineAmount(e) * ((e.taxPercent || 0) / 100), 0);
  const total = bedCharge + pendingTotal + extrasTotal + taxTotal;
  const deposit = Number(detail?.depositBalance || 0);
  const depositApplied = Math.min(deposit, total);
  const payable = Math.max(0, total - depositApplied);
  const depositRefundable = Math.max(0, deposit - depositApplied);
  // What the patient must cover after insurance approval (shortfall).
  const patientShortfall = claim ? Math.max(0, total - claimApproved) : null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/ipd/admissions/${admissionId}/discharge`, {
        dischargeSummary: summary || undefined,
        roomClassId: billRoomClassId || undefined,
        extraCharges: extras
          .filter((e) => e.chargeItemId || (e.description.trim() && Number(e.amount) > 0))
          .map((e) => e.chargeItemId ? { chargeItemId: e.chargeItemId } : { description: e.description.trim(), amount: Number(e.amount) }),
      });
      const inv = res.data?.data?.invoice;
      toast.success(inv ? `Discharged — invoice ${inv.invoiceNumber} (${formatINR(inv.netAmount)})` : "Patient discharged");
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
        <LogoutRounded sx={{ color: SEMANTIC.danger }} /> Discharge — {detail?.patientName || "Patient"}
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
            {bedSegments.length > 1 ? (
              // Patient was transferred mid-stay — bill (and show) each bed at its own rate,
              // instead of one line for the whole stay at just the current bed's rate.
              <Stack spacing={0.75}>
                {bedSegments.map((seg, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {seg.label} — {seg.days} day{seg.days === 1 ? "" : "s"} @ {formatINR(Number(seg.dailyCharge))}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(seg.amount))}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Bed charges total ({detail?.days ?? "—"} days)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Bed charges ({detail?.days ?? "—"} day{detail?.days === 1 ? "" : "s"})</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
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
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(c.totalPrice))}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Clinical charges total</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(pendingTotal)}</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Additional charges</Typography>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Button size="small" onClick={() => setSocPickerOpen(true)} sx={{ textTransform: "none", color: BRAND.action }}>Pick from Schedule of Charges</Button>
                <Button size="small" startIcon={<AddRounded />} onClick={() => setExtras((x) => [...x, { description: "", amount: "" }])} sx={{ textTransform: "none", color: BRAND.action }}>Custom</Button>
              </Box>
            </Box>
            {roomClassOptions.length > 0 && (
              <TextField
                select size="small" fullWidth label="Room class (for Schedule-of-Charges pricing)" value={billRoomClassId}
                onChange={(e) => setRoomClassOverride(e.target.value)} sx={{ mb: 1.5 }}
                helperText={detail?.roomClassName ? `Defaults to the patient's bed (${detail.roomClassName}); change to re-price rate-card charges.` : "Sets which price column applies to picked rate-card charges."}
              >
                <MenuItem value=""><em>None (base price)</em></MenuItem>
                {roomClassOptions.map((rc: any) => <MenuItem key={rc.roomClassId} value={rc.roomClassId}>{rc.name}{rc.isActive ? "" : " (inactive)"}</MenuItem>)}
              </TextField>
            )}
            {extras.map((e, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                {/* Rate-card rows are priced by the server, so name + amount are read-only here.
                    Picked rows show the CURRENT room-class price so the preview tracks the server. */}
                <TextField size="small" fullWidth placeholder="Description" value={e.description} disabled={!!e.chargeItemId}
                  onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, description: ev.target.value } : r))} />
                <TextField size="small" type="number" sx={{ width: 130 }} placeholder="Amount" value={e.chargeItemId ? String(lineAmount(e)) : e.amount} disabled={!!e.chargeItemId}
                  onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, amount: ev.target.value } : r))} />
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
            Estimate up to now — bed days and any new orders are finalized when you discharge.
          </Typography>
          {deposit > 0 && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit held</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: BRAND.action }}>{formatINR(deposit)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit applied</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#8b5cf6" }}>- {formatINR(depositApplied)}</Typography>
              </Box>
            </>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: deposit > 0 ? "1px dashed" : "none", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{deposit > 0 ? "Payable now" : "Final bill total"}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: payable > 0 ? SEMANTIC.danger : SEMANTIC.success }}>{formatINR(payable)}</Typography>
          </Box>
          {depositRefundable > 0 && (
            <Typography variant="caption" sx={{ color: "#8b5cf6" }}>
              {formatINR(depositRefundable)} deposit will remain after this bill — refund it from the admission's ⋮ menu.
            </Typography>
          )}

          <TextField fullWidth label="Discharge summary" value={summary} onChange={(e) => setSummary(e.target.value)} multiline rows={3} placeholder="Condition at discharge, instructions, follow-up…" />
        </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        {/* Block discharge until the bill preview has actually loaded — otherwise the
            operator could confirm on a misleading ₹0 total. */}
        <Button variant="contained" onClick={submit} disabled={saving || !detail}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <LogoutRounded />}
          sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: SEMANTIC.dangerDark } }}>
          Discharge & Bill
        </Button>
      </DialogActions>
    </Dialog>
    <SocChargePicker
      open={socPickerOpen}
      onClose={() => setSocPickerOpen(false)}
      onPick={(c) => setExtras((x) => [...x, { description: c.itemName, amount: String(c.price), chargeItemId: c.chargeItemId, basePrice: c.basePrice, roomPrices: c.roomPrices, taxPercent: c.taxPercent }])}
      accent={BRAND.action}
      roomClassId={billRoomClassId || undefined}
      roomClassName={billRoomClassName || undefined}
    />
    </>
  );
}
