import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Button, TextField, MenuItem, Stack, Typography, Grid, FormControlLabel, Switch, Chip,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useToast } from "@/providers/ToastContext";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import type { BranchSettings, HospitalDefaults } from "./branches.types";
import { VITALS_LABEL, LAB_BILLING_LABEL } from "./branches.types";

/**
 * The branch admin's own page: how the branch they have picked works. Every
 * choice left on "Same as hospital" follows the hospital's System Settings.
 */

interface OperationsResponse {
  branch: { branchId: string; branchName: string; branchCode: string; status: string };
  settings: BranchSettings | null;
  hospital: HospitalDefaults["settings"];
}

const FOLLOW = "";
const VITALS_SHORT: Record<string, string> = { RECEPTIONIST: "Reception", NURSE: "Nurse" };
const LAB_SHORT: Record<string, string> = { PRE_PAID: "Pre-paid", POST_PAID: "Post-paid" };
const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function BranchSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<OperationsResponse>({
    queryKey: ["branch-operations"],
    queryFn: async () => (await axiosInstance.get("/hospital/branches/current/settings")).data.data,
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !data) return <ErrorState title="Couldn't load this branch's settings" message={apiErrorText(error)} onRetry={() => refetch()} />;
  // Keyed so switching branch (or saving) starts the form from what is stored.
  return <SettingsForm key={`${data.branch.branchId}:${JSON.stringify(data.settings)}`} data={data} onSaved={() => refetch()} />;
}

function SettingsForm({ data, onSaved }: { data: OperationsResponse; onSaved: () => void }) {
  const toast = useToast();
  const { branch, hospital } = data;
  const s = data.settings;
  const def = hospital.opdHours;
  const [vitals, setVitals] = useState<string>(s?.vitalsCollector ?? FOLLOW);
  const [labBilling, setLabBilling] = useState<string>(s?.billingStrategy ?? FOLLOW);
  const [refundLimit, setRefundLimit] = useState(s?.refundApprovalThreshold != null ? String(Number(s.refundApprovalThreshold)) : "");
  const [ownOpd, setOwnOpd] = useState(!!s?.opdStartTime);
  const [opd, setOpd] = useState({
    start: s?.opdStartTime ?? def.startTime, end: s?.opdEndTime ?? def.endTime, slot: String(s?.opdSlotMinutes ?? def.slotDurationMinutes),
  });
  const [saving, setSaving] = useState(false);
  const inheritedLimit = Number(hospital.refundApprovalThreshold).toLocaleString("en-IN");
  const open = branch.status === "active";

  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put("/hospital/branches/current/settings", {
        vitalsCollector: vitals || null,
        billingStrategy: labBilling || null,
        refundApprovalThreshold: refundLimit.trim() === "" ? null : Number(refundLimit),
        ...(ownOpd
          ? { opdStartTime: opd.start, opdEndTime: opd.end, opdSlotMinutes: Number(opd.slot) }
          : { opdStartTime: null, opdEndTime: null, opdSlotMinutes: null }),
      });
      toast.success(`${branch.branchName} settings saved`);
      onSaved();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't save the settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", width: "100%" }}>
      <PageHeader
        title="How this branch works"
        subtitle="What this branch does differently from the rest of the hospital. Anything left on “Same as hospital” follows the hospital's settings."
      />
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{branch.branchName}</Typography>
          <Chip size="small" label={branch.branchCode} variant="outlined" />
          {!open && <Chip size="small" label="Closed" />}
        </Stack>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-vitals" select fullWidth size="small" label="Who records vitals" value={vitals} onChange={(e) => setVitals(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value={FOLLOW}>Same as hospital · {VITALS_SHORT[hospital.vitalsCollector]}</MenuItem>
                <MenuItem value="RECEPTIONIST">{VITALS_LABEL.RECEPTIONIST}</MenuItem>
                <MenuItem value="NURSE">{VITALS_LABEL.NURSE}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-lab" select fullWidth size="small" label="Lab billing" value={labBilling} onChange={(e) => setLabBilling(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value={FOLLOW}>Same as hospital · {LAB_SHORT[hospital.billingStrategy]}</MenuItem>
                <MenuItem value="PRE_PAID">{LAB_BILLING_LABEL.PRE_PAID}</MenuItem>
                <MenuItem value="POST_PAID">{LAB_BILLING_LABEL.POST_PAID}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-refund" fullWidth size="small" label="Refunds needing approval, from ₹" value={refundLimit}
                onChange={(e) => setRefundLimit(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={inheritedLimit}
                InputLabelProps={{ shrink: true }}
                helperText={refundLimit === "" ? `Empty: the hospital's ₹${inheritedLimit}` : refundLimit === "0" ? "Every refund needs approval" : " "} />
            </Grid>
          </Grid>
          <Box>
            <FormControlLabel
              control={<Switch checked={ownOpd} onChange={(e) => setOwnOpd(e.target.checked)} />}
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Own OPD hours</Typography>}
            />
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: -0.5, mb: 1 }}>
              {ownOpd
                ? "Doctors with no weekly hours at this branch can be booked in these hours."
                : `Doctors with no weekly hours can be booked ${fmt12(def.startTime)} – ${fmt12(def.endTime)}, every ${def.slotDurationMinutes} minutes, as at the rest of the hospital.`}
            </Typography>
            {ownOpd && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 4 }}>
                  <TextField id="branch-opd-start" type="time" label="Opens" fullWidth size="small" value={opd.start} onChange={(e) => setOpd((o) => ({ ...o, start: e.target.value }))} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid size={{ xs: 6, md: 4 }}>
                  <TextField id="branch-opd-end" type="time" label="Closes" fullWidth size="small" value={opd.end} onChange={(e) => setOpd((o) => ({ ...o, end: e.target.value }))} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField id="branch-opd-slot" select label="Slot length" fullWidth size="small" value={opd.slot} onChange={(e) => setOpd((o) => ({ ...o, slot: e.target.value }))}>
                    {[10, 15, 20, 30, 45, 60].map((m) => <MenuItem key={m} value={String(m)}>{m} minutes</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
            )}
          </Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={save} disabled={saving || !open}>{saving ? "Saving…" : "Save settings"}</Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
