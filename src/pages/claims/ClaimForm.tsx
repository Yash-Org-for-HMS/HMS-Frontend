import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box, Paper, Grid, TextField, MenuItem, Button, Autocomplete, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Divider,
} from "@mui/material";
import { SaveRounded, AddRounded } from "@mui/icons-material";
import { ACCENTS } from "../../styles/accents";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { SCHEME_OPTIONS, PAYER_TYPE_OPTIONS, RELATION_OPTIONS } from "./claimMeta";

const ACCENT = ACCENTS.reception;
const empty = {
  patientId: "", schemeType: "INSURANCE", payerId: "", policyOrCardNumber: "", tpaName: "",
  patientRelation: "Self", estimatedCost: "", preAuthRequestedAmount: "", preAuthApprovedAmount: "",
  finalClaimedAmount: "", settledAmount: "", portalReference: "", remarks: "",
};

export default function ClaimForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const [form, setForm] = useState<typeof empty>({ ...empty, patientId: params.get("patientId") || "" });
  const [patientLabel, setPatientLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Patient search (create mode only).
  const [pSearch, setPSearch] = useState("");
  const [pOptions, setPOptions] = useState<any[]>([]);
  useEffect(() => {
    if (isEdit || pSearch.trim().length < 2) { setPOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await axiosInstance.get("/reception/patients", { params: { search: pSearch, page: 1, limit: 8 } });
        setPOptions(res.data?.data || []);
      } catch { setPOptions([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [pSearch, isEdit]);

  // Payers dropdown.
  const { data: payers = [], refetch: refetchPayers } = useQuery({
    queryKey: ["claim-payers"],
    queryFn: async () => (await axiosInstance.get("/claims/payers")).data.data as any[],
  });

  // Load existing claim for edit.
  const { data: existing, isLoading: loadingClaim } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => (await axiosInstance.get(`/claims/${id}`)).data.data,
    enabled: isEdit,
  });
  useEffect(() => {
    if (!existing) return;
    setForm({
      patientId: existing.patientId || "",
      schemeType: existing.schemeType || "INSURANCE",
      payerId: existing.payerId || "",
      policyOrCardNumber: existing.policyOrCardNumber || "",
      tpaName: existing.tpaName || "",
      patientRelation: existing.patientRelation || "Self",
      estimatedCost: existing.estimatedCost ?? "",
      preAuthRequestedAmount: existing.preAuthRequestedAmount ?? "",
      preAuthApprovedAmount: existing.preAuthApprovedAmount ?? "",
      finalClaimedAmount: existing.finalClaimedAmount ?? "",
      settledAmount: existing.settledAmount ?? "",
      portalReference: existing.portalReference || "",
      remarks: existing.remarks || "",
    });
    setPatientLabel(`${existing.patientName} (${existing.uhid})`);
  }, [existing]);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [payerOpen, setPayerOpen] = useState(false);

  const submit = async () => {
    if (!form.patientId) { toast.error("Select a patient."); return; }
    setSaving(true);
    try {
      const num = (v: string) => (v === "" ? undefined : Number(v));
      const payload = {
        patientId: form.patientId,
        schemeType: form.schemeType,
        payerId: form.payerId || undefined,
        policyOrCardNumber: form.policyOrCardNumber || undefined,
        tpaName: form.tpaName || undefined,
        patientRelation: form.patientRelation || undefined,
        estimatedCost: num(form.estimatedCost),
        preAuthRequestedAmount: num(form.preAuthRequestedAmount),
        preAuthApprovedAmount: num(form.preAuthApprovedAmount),
        finalClaimedAmount: num(form.finalClaimedAmount),
        settledAmount: num(form.settledAmount),
        portalReference: form.portalReference || undefined,
        remarks: form.remarks || undefined,
      };
      const res = isEdit
        ? await axiosInstance.put(`/claims/${id}`, payload)
        : await axiosInstance.post("/claims", payload);
      const claimId = isEdit ? id : res.data?.data?.claimId;
      toast.success(isEdit ? "Claim updated" : `Claim ${res.data?.data?.claimNumber} registered`);
      navigate(`/reception/claims/${claimId}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save claim"));
    } finally {
      setSaving(false);
    }
  };

  const payerOptions = useMemo(() => payers, [payers]);

  if (isEdit && loadingClaim) return <FormSkeleton />;

  return (
    <Box>
      <PageHeader title={isEdit ? "Edit Claim" : "New Insurance Claim"} subtitle={isEdit ? (existing?.claimNumber || "") : "Register a cashless or reimbursement case to track it internally."} />
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: "1px solid", borderColor: "divider", maxWidth: 900 }}>
        <Grid container spacing={2.5}>
          <Grid size={12} >
            {isEdit ? (
              <TextField fullWidth label="Patient" value={patientLabel} disabled />
            ) : (
              <Autocomplete
                options={pOptions}
                getOptionLabel={(o: any) => (typeof o === "string" ? o : `${o.firstName || ""} ${o.lastName || ""} (${o.uhidNumber})`)}
                filterOptions={(x) => x}
                onInputChange={(_, v) => setPSearch(v)}
                onChange={(_, v: any) => { set("patientId", v?.patientId || ""); }}
                renderInput={(p) => <TextField {...p} label="Patient *" placeholder="Search by name or UHID…" />}
                isOptionEqualToValue={(o: any, v: any) => o.patientId === v.patientId}
              />
            )}
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }} >
            <TextField select fullWidth label="Scheme type" value={form.schemeType} onChange={(e) => set("schemeType", e.target.value)}>
              {SCHEME_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} >
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField select fullWidth label="Payer / TPA" value={form.payerId} onChange={(e) => set("payerId", e.target.value)}>
                <MenuItem value="">— None —</MenuItem>
                {payerOptions.map((p: any) => <MenuItem key={p.payerId} value={p.payerId}>{p.payerName}</MenuItem>)}
              </TextField>
              <Button size="small" onClick={() => setPayerOpen(true)} sx={{ whiteSpace: "nowrap", color: ACCENT }} startIcon={<AddRounded />}>Add</Button>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }} >
            <TextField fullWidth label="Policy / MAA card number" value={form.policyOrCardNumber} onChange={(e) => set("policyOrCardNumber", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} >
            <TextField fullWidth label="TPA name" value={form.tpaName} onChange={(e) => set("tpaName", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} >
            <TextField select fullWidth label="Patient relation" value={form.patientRelation} onChange={(e) => set("patientRelation", e.target.value)}>
              {RELATION_OPTIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} >
            <TextField fullWidth label="Portal reference (CCN)" value={form.portalReference} onChange={(e) => set("portalReference", e.target.value)} />
          </Grid>

          <Grid size={12} ><Divider><Typography variant="caption" sx={{ color: "text.secondary" }}>Amounts (₹) — fill in as the case progresses</Typography></Divider></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} ><TextField fullWidth type="number" label="Estimated cost" value={form.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} ><TextField fullWidth type="number" label="Pre-auth requested" value={form.preAuthRequestedAmount} onChange={(e) => set("preAuthRequestedAmount", e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} ><TextField fullWidth type="number" label="Pre-auth approved" value={form.preAuthApprovedAmount} onChange={(e) => set("preAuthApprovedAmount", e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} ><TextField fullWidth type="number" label="Final claimed" value={form.finalClaimedAmount} onChange={(e) => set("finalClaimedAmount", e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} ><TextField fullWidth type="number" label="Settled" value={form.settledAmount} onChange={(e) => set("settledAmount", e.target.value)} /></Grid>

          <Grid size={12} ><TextField fullWidth multiline rows={2} label="Remarks" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} /></Grid>
        </Grid>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button color="inherit" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={saving} startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>
            {isEdit ? "Save changes" : "Register claim"}
          </Button>
        </Stack>
      </Paper>

      <AddPayerDialog open={payerOpen} onClose={() => setPayerOpen(false)} onAdded={(p) => { refetchPayers(); set("payerId", p.payerId); setPayerOpen(false); }} />
    </Box>
  );
}

function AddPayerDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (p: any) => void }) {
  const toast = useToast();
  const [payerName, setName] = useState("");
  const [payerType, setType] = useState("TPA");
  const [portalName, setPortal] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!payerName.trim()) { toast.error("Payer name is required"); return; }
    setSaving(true);
    try {
      const res = await axiosInstance.post("/claims/payers", { payerName: payerName.trim(), payerType, portalName: portalName || undefined });
      toast.success("Payer added");
      setName(""); setPortal("");
      onAdded(res.data.data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add payer"));
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add payer / TPA</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Payer name" value={payerName} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <TextField select label="Type" value={payerType} onChange={(e) => setType(e.target.value)} fullWidth>
            {PAYER_TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="Portal (IHX / Heritage / …)" value={portalName} onChange={(e) => setPortal(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: ACCENT }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}
