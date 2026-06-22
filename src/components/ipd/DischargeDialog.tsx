import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress,
  Stack, Typography, Box, IconButton, Divider,
} from "@mui/material";
import { LogoutRounded, AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  admissionId: string;
}

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DischargeDialog({ open, onClose, onDone, admissionId }: Props) {
  const toast = useToast();
  const [summary, setSummary] = useState("");
  const [extras, setExtras] = useState<{ description: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Pull the admission detail for the bed-charge preview.
  const { data: detail } = useQuery({
    queryKey: ["ipd-admission", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}`)).data.data,
    enabled: open,
  });

  const bedCharge = Number(detail?.estimatedBedCharge || 0);
  const extrasTotal = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total = bedCharge + extrasTotal;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/ipd/admissions/${admissionId}/discharge`, {
        dischargeSummary: summary || undefined,
        extraCharges: extras.filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
      });
      const inv = res.data?.data?.invoice;
      toast.success(inv ? `Discharged — invoice ${inv.invoiceNumber} (${inr(inv.netAmount)})` : "Patient discharged");
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to discharge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LogoutRounded sx={{ color: "#ef4444" }} /> Discharge — {detail?.patientName || "Patient"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Bed charges ({detail?.days ?? "—"} day{detail?.days === 1 ? "" : "s"})</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{inr(bedCharge)}</Typography>
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Additional charges</Typography>
              <Button size="small" startIcon={<AddRounded />} onClick={() => setExtras((x) => [...x, { description: "", amount: "" }])} sx={{ textTransform: "none", color: "#0891b2" }}>Add</Button>
            </Box>
            {extras.map((e, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField size="small" fullWidth placeholder="Description" value={e.description} onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, description: ev.target.value } : r))} />
                <TextField size="small" type="number" sx={{ width: 130 }} placeholder="Amount" value={e.amount} onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, amount: ev.target.value } : r))} />
                <IconButton size="small" onClick={() => setExtras((x) => x.filter((_, ri) => ri !== i))}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box>

          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Final bill total</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0891b2" }}>{inr(total)}</Typography>
          </Box>

          <TextField fullWidth label="Discharge summary" value={summary} onChange={(e) => setSummary(e.target.value)} multiline rows={3} placeholder="Condition at discharge, instructions, follow-up…" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LogoutRounded />}
          sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}>
          Discharge & Bill
        </Button>
      </DialogActions>
    </Dialog>
  );
}
