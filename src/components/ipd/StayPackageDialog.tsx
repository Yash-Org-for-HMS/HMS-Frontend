import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, TextField, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Alert, Chip, Divider, MenuItem,
} from "@mui/material";
import { Inventory2Rounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatINR, formatDateTime } from "@/utils/format";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

const COVER_LABEL: Record<string, string> = {
  ROOM: "Room rent & nursing", DOCTOR_VISIT: "Doctor visits", INVESTIGATION: "Lab tests", RADIOLOGY: "Radiology",
  PHARMACY: "All medicines", PROCEDURE: "OT & procedures", IMPLANT: "Implants", CONSUMABLE: "Ward services & consumables", OTHER: "Other charges",
};
const PURPLE = "#7C3AED";
// The same codes as a ward medicine order (backend DOSES_PER_DAY).
const KIT_FREQUENCIES = [
  { value: "", label: "As needed" }, { value: "OD", label: "OD - once daily" }, { value: "BD", label: "BD - twice daily" },
  { value: "TDS", label: "TDS - thrice daily" }, { value: "QID", label: "QID - four times daily" }, { value: "HS", label: "HS - at bedtime" },
  { value: "STAT", label: "STAT - once, now" }, { value: "SOS", label: "SOS - as needed" },
];
const DOSES_PER_DAY: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1 };

type Content = { chargeItemId?: string | null; medicineId?: string | null; name: string; quantity: number };
type StayPackage = {
  admissionPackageId: string; name: string; price: number | string; startAt: string; endAt: string | null;
  includedDays: number | null; covers: string[]; contents: Content[];
  kit: { medicineId: string; name: string; included: number; requested: number; left: number }[];
};
type Option = { chargeItemId: string; name: string; price: number | null; includedDays: number | null; covers: string[]; includes: number };

/**
 * The package on an admission. The billing desk or the ward puts it on (priced
 * for the stay's room and payer); only the billing desk takes it off. Anyone on
 * the ward sends its medicine kit to the pharmacy. What it covers is not billed
 * at discharge. `canManage` = put on and take off; `canAdd` = put on only.
 */
