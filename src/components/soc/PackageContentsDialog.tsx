import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, IconButton, Tooltip, TextField, Autocomplete, Checkbox, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Divider, Alert,
} from "@mui/material";
import { DeleteRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatINRAuto } from "@/utils/format";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

/** Bill sections a package can cover in full on an admission (the backend's PACKAGE_COVERS). */
const COVERS: { key: string; label: string }[] = [
  { key: "ROOM", label: "Room rent & nursing" },
  { key: "DOCTOR_VISIT", label: "Doctor visits" },
  { key: "INVESTIGATION", label: "Lab tests" },
  { key: "RADIOLOGY", label: "Radiology" },
  { key: "PHARMACY", label: "All medicines" },
  { key: "PROCEDURE", label: "OT & procedures" },
  { key: "CONSUMABLE", label: "Ward services & consumables" },
  { key: "OTHER", label: "Other charges" },
];

type Line = { kind: "SERVICE" | "MEDICINE"; chargeItemId: string | null; medicineId: string | null; name: string; group: string | null; quantity: string; unitPrice: number | null };
type PackageData = {
  chargeItemId: string; itemName: string; price: number | null; isPackage: boolean;
  includedDays: number | null; covers: string[]; notes: string | null;
  items: (Omit<Line, "quantity"> & { quantity: number })[];
};
type ServiceOption = { chargeItemId: string; itemName: string; price: number | string; itemType?: string; priceAtBilling?: boolean; category?: { categoryName: string } };
type MedicineOption = { medicineId: string; medicineName: string | null; genericName: string; sellingPrice: number | string };

const inr = (n: number) => formatINRAuto(n);

/**
 * What a package includes: tests and services, a medicine kit, and - for an
 * admission - the days of stay and the bill sections it pays in full. Its own
 * price stays on the Schedule of Charges line, by room class and price list.
 */
