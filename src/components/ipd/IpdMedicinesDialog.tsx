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
  MedicationRounded, AddRounded, DeleteOutlineRounded, ReceiptLongRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import MarChart from "./MarChart";

// Standard frequency codes drive the MAR dose schedule (see backend
// buildDoseSchedule). SOS/PRN and blank generate no scheduled doses.
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

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientId, patientName }
}

const emptyForm = { medicine: null as any, quantity: "1", dosage: "", frequency: "", durationDays: "", route: "", notes: "" };

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

  const qty = Number(form.quantity);
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
      title: "Remove medicine",
      message: `Remove ${m.medicineName || "this medicine"}? The issued stock will be returned.`,
      confirmText: "Remove",
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
          {admission?.patientName} — medicines assigned during this stay are added to the discharge bill.
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
                    <TableCell align="right">
                      {m.status === "BILLED" ? (
                        <Chip icon={<ReceiptLongRounded sx={{ fontSize: 14 }} />} label="Billed" size="small" sx={{ bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2", fontWeight: 700 }} />
                      ) : (
                        <Tooltip title="Remove (returns stock)">
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
                  <TableCell colSpan={2} sx={{ borderBottom: 0 }} />
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
            <TextField type="number" label="Quantity" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} inputProps={{ min: 1, step: 1 }} />
            <TextField label="Dosage" placeholder="e.g. 500mg" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            <TextField select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} helperText="Builds the dose chart">
              {FREQUENCY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField type="number" label="Duration (days)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} inputProps={{ min: 0, step: 1 }} />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 2 }}>
            <TextField label="Route" placeholder="e.g. Oral / IV" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
            <TextField label="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Box>
          {form.medicine && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {formatINR(form.medicine.sellingPrice)} × {qty || 0} = <strong>{formatINR(lineTotal)}</strong> · deducted from stock on assign
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