export default function StayPackageDialog({ admissionId, patientName, canManage, canAdd = canManage, onClose }: {
  admissionId: string; patientName?: string; canManage: boolean; canAdd?: boolean; onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const key = ["stay-package", admissionId];
  const { data: pkg, isLoading, error } = useQuery<StayPackage | null>({
    queryKey: key,
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/package`)).data.data,
  });
  const changed = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["ipd-admission", admissionId] });
    qc.invalidateQueries({ queryKey: ["ipd-admission-meds", admissionId] });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Inventory2Rounded sx={{ color: PURPLE }} /> Package{patientName ? ` - ${patientName}` : ""}
      </DialogTitle>
      <DialogContent>
        {isLoading ? <DetailSkeleton /> : error ? <Alert severity="error">{getApiErrorMessage(error, "Couldn't load the package")}</Alert>
          : pkg ? <CurrentPackage admissionId={admissionId} pkg={pkg} canManage={canManage} onChanged={changed} toast={toast} />
            : canAdd ? <AddPackage admissionId={admissionId} onAdded={changed} toast={toast} />
              : <Typography variant="body2" sx={{ color: "text.secondary" }}>This stay has no package. The billing desk puts one on.</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button></DialogActions>
    </Dialog>
  );
}

type Toast = ReturnType<typeof useToast>;

function AddPackage({ admissionId, onAdded, toast }: { admissionId: string; onAdded: () => void; toast: Toast }) {
  const [input, setInput] = useState("");
  const term = useDebouncedValue(input, 250);
  const { data: options = [], isFetching } = useQuery<Option[]>({
    queryKey: ["stay-package-options", admissionId, term],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/package-options`, { params: { q: term.trim() || undefined } })).data.data,
  });
  const [picked, setPicked] = useState<Option | null>(null);
  const [price, setPrice] = useState("");
  const [startAt, setStartAt] = useState("");
  const [saving, setSaving] = useState(false);
  const needsPrice = picked?.price == null;
  const add = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admissionId}/package`, {
        chargeItemId: picked.chargeItemId,
        price: needsPrice ? Number(price) : undefined,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
      });
      toast.success(`${picked.name} put on the stay`);
      onAdded();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't add the package"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        The package's price is billed instead of what it covers. It is priced for the patient's room and insurer now; later changes to the package do not change this stay.
      </Typography>
      <Autocomplete<Option>
        options={options} value={picked} onChange={(_, o) => { setPicked(o); setPrice(""); }} loading={isFetching}
        inputValue={input} onInputChange={(_, v) => setInput(v)} filterOptions={(x) => x}
        getOptionLabel={(o) => o.name} isOptionEqualToValue={(o, v) => o.chargeItemId === v.chargeItemId}
        noOptionsText="No package - set one up in the Schedule of Charges"
        renderOption={(props, o) => (
          <li {...props} key={o.chargeItemId}>
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>{o.name}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                {[o.price == null ? "price typed for the patient" : formatINR(o.price), o.includedDays ? `${o.includedDays} days` : "until discharge", o.includes ? `${o.includes} included` : null].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => <TextField {...params} size="small" label="Package" placeholder="Search packages" />}
      />
      {picked && (
        <>
          {needsPrice
            ? <TextField size="small" type="number" label="Package price for this patient" value={price} onChange={(e) => setPrice(e.target.value)} inputProps={{ min: 1 }} />
            : <Typography variant="body2">Price for this stay: <strong>{formatINR(picked.price!)}</strong></Typography>}
          <TextField size="small" type="datetime-local" label="Starts" value={startAt} onChange={(e) => setStartAt(e.target.value)}
            InputLabelProps={{ shrink: true }} helperText="Blank = from admission. Charges before it are billed as usual." />
          {picked.covers.length > 0 && <Typography variant="caption" sx={{ color: "text.secondary" }}>Covers in full: {picked.covers.map((c) => COVER_LABEL[c] ?? c).join(", ")}</Typography>}
        </>
      )}
      <Box><Button variant="contained" disabled={!picked || saving || (needsPrice && !(Number(price) > 0))} onClick={add} sx={{ textTransform: "none" }}>{saving ? "Adding..." : "Put on the stay"}</Button></Box>
    </Stack>
  );
}

function CurrentPackage({ admissionId, pkg, canManage, onChanged, toast }: { admissionId: string; pkg: StayPackage; canManage: boolean; onChanged: () => void; toast: Toast }) {
  const [now] = useState(() => Date.now());
  const applies = now >= new Date(pkg.startAt).getTime() && (!pkg.endAt || now < new Date(pkg.endAt).getTime());
  const services = pkg.contents.filter((c) => c.chargeItemId);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(pkg.kit.map((k) => [k.medicineId, String(k.left)])));
  const [allergy, setAllergy] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

  // How each kit medicine is given - the frequency sets the doses a day the
  // chart counts, and with the days it works out how many to send.
  type Dosing = { dosage: string; frequency: string; durationDays: string; route: string };
  const [dosing, setDosing] = useState<Record<string, Dosing>>({});
  const dose = (id: string): Dosing => dosing[id] ?? { dosage: "", frequency: "", durationDays: "", route: "" };
  // Frequency × days fills "Send" (capped at what is left in the kit); with
  // either left blank, "Send" goes back to the whole of what is left.
  const autoCount = (d: Dosing): number | null => {
    if (d.frequency === "STAT") return 1;
    const perDay = DOSES_PER_DAY[d.frequency];
    return perDay && Number(d.durationDays) > 0 ? perDay * Number(d.durationDays) : null;
  };
  const setDose = (id: string, patch: Partial<Dosing>) => {
    const next = { ...dose(id), ...patch };
    setDosing((d) => ({ ...d, [id]: next }));
    if (!("frequency" in patch) && !("durationDays" in patch)) return;
    const left = pkg.kit.find((k) => k.medicineId === id)?.left ?? 0;
    const n = autoCount(next);
    setQty((q) => ({ ...q, [id]: String(n == null ? left : Math.min(n, left)) }));
  };
  const lines = pkg.kit.filter((k) => k.left > 0 && Number(qty[k.medicineId]) > 0).map((k) => {
    const d = dose(k.medicineId);
    return {
      medicineId: k.medicineId, quantity: Number(qty[k.medicineId]),
      dosage: d.dosage.trim() || undefined, frequency: d.frequency || undefined, route: d.route.trim() || undefined,
      durationDays: d.frequency && d.frequency !== "STAT" && Number(d.durationDays) > 0 ? Number(d.durationDays) : undefined,
    };
  });
  const badQty = pkg.kit.some((k) => qty[k.medicineId] !== "" && (!/^\d+$/.test(qty[k.medicineId] ?? "") || Number(qty[k.medicineId]) > k.left));
  const requestKit = async () => {
    setBusy(true);
    try {
      const res = await axiosInstance.post(`/ipd/admissions/${admissionId}/package/kit-request`, { lines, allergyOverrideReason: allergy ? overrideReason.trim() : undefined });
      toast.success(res.data?.message ?? "Kit sent to the pharmacy");
      setAllergy(null); setOverrideReason("");
      onChanged();
    } catch (e) {
      const body = (e as { response?: { data?: { code?: string; message?: string } } }).response?.data;
      if (body?.code === "ALLERGY_CONFLICT") setAllergy(body.message ?? "The kit clashes with a recorded allergy");
      else toast.error(getApiErrorMessage(e, "Couldn't send the kit"));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await axiosInstance.delete(`/ipd/admissions/${admissionId}/package`, { data: { reason: reason.trim() } });
      toast.success("Package taken off - everything is billed as usual");
      onChanged();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't take the package off"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: `${PURPLE}55`, bgcolor: `${PURPLE}0D` }}>
        <Typography sx={{ fontWeight: 700 }}>{pkg.name} - {formatINR(Number(pkg.price))}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          From {formatDateTime(pkg.startAt)} {pkg.endAt ? `to ${formatDateTime(pkg.endAt)} (${pkg.includedDays} days)` : "until discharge"}
          {!applies && " - ended; charges now are billed as usual"}
        </Typography>
        {pkg.covers.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
            {pkg.covers.map((c) => <Chip key={c} size="small" label={COVER_LABEL[c] ?? c} sx={{ height: 20, fontSize: "0.68rem", bgcolor: `${PURPLE}1A`, color: PURPLE, fontWeight: 600 }} />)}
          </Box>
        )}
        {services.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>Includes: {services.map((s) => `${s.name}${s.quantity > 1 ? ` × ${s.quantity}` : ""}`).join(", ")}</Typography>
        )}
      </Box>

      {pkg.kit.length > 0 && (
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Medicine kit</Typography>
          {pkg.kit.map((k) => (
            <Box key={k.medicineId} sx={{ py: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }} noWrap>{k.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{k.included} in the kit · {k.requested} requested · {k.left} left</Typography>
                </Box>
                {k.left > 0 && applies && (
                  <TextField size="small" label="Send" value={qty[k.medicineId] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [k.medicineId]: e.target.value.replace(/\D/g, "") }))}
                    error={Number(qty[k.medicineId]) > k.left} sx={{ width: 80 }} inputProps={{ inputMode: "numeric" }} />
                )}
              </Box>
              {k.left > 0 && applies && Number(qty[k.medicineId]) > 0 && (
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <TextField size="small" label="Dose" placeholder="e.g. 650mg" value={dose(k.medicineId).dosage} onChange={(e) => setDose(k.medicineId, { dosage: e.target.value })} sx={{ flex: 1 }} />
                  <TextField size="small" select label="Frequency" value={dose(k.medicineId).frequency} onChange={(e) => setDose(k.medicineId, { frequency: e.target.value })} sx={{ flex: 1.3 }}>
                    {KIT_FREQUENCIES.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Days" value={dose(k.medicineId).durationDays} disabled={!dose(k.medicineId).frequency || dose(k.medicineId).frequency === "STAT" || dose(k.medicineId).frequency === "SOS"}
                    onChange={(e) => setDose(k.medicineId, { durationDays: e.target.value.replace(/\D/g, "") })} sx={{ width: 70 }} inputProps={{ inputMode: "numeric" }} />
                  <TextField size="small" label="Route" placeholder="e.g. Oral" value={dose(k.medicineId).route} onChange={(e) => setDose(k.medicineId, { route: e.target.value })} sx={{ flex: 1 }} />
                </Box>
              )}
              {k.left > 0 && applies && (() => {
                const n = autoCount(dose(k.medicineId));
                if (n == null) return null;
                const d = dose(k.medicineId);
                const how = d.frequency === "STAT" ? "One dose now" : `${DOSES_PER_DAY[d.frequency]} a day × ${d.durationDays} days = ${n}`;
                return (
                  <Typography sx={{ fontSize: "0.72rem", color: n > k.left ? "warning.main" : "text.secondary", mt: 0.5 }}>
                    {how}{n > k.left ? ` - only ${k.left} left in the kit, so ${k.left} are sent; order the rest as a ward medicine` : ""}
                  </Typography>
                );
              })()}
            </Box>
          ))}
          {lines.length > 0 && <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>The kit shows on the medication chart once the pharmacy gives it; the nurse records each dose as it is given, counted against the frequency.</Typography>}
          {allergy && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {allergy}
              <TextField size="small" fullWidth sx={{ mt: 1 }} label="Reason to request it anyway" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </Alert>
          )}
          {applies
            ? <Button sx={{ mt: 1, textTransform: "none" }} variant="contained" disabled={busy || !lines.length || badQty || (!!allergy && overrideReason.trim().length < 3)} onClick={requestKit}>
                Send to pharmacy
              </Button>
            : <Typography variant="caption" sx={{ color: "text.secondary" }}>The package has ended - order medicines as usual.</Typography>}
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>The pharmacy gives them as a ward request; kit medicines are not billed. Anything beyond the kit is.</Typography>
        </Box>
      )}

      {canManage && (
        <>
          <Divider />
          {removing ? (
            <Stack spacing={1}>
              <TextField size="small" label="Why is the package taken off?" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient chose itemised billing" />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button color="error" variant="contained" disabled={busy || reason.trim().length < 3} onClick={remove} sx={{ textTransform: "none" }}>Take off</Button>
                <Button onClick={() => setRemoving(false)} sx={{ textTransform: "none" }}>Keep it</Button>
              </Box>
            </Stack>
          ) : (
            <Box><Button color="error" onClick={() => setRemoving(true)} sx={{ textTransform: "none" }}>Take the package off</Button></Box>
          )}
        </>
      )}
      <Divider />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>What the package covers shows at Rs 0 "in package" on the discharge bill.</Typography>
    </Stack>
  );
}
