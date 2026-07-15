import { useState } from "react";
import { formatINR } from "../../utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete,
  Stack, Typography, Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Divider, Tooltip, Chip, Tabs, Tab, MenuItem,
} from "@mui/material";
import {
  MedicationRounded, AddRounded, DeleteOutlineRounded, ReceiptLongRounded, HourglassTopRounded, CheckCircleRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import MarChart from "./MarChart";

// Standard frequency codes drive the MAR dose schedule (see backend
// buildDoseSchedule) AND how many units the stay will need in total.
// SOS/PRN and blank have no fixed schedule — quantity stays a manual entry.
const FREQUENCY_OPTIONS = [
  { value: "", label: "—" },
  { value: "OD", label: "OD — once daily" },
  { value: "BD", label: "BD — twice daily" },
  { value: "TDS", label: "TDS — thrice daily" },
  { value: "QID", label: "QID — four times daily" },
  { value: "HS", label: "HS — at bedtime" },
  { value: "STAT", label: "STAT — immediately (once)" },
  { value: "SOS", label: "SOS — as needed" },
];
// Doses per day per frequency — mirrors the backend's buildDoseSchedule times.
const TIMES_PER_DAY: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1 };
const isScheduledFrequency = (f: string) => !!f && f !== "SOS";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientId, patientName }
}

const emptyForm = { medicine: null as any, quantity: "1", unitsPerDose: "1", dosage: "", frequency: "", durationDays: "", route: "", notes: "" };

