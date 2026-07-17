import { ACCENTS } from "../../styles/accents";
import { getApiErrorMessage } from "../../utils/apiError";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, TextField, IconButton, Autocomplete,
  Paper, Grid, Alert, Divider, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Switch, FormControlLabel, Chip
} from "@mui/material";
import { DeleteRounded, SaveRounded, AddRounded, PrintRounded, ReplayRounded, WarningAmberRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import { useToast } from "../../providers/ToastContext";
import { useHospitalAuth } from "../../providers/HospitalAuthContext";
import { assetUrl } from "../../utils/assetUrl";
import DoseCalculator from "../../components/doctor/DoseCalculator";
import HeartbeatLoader from "../../components/HeartbeatLoader";

const DOCTOR_BLUE = ACCENTS.doctor;

interface PatientPrintInfo {
  name?: string;
  uhid?: string | null;
  age?: number | null;
  gender?: string | null;
}

interface PrescriptionWriterProps {
  consultationId?: string | null;
  patientId?: string;
  patientAllergies?: string[];
  patientInfo?: PatientPrintInfo;
  patientWeightKg?: number | null;
  diagnosis?: string;
  onRequireSave: () => Promise<string | undefined>;
}

export default function PrescriptionWriter({ consultationId, patientId, patientAllergies = [], patientInfo, patientWeightKg, diagnosis, onRequireSave }: PrescriptionWriterProps) {
  const [saving, setSaving] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const toast = useToast();
  const { hospital, user, branch } = useHospitalAuth();
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [dispensingStatus, setDispensingStatus] = useState<string | null>(null);
  const [bulkBuyOutside, setBulkBuyOutside] = useState(false);

  // Lightweight allergy safety net: direct name/generic match against the
  // patient's recorded allergies. This is NOT a drug-interaction engine — it
  // won't catch class cross-reactivity (e.g. penicillin → amoxicillin) — but it
  // reliably flags prescribing exactly what the patient is allergic to.
  const normalize = (s?: string | null) => (s || "").toLowerCase().trim();
  const allergyHitsFor = (medName?: string | null, generic?: string | null): string[] => {
    const names = [normalize(medName), normalize(generic)].filter(Boolean);
    return patientAllergies.filter((al) => {
      const a = normalize(al);
      if (a.length < 3) return false;
      return names.some((n) => n.length >= 3 && (n.includes(a) || a.includes(n)));
    });
  };
  const itemConflicts = items.map((it) => allergyHitsFor(it.medicineName, it.genericName));
  const hasAnyConflict = itemConflicts.some((c) => c.length > 0);

  // Autocomplete state
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicineOptions, setMedicineOptions] = useState<any[]>([]);
  const [medicineLoading, setMedicineLoading] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<any | null>(null);

  // New item state
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("1-0-1");
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [manualQuantity, setManualQuantity] = useState(false);
  const [unit, setUnit] = useState("Tab");

  useEffect(() => {
    if (!manualQuantity && frequency && durationDays && typeof durationDays === "number") {
      // Parse frequency like "1-0-1", "1+1", "1-1-1", or even numbers.
      const parts = frequency.split(/[-+]/).map(p => Number(p) || 0);
      const dosesPerDay = parts.length > 0 ? parts.reduce((sum, curr) => sum + curr, 0) : 0;
      
      if (dosesPerDay > 0) {
        setQuantity(dosesPerDay * durationDays);
      }
    }
  }, [frequency, durationDays, manualQuantity]);

  const { data: prescription, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["prescription", consultationId],
    queryFn: async () => (await axiosInstance.get(`/doctor/prescription/consultations/${consultationId}`)).data.data,
    enabled: !!consultationId,
  });

  // Seed the writer with the saved prescription for this consultation.
  useEffect(() => {
    if (!prescription) return;
    const data = prescription;
    setSpecialInstructions(data.specialInstructions || "");
    setItems(data.items || []);
    setDispensingStatus(data.dispensingStatus || null);

    // If all items are buyOutside, set bulk to true
    if (data.items && data.items.length > 0 && data.items.every((i: any) => i.buyOutside)) {
      setBulkBuyOutside(true);
    }
  }, [prescription]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (medicineQuery.length >= 2) {
        try {
          setMedicineLoading(true);
          const res = await axiosInstance.get(`/doctor/prescription/medicines?q=${medicineQuery}`);
          setMedicineOptions(res.data.data);
        } catch (err) {
          console.error("Failed to fetch medicines", err);
        } finally {
          setMedicineLoading(false);
        }
      } else {
        setMedicineOptions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [medicineQuery]);

  const handleAddItem = () => {
    const finalMedicine = selectedMedicine || medicineQuery.trim();

    if (!finalMedicine || !dosage || !frequency) {
      toast.error("Please fill medicine, dosage, and frequency.");
      return;
    }

    if (!durationDays && !quantity) {
      toast.error("Please provide either duration (Days) or Quantity.");
      return;
    }

    if (Number(quantity) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    // Handle freeSolo custom medicine (string) vs selected object
    const isCustom = typeof finalMedicine === "string";
    const medId = isCustom ? null : finalMedicine.medicineId;
    const medName = isCustom ? finalMedicine : finalMedicine.medicineName;
    const genName = isCustom ? null : finalMedicine.genericName;

    const newItem = {
      medicineId: medId,
      medicineName: medName,
      genericName: genName,
      dosage,
      frequency,
      durationDays: Number(durationDays) || 0,
      quantity: Number(quantity) || 0,
      unit,
      buyOutside: bulkBuyOutside
    };

    const hits = allergyHitsFor(medName, genName);
    if (hits.length) {
      toast.error(`⚠ Allergy alert: patient is allergic to ${hits.join(", ")}. Added — review before saving.`);
    }

    setItems([...items, newItem]);
    
    // Reset form
    setSelectedMedicine(null);
    setMedicineQuery("");
    setMedicineQuery("");
    setDosage("");
    setFrequency("1-0-1");
    setDurationDays("");
    setQuantity("");
    setManualQuantity(false);
    setUnit("Tab");
  };

  const handleRepeatLast = async () => {
    if (!patientId) {
      toast.error("No patient context available.");
      return;
    }
    try {
      setRepeating(true);
      const res = await axiosInstance.get(`/doctor/prescription/patients/${patientId}/last`, {
        params: consultationId ? { excludeConsultationId: consultationId } : {},
      });
      const last = res.data?.data;
      if (!last || !last.items?.length) {
        toast.error("No previous prescription found for this patient.");
        return;
      }
      // Merge in, skipping medicines already on the list (same name + dosage).
      const existingKeys = new Set(items.map((i) => `${normalize(i.medicineName)}|${normalize(i.dosage)}`));
      const toAdd = last.items
        .filter((i: any) => !existingKeys.has(`${normalize(i.medicineName)}|${normalize(i.dosage)}`))
        .map((i: any) => ({ ...i, buyOutside: i.buyOutside || false }));
      if (toAdd.length === 0) {
        toast.error("All medicines from the last visit are already added.");
        return;
      }
      setItems([...items, ...toAdd]);
      if (!specialInstructions && last.specialInstructions) setSpecialInstructions(last.specialInstructions);
      const dateStr = last.prescriptionDate
        ? new Date(last.prescriptionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "the previous visit";
      toast.success(`Added ${toAdd.length} medicine${toAdd.length === 1 ? "" : "s"} from ${dateStr}.`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to load the last prescription."));
    } finally {
      setRepeating(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const toggleBulkBuyOutside = (checked: boolean) => {
    setBulkBuyOutside(checked);
    setItems(items.map(item => ({ ...item, buyOutside: checked })));
  };

  const toggleItemBuyOutside = (index: number, checked: boolean) => {
    const newItems = [...items];
    newItems[index].buyOutside = checked;
    setItems(newItems);
    if (!checked) setBulkBuyOutside(false);
    if (checked && newItems.every(i => i.buyOutside)) setBulkBuyOutside(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let targetConsultationId = consultationId;

      if (!targetConsultationId) {
        // Trigger a draft save on the parent workspace to generate consultationId
        targetConsultationId = await onRequireSave();
        if (!targetConsultationId) {
          throw new Error("Could not create consultation draft. Save failed.");
        }
      }

      await axiosInstance.post(`/doctor/prescription/consultations/${targetConsultationId}`, {
        patientId,
        specialInstructions,
        items
      });

      // Update status locally based on items
      const allExternal = items.length > 0 && items.every(i => i.buyOutside);
      setDispensingStatus(allExternal ? "external" : "pending");

      toast.success("Prescription saved successfully!");
} catch (err: unknown) {
      toast.error(getApiErrorMessage(err, (err instanceof Error && err.message) || "Failed to save prescription"));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (items.length === 0) {
      toast.error("Add at least one medicine to print.");
      return;
    }

    const esc = (s: any) =>
      String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const logo = hospital?.logoUrl ? assetUrl(hospital.logoUrl) : "";
    const doctorName = `Dr. ${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    const doctorRole = user?.roleName || "Doctor";

    const rowsHtml = items
      .map(
        (it, i) => `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;color:#64748b">${i + 1}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb">
            <span style="font-weight:700">${esc(it.medicineName || "—")}</span>
            ${it.genericName ? `<div style="font-size:11px;color:#64748b">${esc(it.genericName)}</div>` : ""}
            ${it.buyOutside ? `<span style="display:inline-block;margin-top:2px;font-size:10px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:4px;padding:1px 6px">BUY OUTSIDE</span>` : ""}
          </td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb">${esc(it.dosage)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb">${esc(it.frequency)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb">${it.durationDays ? esc(it.durationDays) + " days" : "—"}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb">${esc(it.quantity)} ${esc(it.unit || "")}</td>
        </tr>`
      )
      .join("");

    const patientBits = [
      patientInfo?.name ? `<span><b>Patient:</b> ${esc(patientInfo.name)}</span>` : "",
      patientInfo?.uhid ? `<span><b>UHID:</b> ${esc(patientInfo.uhid)}</span>` : "",
      patientInfo?.age != null ? `<span><b>Age:</b> ${esc(patientInfo.age)}y</span>` : "",
      patientInfo?.gender ? `<span><b>Sex:</b> ${esc(patientInfo.gender)}</span>` : "",
    ].filter(Boolean).join("");

    const allergyHtml = patientAllergies.length
      ? `<div style="margin-top:6px;font-size:12px;color:#b91c1c"><b>Allergies:</b> ${esc(patientAllergies.join(", "))}</div>`
      : "";

    const html = `
      <div style="max-width:760px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3b82f6;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:12px">
            ${logo ? `<img src="${esc(logo)}" alt="" style="height:48px;width:48px;object-fit:contain;border-radius:8px" />` : ""}
            <div>
              <div style="font-size:20px;font-weight:800">${esc(hospital?.name || "Hospital")}</div>
              ${branch?.name ? `<div style="font-size:12px;color:#64748b">${esc(branch.name)} Branch</div>` : ""}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;color:#64748b">Date</div>
            <div style="font-weight:700">${today}</div>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:6px 20px;font-size:13px;color:#334155;margin-top:14px">
          ${patientBits}
        </div>
        ${diagnosis ? `<div style="margin-top:6px;font-size:13px"><b>Diagnosis:</b> ${esc(diagnosis)}</div>` : ""}
        ${allergyHtml}

        <div style="font-size:36px;font-weight:800;color:#3b82f6;margin:18px 0 4px;line-height:1">&#8478;</div>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:8px 6px;width:28px">#</th>
              <th style="padding:8px 6px">Medicine</th>
              <th style="padding:8px 6px">Dosage</th>
              <th style="padding:8px 6px">Frequency</th>
              <th style="padding:8px 6px">Duration</th>
              <th style="padding:8px 6px">Qty</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        ${specialInstructions
          ? `<div style="margin-top:16px;font-size:13px"><b>Instructions:</b><div style="margin-top:4px;color:#334155;white-space:pre-wrap">${esc(specialInstructions)}</div></div>`
          : ""}

        <div style="margin-top:48px;display:flex;justify-content:flex-end">
          <div style="text-align:center;min-width:220px">
            <div style="border-top:1px solid #94a3b8;padding-top:6px;font-weight:700">${esc(doctorName)}</div>
            <div style="font-size:12px;color:#64748b">${esc(doctorRole)}</div>
          </div>
        </div>
        <div style="margin-top:24px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px dashed #cbd5e1;padding-top:8px">
          This prescription is not valid without the doctor's signature. Generated by ${esc(hospital?.name || "HMS")}.
        </div>
      </div>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>Prescription</title>` +
      `<style>@page{margin:14mm} body{margin:0;padding:16px;font-family:Inter,Arial,sans-serif;}</style>` +
      `</head><body>${html}</body></html>`
    );
    doc.close();
    const win = iframe.contentWindow!;
    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    win.onafterprint = cleanup;
    setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 300);
  };

  if (loading) {
    return <FormSkeleton header={false} />;
  }

  if (isError) {
    return <Box sx={{ p: 4 }}><ErrorState message={getApiErrorMessage(error, "Failed to load prescription")} onRetry={refetch} /></Box>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Toolbar: recorded allergies + repeat-last shortcut */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          {patientAllergies.length > 0 ? (
            <Typography variant="caption" sx={{ color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
              <WarningAmberRounded sx={{ fontSize: 16 }} /> Known allergies: {patientAllergies.join(", ")}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>No recorded allergies</Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={repeating ? <HeartbeatLoader size={22} /> : <ReplayRounded />}
          onClick={handleRepeatLast}
          disabled={repeating || dispensingStatus === "dispensed"}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Repeat last Rx
        </Button>
      </Box>

      {hasAnyConflict && (
        <Alert severity="error" icon={<WarningAmberRounded />}>
          <strong>Allergy alert:</strong> this prescription includes medicine(s) matching the patient's recorded allergies. Review highlighted rows before saving.
        </Alert>
      )}

{dispensingStatus && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>Status:</Typography>
          {dispensingStatus === "pending" && <Chip label="Sent to Pharmacy" color="warning" size="small" />}
          {dispensingStatus === "dispensed" && <Chip label="Dispensed" color="success" size="small" />}
          {dispensingStatus === "external" && <Chip label="Buy Outside (External)" color="default" size="small" />}
        </Box>
      )}

      {dispensingStatus === "dispensed" && (
        <Box sx={{ bgcolor: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 2, p: 1 }}>
          <Mascot pose="nice-work" title="Dispensed!" subtitle="This prescription has been filled by the pharmacy." size={110} />
        </Box>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Add Medicine</Typography>
          <FormControlLabel
            control={<Switch checked={bulkBuyOutside} onChange={(e) => toggleBulkBuyOutside(e.target.checked)} color="primary" />}
            label={<Typography variant="body2" fontWeight={600} color={bulkBuyOutside ? "primary.main" : "text.secondary"}>Buy Outside (All items)</Typography>}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Autocomplete
            freeSolo
            options={medicineOptions}
            getOptionLabel={(option) => {
               if (typeof option === "string") return option;
               let label = option.medicineName || "Unknown Brand";
               if (option.genericName) label += ` (${option.genericName})`;
               return label;
            }}
            loading={medicineLoading}
            noOptionsText={<Mascot pose="no-matches" subtitle="No matching medicines" size={72} sx={{ py: 1 }} />}
            value={selectedMedicine}
            onInputChange={(e, newInputValue) => setMedicineQuery(newInputValue)}
            onChange={(e, newValue) => setSelectedMedicine(newValue)}
            renderOption={(props, option) => (
              <Box component="li" {...props} sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <Box>
                  <Typography variant="body2">{option.medicineName} <Typography component="span" variant="caption" color="text.secondary">({option.genericName})</Typography></Typography>
                </Box>
                {option.inStock <= 0 ? (
                  <Typography variant="caption" color="error" fontWeight={700}>[OUT OF STOCK]</Typography>
                ) : (
                  <Typography variant="caption" color="success.main">Stock: {option.inStock}</Typography>
                )}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Medicine or Type Custom"
                placeholder="e.g. Paracetamol"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {medicineLoading ? <HeartbeatLoader size={22} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <TextField
            fullWidth size="small" label="Dosage" placeholder="e.g. 500mg"
            value={dosage} onChange={e => setDosage(e.target.value)}
            InputProps={{
              endAdornment: (
                <DoseCalculator
                  ageYears={patientInfo?.age ?? null}
                  weightKg={patientWeightKg ?? null}
                  onApply={(mg) => setDosage(`${mg}mg`)}
                />
              ),
            }}
          />
          <TextField 
            fullWidth size="small" label="Frequency" placeholder="e.g. 1-0-1" 
            value={frequency} onChange={e => setFrequency(e.target.value)} 
          />
          <TextField 
            fullWidth size="small" label="Days" type="number" 
            value={durationDays} onChange={e => {
              setDurationDays(e.target.value === "" ? "" : Number(e.target.value));
              setManualQuantity(false); // reset manual flag if they change days
            }} 
          />
          <TextField 
            fullWidth size="small" label="Qty" type="number" 
            value={quantity} onChange={e => {
              setQuantity(e.target.value === "" ? "" : Number(e.target.value));
              setManualQuantity(true); // flag that user manually overrode quantity
            }} 
          />
          <Button 
            fullWidth variant="contained" 
            startIcon={<AddRounded />}
            sx={{ bgcolor: DOCTOR_BLUE }} 
            onClick={handleAddItem}
          >
            Add Medicine
          </Button>
        </Box>
      </Paper>

      {items.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "background.default" }}>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell>Dosage</TableCell>
                <TableCell>Frequency</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell align="center">Buy Outside</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index} sx={{ opacity: item.buyOutside ? 0.7 : 1, bgcolor: itemConflicts[index]?.length ? "rgba(239,68,68,0.06)" : "transparent" }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      {itemConflicts[index]?.length > 0 && (
                        <Tooltip title={`Allergy match: ${itemConflicts[index].join(", ")}`}>
                          <WarningAmberRounded sx={{ color: "#ef4444", fontSize: 18 }} />
                        </Tooltip>
                      )}
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{item.medicineName || "Custom"}</Typography>
                        {item.genericName && <Typography variant="caption" color="text.secondary">{item.genericName}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{item.dosage}</TableCell>
                  <TableCell>{item.frequency}</TableCell>
                  <TableCell>{item.durationDays}</TableCell>
                  <TableCell>{item.quantity} {item.unit}</TableCell>
                  <TableCell align="center">
                    <Switch 
                      size="small" 
                      checked={item.buyOutside || false} 
                      onChange={(e) => toggleItemBuyOutside(index, e.target.checked)} 
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Special Instructions</Typography>
        <TextField
          fullWidth multiline rows={3}
          placeholder="Take medicine after meals, avoid cold water..."
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
        <Button 
          variant="outlined" 
          startIcon={<PrintRounded />}
          onClick={handlePrint}
        >
          Print
        </Button>
        <Button 
          variant="contained" 
          startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
          sx={{ bgcolor: DOCTOR_BLUE }}
          onClick={handleSave}
          disabled={saving}
        >
          Save Prescription
        </Button>
      </Box>
    </Box>
  );
}