export default function PackageContentsDialog({ chargeItemId, canEdit, onClose, onSaved }: {
  chargeItemId: string; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { data, isLoading, error } = useQuery<PackageData>({
    queryKey: ["soc-package", chargeItemId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/items/${chargeItemId}/package`)).data.data,
    gcTime: 0,
  });
  if (data) return <PackageForm data={data} canEdit={canEdit} onClose={onClose} onSaved={onSaved} />;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Package</DialogTitle>
      <DialogContent>{isLoading ? <DetailSkeleton /> : <Alert severity="error">{getApiErrorMessage(error, "Couldn't load the package")}</Alert>}</DialogContent>
      <DialogActions><Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button></DialogActions>
    </Dialog>
  );
}

/** The form, started from the loaded package. */
function PackageForm({ data, canEdit, onClose, onSaved }: { data: PackageData; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const chargeItemId = data.chargeItemId;
  const [lines, setLines] = useState<Line[]>(() => data.items.map((l) => ({ ...l, quantity: String(l.quantity) })));
  const [days, setDays] = useState(data.includedDays ? String(data.includedDays) : "");
  const [covers, setCovers] = useState<string[]>(data.covers);
  const [notes, setNotes] = useState(data.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Pickers: a Schedule of Charges line, a medicine.
  const [serviceInput, setServiceInput] = useState("");
  const serviceTerm = useDebouncedValue(serviceInput, 250);
  const { data: serviceOptions = [] } = useQuery<ServiceOption[]>({
    queryKey: ["soc-search", serviceTerm],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/search", { params: { q: serviceTerm.trim() } })).data.data.items,
    enabled: canEdit && serviceTerm.trim().length > 0,
  });
  const [medicineInput, setMedicineInput] = useState("");
  const medicineTerm = useDebouncedValue(medicineInput, 250);
  const { data: medicineOptions = [] } = useQuery<MedicineOption[]>({
    queryKey: ["ipd-medicine-catalog", medicineTerm],
    queryFn: async () => (await axiosInstance.get("/ipd/medicines-catalog", { params: { search: medicineTerm.trim() || undefined } })).data.data,
    enabled: canEdit,
  });

  const services = lines.filter((l) => l.kind === "SERVICE");
  const medicines = lines.filter((l) => l.kind === "MEDICINE");
  const qtyOk = (q: string) => /^\d+$/.test(q) && Number(q) >= 1 && Number(q) <= 9999;
  const daysOk = days.trim() === "" || (/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365);
  const bad = !daysOk || lines.some((l) => !qtyOk(l.quantity));
  const value = lines.reduce((s, l) => s + (l.unitPrice ?? 0) * (Number(l.quantity) || 0), 0);
  const empty = !lines.length && !covers.length && days.trim() === "";

  const addService = (o: ServiceOption | null) => {
    if (!o) return;
    if (o.chargeItemId === chargeItemId) { toast.error("A package cannot include itself"); return; }
    if (o.itemType === "BED") { toast.error("Room rent is covered by ticking \"Room rent & nursing\" below"); return; }
    if (lines.some((l) => l.chargeItemId === o.chargeItemId)) { toast.error(`${o.itemName} is already in the package - change its quantity`); return; }
    setLines((ls) => [...ls, { kind: "SERVICE", chargeItemId: o.chargeItemId, medicineId: null, name: o.itemName, group: o.category?.categoryName ?? null, quantity: "1", unitPrice: o.priceAtBilling ? null : Number(o.price) }]);
    setServiceInput("");
  };
  const addMedicine = (o: MedicineOption | null) => {
    if (!o) return;
    if (lines.some((l) => l.medicineId === o.medicineId)) { toast.error(`${o.medicineName ?? o.genericName} is already in the kit - change its quantity`); return; }
    setLines((ls) => [...ls, { kind: "MEDICINE", chargeItemId: null, medicineId: o.medicineId, name: o.medicineName ?? o.genericName, group: null, quantity: "1", unitPrice: Number(o.sellingPrice) }]);
    setMedicineInput("");
  };
  const setQty = (l: Line, quantity: string) => setLines((ls) => ls.map((x) => (x === l ? { ...x, quantity } : x)));
  const remove = (l: Line) => setLines((ls) => ls.filter((x) => x !== l));

  const save = async () => {
    if (empty && data.isPackage && !(await confirm({ title: "Stop being a package?", message: `${data.itemName} will include nothing and bill as a plain charge.`, confirmText: "Save" }))) return;
    setSaving(true);
    try {
      await axiosInstance.put(`/hospital/soc/items/${chargeItemId}/package`, {
        includedDays: days.trim() === "" ? null : Number(days),
        covers,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ chargeItemId: l.chargeItemId, medicineId: l.medicineId, quantity: Number(l.quantity) })),
      });
      toast.success(empty ? "Package contents removed" : "Package saved");
      onSaved();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't save the package"));
    } finally {
      setSaving(false);
    }
  };

  const lineRows = (rows: Line[], emptyText: string) => (
    rows.length === 0
      ? <Typography variant="body2" sx={{ color: "text.disabled", py: 1 }}>{emptyText}</Typography>
      : rows.map((l) => (
        <Box key={(l.chargeItemId ?? l.medicineId)!} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }} noWrap>{l.name}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              {[l.group, l.unitPrice == null ? "priced at billing" : `${inr(l.unitPrice)} each`].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          {canEdit
            ? <TextField size="small" label="Qty" value={l.quantity} onChange={(e) => setQty(l, e.target.value.replace(/\D/g, ""))} error={!qtyOk(l.quantity)} sx={{ width: 80 }} inputProps={{ inputMode: "numeric" }} />
            : <Typography sx={{ fontSize: "0.875rem" }}>× {l.quantity}</Typography>}
          {canEdit && <Tooltip title="Take out"><IconButton size="small" onClick={() => remove(l)}><DeleteRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton></Tooltip>}
        </Box>
      ))
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{data.itemName} - what it includes</DialogTitle>
      <DialogContent>
        {(
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The package is billed at its own price{data.price != null ? ` (${inr(data.price)} Standard)` : ""}; what it includes is not billed again.
              A health check-up needs only its tests. A stay package can also include days, bill sections and a medicine kit.
            </Typography>

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Tests & services</Typography>
              {lineRows(services, "None - add a test, scan, consultation or procedure.")}
              {canEdit && (
                <Autocomplete<ServiceOption>
                  sx={{ mt: 1 }} size="small" options={serviceOptions.filter((o) => o.itemType !== "BED" && o.chargeItemId !== chargeItemId)}
                  value={null} inputValue={serviceInput} onInputChange={(_, v, reason) => { if (reason !== "reset") setServiceInput(v); }}
                  onChange={(_, o) => addService(o)} filterOptions={(x) => x} blurOnSelect
                  getOptionLabel={(o) => o.itemName} isOptionEqualToValue={(o, v) => o.chargeItemId === v.chargeItemId}
                  noOptionsText={serviceInput.trim() ? "No charge by that name" : "Type to search the Schedule of Charges"}
                  renderOption={(props, o) => (
                    <li {...props} key={o.chargeItemId}>
                      <Box><Typography sx={{ fontSize: "0.875rem" }}>{o.itemName}</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{[o.category?.categoryName, o.priceAtBilling ? "priced at billing" : inr(Number(o.price))].filter(Boolean).join(" · ")}</Typography></Box>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} label="Add a test or service" placeholder="e.g. CBC, X-ray chest, Consultation" />}
                />
              )}
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Medicine kit</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>For an admitted patient, the ward requests the kit from the pharmacy in one go; kit medicines are not billed.</Typography>
              {lineRows(medicines, "No medicines.")}
              {canEdit && (
                <Autocomplete<MedicineOption>
                  sx={{ mt: 1 }} size="small" options={medicineOptions}
                  value={null} inputValue={medicineInput} onInputChange={(_, v, reason) => { if (reason !== "reset") setMedicineInput(v); }}
                  onChange={(_, o) => addMedicine(o)} filterOptions={(x) => x} blurOnSelect
                  getOptionLabel={(o) => o.medicineName ?? o.genericName} isOptionEqualToValue={(o, v) => o.medicineId === v.medicineId}
                  renderOption={(props, o) => (
                    <li {...props} key={o.medicineId}>
                      <Box><Typography sx={{ fontSize: "0.875rem" }}>{o.medicineName ?? o.genericName}</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{[o.genericName, inr(Number(o.sellingPrice))].join(" · ")}</Typography></Box>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} label="Add a medicine" placeholder="e.g. Dolo 650" />}
                />
              )}
            </Box>

            <Divider />
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>For an admitted patient</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                Leave these empty for a package sold to outpatients (a health check-up). Ticked sections are paid in full by the package while it lasts; anything else, and every day after it, is billed as usual.
              </Typography>
              <TextField size="small" label="Days of stay included" value={days} disabled={!canEdit}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} error={!daysOk}
                helperText={!daysOk ? "1 to 365" : "Blank = until discharge"} sx={{ width: 220, mb: 1 }} inputProps={{ inputMode: "numeric" }} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                {COVERS.map((c) => (
                  <FormControlLabel key={c.key} disabled={!canEdit} label={c.label}
                    control={<Checkbox size="small" checked={covers.includes(c.key)} onChange={(e) => setCovers((cs) => (e.target.checked ? [...cs, c.key] : cs.filter((x) => x !== c.key)))} />} />
                ))}
              </Box>
            </Box>

            <TextField size="small" label="Notes (shown with the package)" value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} placeholder="e.g. Implant charged separately; ICU stay not included" />

            {lines.length > 0 && (
              <Alert severity="info" icon={false}>
                Included tests, services and medicines come to <strong>{inr(value)}</strong> at Standard prices
                {data.price != null ? <> - the package is <strong>{inr(data.price)}</strong></> : null}.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>{canEdit ? "Cancel" : "Close"}</Button>
        {canEdit && <Button variant="contained" onClick={save} disabled={saving || bad || (empty && !data.isPackage)} sx={{ textTransform: "none" }}>{saving ? "Saving..." : "Save"}</Button>}
      </DialogActions>
    </Dialog>
  );
}
