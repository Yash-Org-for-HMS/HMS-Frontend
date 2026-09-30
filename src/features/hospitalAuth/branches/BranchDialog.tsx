import { useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Typography,
  Grid, Box, FormControlLabel, Switch, Divider,
} from "@mui/material";
import { UploadRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { assetUrl } from "@/utils/assetUrl";
import { letterheadAddress } from "@/hooks/useLetterhead";
import type { BranchRow, HospitalDefaults } from "./branches.types";
import { VITALS_LABEL, LAB_BILLING_LABEL } from "./branches.types";

/**
 * Edit one branch: where it is, how it is registered, and what it does
 * differently from the rest of the hospital. Every field left empty keeps
 * following the hospital's, shown as the placeholder.
 */

interface Props {
  branch: BranchRow;
  hospital: HospitalDefaults;
  onClose: () => void;
  onSaved: () => void;
}

const DETAIL_KEYS = ["addressLine1", "addressLine2", "landmark", "city", "state", "postalCode", "phone", "email", "gstNumber", "registrationNumber"] as const;
type DetailKey = (typeof DETAIL_KEYS)[number];

const FOLLOW = "";
/** Short forms for "Same as hospital · …", which must fit a third of the dialog. */
const VITALS_SHORT: Record<string, string> = { RECEPTIONIST: "Reception", NURSE: "Nurse" };
const LAB_SHORT: Record<string, string> = { PRE_PAID: "Pre-paid", POST_PAID: "Post-paid" };
const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function BranchDialog({ branch, hospital, onClose, onSaved }: Props) {
  const toast = useToast();
  const s = branch.settings;
  const [details, setDetails] = useState<Record<DetailKey, string>>(() =>
    Object.fromEntries(DETAIL_KEYS.map((k) => [k, branch[k] ?? ""])) as Record<DetailKey, string>);
  const [licensedBeds, setLicensedBeds] = useState(branch.licensedBeds != null ? String(branch.licensedBeds) : "");
  const [vitals, setVitals] = useState<string>(s?.vitalsCollector ?? FOLLOW);
  const [labBilling, setLabBilling] = useState<string>(s?.billingStrategy ?? FOLLOW);
  const [refundLimit, setRefundLimit] = useState(s?.refundApprovalThreshold != null ? String(Number(s.refundApprovalThreshold)) : "");
  const [ownOpd, setOwnOpd] = useState(!!s?.opdStartTime);
  const def = hospital.settings.opdHours;
  const [opd, setOpd] = useState({
    start: s?.opdStartTime ?? def.startTime, end: s?.opdEndTime ?? def.endTime, slot: String(s?.opdSlotMinutes ?? def.slotDurationMinutes),
  });
  const [logoUrl, setLogoUrl] = useState(branch.logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: DetailKey) => (e: React.ChangeEvent<HTMLInputElement>) => setDetails((d) => ({ ...d, [k]: e.target.value }));
  const field = (k: DetailKey, label: string, fallback: string | null | undefined, extra: Record<string, unknown> = {}) => (
    <TextField
      id={`branch-${k}`} label={label} fullWidth size="small" value={details[k]} onChange={set(k)}
      placeholder={fallback || undefined}
      InputLabelProps={{ shrink: true }}
      helperText={details[k] ? " " : fallback ? "Empty: the hospital's is used" : "Empty: not printed"}
      {...extra}
    />
  );

  const hospitalAddress = letterheadAddress(hospital);
  const inheritedLimit = Number(hospital.settings.refundApprovalThreshold).toLocaleString("en-IN");

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const k of DETAIL_KEYS) if ((branch[k] ?? "") !== details[k].trim()) body[k] = details[k].trim() || null;
      if ((branch.licensedBeds != null ? String(branch.licensedBeds) : "") !== licensedBeds.trim()) body.licensedBeds = licensedBeds.trim() || null;
      body.settings = {
        vitalsCollector: vitals || null,
        billingStrategy: labBilling || null,
        refundApprovalThreshold: refundLimit.trim() === "" ? null : Number(refundLimit),
        ...(ownOpd
          ? { opdStartTime: opd.start, opdEndTime: opd.end, opdSlotMinutes: Number(opd.slot) }
          : { opdStartTime: null, opdEndTime: null, opdSlotMinutes: null }),
      };
      await axiosInstance.patch(`/hospital/branches/${branch.branchId}`, body);
      toast.success(`${branch.branchName} saved`);
      onSaved();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't save the branch"));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    const form = new FormData();
    form.append("logo", file);
    setUploading(true);
    try {
      const res = await axiosInstance.post(`/hospital/branches/${branch.branchId}/logo`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setLogoUrl(res.data.data.logoUrl);
      toast.success("Logo uploaded");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't upload the logo"));
    } finally {
      setUploading(false);
    }
  };
  const clearLogo = async () => {
    try {
      await axiosInstance.delete(`/hospital/branches/${branch.branchId}/logo`);
      setLogoUrl(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't remove the logo"));
    }
  };

  const section = (title: string, note?: string) => (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      {note && <Typography variant="caption" sx={{ color: "text.secondary" }}>{note}</Typography>}
    </Box>
  );

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {branch.branchName}
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Leave a field empty to use the hospital's. Printouts made at this branch show what is set here.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {section("Address and contact", hospitalAddress
            ? `The branch's own address prints once Address line 1 is filled; until then the hospital's (${hospitalAddress}) prints.`
            : "The branch's own address prints once Address line 1 is filled.")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>{field("addressLine1", "Address line 1", hospital.addressLine1)}</Grid>
            <Grid size={{ xs: 12, md: 6 }}>{field("addressLine2", "Address line 2", null)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("landmark", "Landmark", null)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("city", "City", null)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("postalCode", "PIN code", null, { inputProps: { inputMode: "numeric", maxLength: 6 } })}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("state", "State", null)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("phone", "Phone", hospital.officialPhone)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("email", "Email", hospital.officialEmail)}</Grid>
          </Grid>

          <Divider />
          {section("Registration", "A branch in another state needs its own GSTIN; its bills print it.")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>{field("gstNumber", "GSTIN", hospital.gstNumber, { inputProps: { maxLength: 15, style: { textTransform: "uppercase" } } })}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{field("registrationNumber", "Registration / licence no.", hospital.registrationNumber)}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-licensedBeds" label="Licensed beds" fullWidth size="small" value={licensedBeds} InputLabelProps={{ shrink: true }}
                onChange={(e) => setLicensedBeds(e.target.value.replace(/\D/g, ""))} helperText="As on the establishment licence" />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ width: 64, height: 64, border: "1px solid", borderColor: "divider", borderRadius: 2, display: "grid", placeItems: "center", overflow: "hidden", bgcolor: "background.default" }}>
              {(logoUrl || hospital.logoUrl) && (
                <img src={assetUrl(logoUrl || hospital.logoUrl)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              )}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{logoUrl ? "This branch's logo" : "Uses the hospital's logo"}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Button size="small" variant="outlined" startIcon={<UploadRounded />} disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading…" : "Upload logo"}
                </Button>
                {logoUrl && <Button size="small" color="inherit" startIcon={<DeleteOutlineRounded />} onClick={clearLogo}>Use the hospital's</Button>}
              </Stack>
              <input ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
            </Box>
          </Stack>

          <Divider />
          {section("How this branch works")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-vitals" select fullWidth size="small" label="Who records vitals" value={vitals} onChange={(e) => setVitals(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value={FOLLOW}>Same as hospital · {VITALS_SHORT[hospital.settings.vitalsCollector]}</MenuItem>
                <MenuItem value="RECEPTIONIST">{VITALS_LABEL.RECEPTIONIST}</MenuItem>
                <MenuItem value="NURSE">{VITALS_LABEL.NURSE}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField id="branch-lab" select fullWidth size="small" label="Lab billing" value={labBilling} onChange={(e) => setLabBilling(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value={FOLLOW}>Same as hospital · {LAB_SHORT[hospital.settings.billingStrategy]}</MenuItem>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save branch"}</Button>
      </DialogActions>
    </Dialog>
  );
}
