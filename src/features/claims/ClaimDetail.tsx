import { useState } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, Chip, Button, Grid, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from "@mui/material";
import { ArrowBackRounded, EditRounded, TimelineRounded, ArrowForwardRounded, PaymentsRounded } from "@mui/icons-material";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import ClaimDocumentsSection from "./ClaimDocumentsSection";
import { statusMeta } from "./claimMeta";

const ACCENT = ACCENTS.reception;

function Field({ label, value }: { label: string; value: any }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>{label}</Typography>
      <Typography variant="body2" sx={{ mt: 0.3 }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [advOpen, setAdvOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const { data: claim, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => (await axiosInstance.get(`/claims/${id}`)).data.data,
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !claim) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const m = statusMeta(claim.status);
  const inr = (v: any) => (v != null ? formatINR(Number(v)) : "—");

  return (
    <Box>
      <PageHeader
        title={claim.claimNumber}
        subtitle={`${claim.patientName} · ${claim.uhid}`}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<EditRounded />} onClick={() => navigate(`/reception/claims/${id}/edit`)} sx={{ borderColor: "divider", color: "text.primary" }}>Edit</Button>
            {(claim.allowedTransitions?.length > 0) && (
              <Button variant="contained" startIcon={<ArrowForwardRounded />} onClick={() => setAdvOpen(true)} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>Advance status</Button>
            )}
          </Stack>
        }
      />

      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/reception/claims")} sx={{ color: "text.secondary", textTransform: "none", mb: 1 }}>Back to claims</Button>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }} >
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Chip label={m.label} sx={{ bgcolor: `${m.color}22`, color: m.color, fontWeight: 700 }} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{claim.payer?.payerName || "No payer set"}{claim.payer?.portalName ? ` · ${claim.payer.portalName}` : ""}</Typography>
            </Box>
            <Grid container>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="Scheme" value={claim.schemeType} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="Policy / MAA card #" value={claim.policyOrCardNumber} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="TPA" value={claim.tpaName} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="Patient relation" value={claim.patientRelation} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="Portal reference (CCN)" value={claim.portalReference} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }} ><Field label="Registered" value={claim.registeredAt ? dayjs(claim.registeredAt).format("DD MMM YYYY, hh:mm A") : "—"} /></Grid>
              {claim.remarks && <Grid size={12} ><Field label="Remarks" value={claim.remarks} /></Grid>}
            </Grid>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Financials</Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => setLinkOpen(true)} sx={{ textTransform: "none", color: ACCENT }}>
                {claim.invoice ? `Bill: ${claim.invoice.invoiceNumber}` : "Link bill"}
              </Button>
              <Button size="small" variant="outlined" startIcon={<PaymentsRounded fontSize="small" />} onClick={() => setSettleOpen(true)} sx={{ borderColor: "divider", color: "text.primary" }}>
                Record settlement
              </Button>
            </Box>
            {/* Reconciliation — what the payer owes vs what the patient must cover. */}
            <Grid container spacing={1.5} sx={{ mb: 1 }}>
              {[
                ["Billed", claim.reconciliation?.billed, ACCENTS.reception],
                ["Approved", claim.reconciliation?.approved, SEMANTIC.info],
                ["Settled", claim.reconciliation?.settled, SEMANTIC.success],
                ["Patient pays", claim.reconciliation?.patientResponsibility, SEMANTIC.danger],
                ["Payer balance", claim.reconciliation?.balanceFromPayer, SEMANTIC.warning],
              ].map(([label, val, color]) => (
                <Grid size={{ xs: 6, sm: 4 }} key={label as string}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label as string}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 800, color: color as string }}>{inr(val)}</Typography>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={1}>
              {[
                ["Estimated cost", claim.estimatedCost],
                ["Pre-auth requested", claim.preAuthRequestedAmount],
                ["Pre-auth approved", claim.preAuthApprovedAmount],
                ["Final claimed", claim.finalClaimedAmount],
              ].map(([label, val]) => (
                <Grid size={{ xs: 6, sm: 3 }} key={label as string}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label as string}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{inr(val)}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }} >
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}><TimelineRounded fontSize="small" sx={{ color: ACCENT }} /> Timeline</Typography>
            <Stack spacing={0}>
              {(claim.events || []).map((e: any, i: number) => {
                const em = statusMeta(e.toStatus);
                return (
                  <Box key={e.claimEventId} sx={{ display: "flex", gap: 1.5, pb: i === claim.events.length - 1 ? 0 : 2 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: em.color, mt: 0.5 }} />
                      {i !== claim.events.length - 1 && <Box sx={{ flex: 1, width: 2, bgcolor: "divider", my: 0.5 }} />}
                    </Box>
                    <Box sx={{ pb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{em.label}</Typography>
                      {e.note && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{e.note}</Typography>}
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>{dayjs(e.createdAt).format("DD MMM, hh:mm A")} · {e.actorName}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <ClaimDocumentsSection claimId={id!} />

      <LinkInvoiceDialog open={linkOpen} onClose={() => setLinkOpen(false)} claimId={id!} currentInvoiceId={claim.invoiceId || ""} onDone={() => { setLinkOpen(false); refetch(); }} />
      <RecordSettlementDialog open={settleOpen} onClose={() => setSettleOpen(false)} claimId={id!} onDone={() => { setSettleOpen(false); refetch(); }} />

      <AdvanceStatusDialog
        open={advOpen}
        onClose={() => setAdvOpen(false)}
        options={claim.allowedTransitions || []}
        onDone={() => { setAdvOpen(false); refetch(); }}
        claimId={id!}
      />
    </Box>
  );
}

function AdvanceStatusDialog({ open, onClose, options, onDone, claimId }: { open: boolean; onClose: () => void; options: string[]; onDone: () => void; claimId: string }) {
  const toast = useToast();
  const [toStatus, setToStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!toStatus) { toast.error("Pick a status"); return; }
    setSaving(true);
    try {
      await axiosInstance.post(`/claims/${claimId}/transition`, { toStatus, note: note || undefined });
      toast.success("Status updated");
      setToStatus(""); setNote("");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Advance claim status</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Move to" value={toStatus} onChange={(e) => setToStatus(e.target.value)} fullWidth>
            {options.map((s) => <MenuItem key={s} value={s}>{statusMeta(s).label}</MenuItem>)}
          </TextField>
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline rows={2} placeholder="e.g. Pre-auth approved for ₹40,000; query on discharge summary…" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving} startIcon={saving ? <HeartbeatLoader size={22} /> : undefined} sx={{ bgcolor: ACCENT }}>Update</Button>
      </DialogActions>
    </Dialog>
  );
}

function LinkInvoiceDialog({ open, onClose, claimId, currentInvoiceId, onDone }: { open: boolean; onClose: () => void; claimId: string; currentInvoiceId: string; onDone: () => void }) {
  const toast = useToast();
  const [invoiceId, setInvoiceId] = useState(currentInvoiceId);
  const [saving, setSaving] = useState(false);
  const { data: invoices = [] } = useQuery({
    queryKey: ["claim-invoices", claimId],
    queryFn: async () => (await axiosInstance.get(`/claims/${claimId}/invoices`)).data.data as any[],
    enabled: open,
  });
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/claims/${claimId}`, { invoiceId: invoiceId || null });
      toast.success(invoiceId ? "Bill linked" : "Bill unlinked");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to link bill"));
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Link hospital bill</DialogTitle>
      <DialogContent>
        <TextField select label="Invoice" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} fullWidth sx={{ mt: 1 }}>
          <MenuItem value="">— Not linked —</MenuItem>
          {invoices.map((i) => (
            <MenuItem key={i.invoiceId} value={i.invoiceId}>{i.invoiceNumber} · {formatINR(Number(i.netAmount))} · {dayjs(i.invoiceDate).format("DD MMM YYYY")}</MenuItem>
          ))}
        </TextField>
        {invoices.length === 0 && <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>No bills found for this patient yet.</Typography>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: ACCENT }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function RecordSettlementDialog({ open, onClose, claimId, onDone }: { open: boolean; onClose: () => void; claimId: string; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Enter a settlement amount"); return; }
    setSaving(true);
    try {
      await axiosInstance.post(`/claims/${claimId}/settlement`, { amount: Number(amount), note: note || undefined });
      toast.success("Settlement recorded");
      setAmount(""); setNote("");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to record settlement"));
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record payer settlement</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Amount received (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth autoFocus />
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline rows={2} placeholder="e.g. NEFT ref 12345; part settlement" />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Recorded as a payer payment against the linked bill; the claim moves to (Partially) Settled automatically.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving} startIcon={saving ? <HeartbeatLoader size={22} /> : <PaymentsRounded />} sx={{ bgcolor: ACCENT }}>Record</Button>
      </DialogActions>
    </Dialog>
  );
}