export default function IpdMedicinesDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<"assign" | "chart">("assign");

  const medsKey = ["ipd-admission-meds", admission?.admissionId];
  const { data, isFetching, refetch } = useQuery<{ medications: any[]; total: number }>({
    queryKey: medsKey,
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/medications`)).data.data,
    enabled: open && !!admission?.admissionId,
  });
  const meds = data?.medications || [];

  const { data: catalog = [], isFetching: catLoading } = useQuery<any[]>({
    queryKey: ["ipd-medicine-catalog", search],
    queryFn: async () => (await axiosInstance.get("/ipd/medicines-catalog", { params: { search: search || undefined } })).data.data,
    enabled: open,
  });

  // For a standard frequency (OD/BD/TDS/QID/HS/STAT), the total quantity needed
  // for the stay is computable — no need to make anyone type it by hand.
  // SOS/as-needed has no fixed schedule, so it stays a manual entry.
  const scheduled = isScheduledFrequency(form.frequency);
  const computedQty = (() => {
    if (!scheduled) return null;
    const unitsPerDose = Number(form.unitsPerDose);
    if (!Number.isFinite(unitsPerDose) || unitsPerDose <= 0) return null;
    if (form.frequency === "STAT") return Math.ceil(unitsPerDose);
    const perDay = TIMES_PER_DAY[form.frequency];
    if (!perDay) return null;
    const days = Number(form.durationDays) > 0 ? Number(form.durationDays) : 1;
    return Math.ceil(perDay * days * unitsPerDose);
  })();
  const qty = scheduled ? (computedQty ?? 0) : Number(form.quantity);
  const lineTotal = form.medicine && qty > 0 ? Number(form.medicine.sellingPrice) * qty : 0;
  const canAdd = !!form.medicine && Number.isInteger(qty) && qty > 0;

  const afterChange = () => {
    refetch();
    // Keep the discharge preview / bill total honest.
    qc.invalidateQueries({ queryKey: ["ipd-admission", admission?.admissionId] });
  };

  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/medications`, {
        medicineId: form.medicine.medicineId,
        quantity: qty,
        dosage: form.dosage || undefined,
        frequency: form.frequency || undefined,
        durationDays: form.durationDays ? Number(form.durationDays) : undefined,
        route: form.route || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Medicine assigned");
      setForm(emptyForm);
      setSearch("");
      afterChange();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign medicine");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: any) => {
    const ok = await confirm({
      title: m.status === "REQUESTED" ? "Retract request" : "Remove medicine",
      message: m.status === "REQUESTED"
        ? `Retract the request for ${m.medicineName || "this medicine"}? It hasn't been dispensed yet.`
        : `Remove ${m.medicineName || "this medicine"}? The dispensed stock will be returned.`,
      confirmText: m.status === "REQUESTED" ? "Retract" : "Remove",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(m.ipMedOrderId);
    try {
      await axiosInstance.delete(`/ipd/admissions/${admission.admissionId}/medications/${m.ipMedOrderId}`);
      toast.success("Medicine removed");
      afterChange();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <MedicationRounded sx={{ color: "#0891b2" }} /> Medicines
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider", "& .Mui-selected": { color: "#0891b2 !important" }, "& .MuiTabs-indicator": { bgcolor: "#0891b2" } }}>
        <Tab value="assign" label="Assign & Bill" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab value="chart" label="Medication Chart" sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName} — assigning a medicine sends a request to the pharmacy; once they confirm it (dispensed from stock), it's added to the discharge bill.
        </Typography>

        {view === "chart" ? (
          <MarChart admissionId={admission.admissionId} />
        ) : (
        <>
        {meds.length > 0 && (
          <TableContainer sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Medicine</TableCell>
                  <TableCell>Dosage / Frequency</TableCell>
                  <TableCell align="center">Qty</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Ordered</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meds.map((m) => (
                  <TableRow key={m.ipMedOrderId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.medicineName || "—"}</Typography>
                      {m.route && <Typography variant="caption" sx={{ color: "text.secondary" }}>{m.route}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: "block" }}>{[m.dosage, m.frequency].filter(Boolean).join(" · ") || "—"}</Typography>
                      {m.durationDays ? <Typography variant="caption" sx={{ color: "text.secondary" }}>{m.durationDays} day(s)</Typography> : null}
                    </TableCell>
                    <TableCell align="center">{m.quantity}</TableCell>
                    <TableCell align="right">{formatINR(m.totalPrice)}</TableCell>
                    <TableCell>{m.orderedAt ? dayjs(m.orderedAt).format("DD MMM") : "—"}</TableCell>
                    <TableCell>
                      {m.status === "REQUESTED" && (
                        <Chip icon={<HourglassTopRounded sx={{ fontSize: 14 }} />} label="Awaiting pharmacy" size="small" sx={{ bgcolor: "rgba(245,158,11,0.12)", color: "#b45309", fontWeight: 700 }} />
                      )}
                      {m.status === "ACTIVE" && (
                        <Chip icon={<CheckCircleRounded sx={{ fontSize: 14 }} />} label="Dispensed" size="small" sx={{ bgcolor: "rgba(16,185,129,0.12)", color: "#059669", fontWeight: 700 }} />
                      )}
                      {m.status === "BILLED" && (
                        <Chip icon={<ReceiptLongRounded sx={{ fontSize: 14 }} />} label="Billed" size="small" sx={{ bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2", fontWeight: 700 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {m.status !== "BILLED" && (
                        <Tooltip title={m.status === "REQUESTED" ? "Retract request" : "Remove (returns stock)"}>
                          <IconButton size="small" disabled={busyId === m.ipMedOrderId} onClick={() => remove(m)} sx={{ color: "#ef4444" }}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontWeight: 700, borderBottom: 0 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, borderBottom: 0 }}>{formatINR(data?.total || 0)}</TableCell>
                  <TableCell colSpan={3} sx={{ borderBottom: 0 }} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>Assign Medicine</Typography>
        </Divider>

        <Stack spacing={2}>
          <Autocomplete
            options={catalog}
            loading={catLoading}
            value={form.medicine}
            onChange={(_, v) => setForm({ ...form, medicine: v })}
            onInputChange={(_, v, reason) => { if (reason === "input") setSearch(v); }}
            getOptionLabel={(o: any) => (o ? `${o.medicineName}${o.genericName ? ` (${o.genericName})` : ""}` : "")}
            isOptionEqualToValue={(o: any, v: any) => o.medicineId === v?.medicineId}
            renderOption={(props, o: any) => (
              <li {...props} key={o.medicineId}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span>{o.medicineName}{o.genericName ? ` · ${o.genericName}` : ""}</span>
                  <span style={{ color: o.availableStock > 0 ? "#64748b" : "#ef4444", fontSize: "0.8rem" }}>
                    {formatINR(o.sellingPrice)} · stock {o.availableStock}
                  </span>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} required label="Medicine" placeholder="Search by name or generic…" />}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2 }}>
            <TextField select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} helperText="Drives the dose chart & quantity">
              {FREQUENCY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField
              type="number" label="Units / dose" value={form.unitsPerDose}
              onChange={(e) => setForm({ ...form, unitsPerDose: e.target.value })}
              disabled={!scheduled} inputProps={{ min: 0.5, step: 0.5 }}
              helperText={scheduled ? "e.g. 2 tablets each time" : "Not used for as-needed dosing"}
            />
            <TextField
              type="number" label="Duration (days)" value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              disabled={form.frequency === "STAT"} inputProps={{ min: 0, step: 1 }}
              helperText={form.frequency === "STAT" ? "Not used for STAT" : undefined}
            />
            <TextField
              type="number" label="Quantity" required
              value={scheduled ? (computedQty ?? "") : form.quantity}
              onChange={scheduled ? undefined : (e) => setForm({ ...form, quantity: e.target.value })}
              InputProps={{ readOnly: scheduled }}
              disabled={scheduled}
              inputProps={{ min: 1, step: 1 }}
              helperText={
                !scheduled ? "As-needed — enter the total manually"
                : form.frequency === "STAT" ? "STAT — a single dose"
                : `= ${TIMES_PER_DAY[form.frequency] ?? 1}/day × ${Number(form.durationDays) > 0 ? form.durationDays : 1} day(s) × ${form.unitsPerDose || 0}/dose`
              }
            />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 2 }}>
            <TextField label="Dosage" placeholder="e.g. 500mg" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            <TextField label="Route" placeholder="e.g. Oral / IV" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
          </Box>
          <TextField label="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} fullWidth />
          {form.medicine && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {formatINR(form.medicine.sellingPrice)} × {qty || 0} = <strong>{formatINR(lineTotal)}</strong> · sent to pharmacy for confirmation, stock is drawn once they dispense it
            </Typography>
          )}
        </Stack>
        </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
        {view === "assign" && (
          <Button variant="contained" onClick={submit} disabled={saving || !canAdd}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
            sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Assign Medicine</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
