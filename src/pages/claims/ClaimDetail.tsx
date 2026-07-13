import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, Chip, Button, Grid, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from "@mui/material";
import { ArrowBackRounded, EditRounded, TimelineRounded, ArrowForwardRounded } from "@mui/icons-material";
import { ACCENTS } from "../../styles/accents";
import { axiosInstance } from "../../api/axios";
import { formatINR } from "../../utils/format";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";
import DetailSkeleton from "../../components/skeletons/DetailSkeleton";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
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

  const { data: claim, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => (await axiosInstance.get(`/claims/${id}`)).data.data,
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !claim) return <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;

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
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Amounts</Typography>
            <Grid container spacing={1}>
              {[
                ["Estimated cost", claim.estimatedCost],
                ["Pre-auth requested", claim.preAuthRequestedAmount],
                ["Pre-auth approved", claim.preAuthApprovedAmount],
                ["Final claimed", claim.finalClaimedAmount],
                ["Settled", claim.settledAmount],
              ].map(([label, val]) => (
                <Grid size={{ xs: 6, sm: 4 }} key={label as string}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label as string}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{inr(val)}</Typography>
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status");
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
