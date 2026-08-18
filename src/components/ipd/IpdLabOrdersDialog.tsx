import { useState } from "react";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Typography, Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Chip, Tabs, Tab, MenuItem, Collapse,
} from "@mui/material";
import {
  ScienceRounded, AddRounded, DeleteOutlineRounded, HourglassTopRounded,
  CheckCircleRounded, BiotechRounded, ExpandMoreRounded, ExpandLessRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import SoftChip from "../SoftChip";
import LabTestPicker, { type PickedLabTest } from "@/components/lab/LabTestPicker";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientId, patientName }
}

const PRIORITIES = [
  { value: 1, label: "Routine" },
  { value: 2, label: "Urgent" },
  { value: 3, label: "STAT" },
];

// Computed order status from the backend (buildStatus): PENDING -> SAMPLE_COLLECTED -> COMPLETED.
const STATUS_CHIP: Record<string, any> = {
  PENDING: { label: "Pending", icon: <HourglassTopRounded sx={{ fontSize: 14 }} />, bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  SAMPLE_COLLECTED: { label: "Sample collected", icon: <BiotechRounded sx={{ fontSize: 14 }} />, bg: "rgba(59,130,246,0.12)", color: SEMANTIC.infoDark },
  COMPLETED: { label: "Completed", icon: <CheckCircleRounded sx={{ fontSize: 14 }} />, bg: "rgba(16,185,129,0.12)", color: SEMANTIC.successDark },
};

export default function IpdLabOrdersDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"order" | "results">("order");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [basket, setBasket] = useState<PickedLabTest[]>([]);
  const [priorityId, setPriorityId] = useState(1);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: orders = [], isFetching, refetch } = useQuery<any[]>({
    queryKey: ["ipd-admission-labs", admission?.admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/lab-orders`)).data.data,
    enabled: open && !!admission?.admissionId,
  });

  const selectedIds = new Set(basket.map((b) => b.chargeItemId));
  const toggleTest = (t: PickedLabTest) =>
    setBasket((prev) => prev.some((b) => b.chargeItemId === t.chargeItemId) ? prev.filter((b) => b.chargeItemId !== t.chargeItemId) : [...prev, t]);
  const basketTotal = basket.reduce((s, b) => s + Number(b.price || 0), 0);

  const afterChange = () => {
    refetch();
    // Keep the discharge preview / bill total honest.
    qc.invalidateQueries({ queryKey: ["ipd-admission", admission?.admissionId] });
  };

  const submit = async () => {
    if (!basket.length) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/lab-orders`, {
        priorityId,
        chargeItemIds: basket.map((b) => b.chargeItemId),
      });
      toast.success("Lab order sent to the lab");
      setBasket([]);
      afterChange();
      setTab("results");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to order labs"));
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async (o: any) => {
    const ok = await confirm({
      title: "Cancel lab order",
      message: "Cancel this lab order? This is only possible before the lab collects the sample.",
      confirmText: "Cancel order",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(o.labOrderId);
    try {
      await axiosInstance.delete(`/ipd/admissions/${admission.admissionId}/lab-orders/${o.labOrderId}`);
      toast.success("Lab order cancelled");
      afterChange();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to cancel"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ScienceRounded sx={{ color: BRAND.action }} /> Labs & Investigations
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider", "& .Mui-selected": { color: "#7c3aed !important" }, "& .MuiTabs-indicator": { bgcolor: BRAND.action } }}>
        <Tab value="order" label="Order Investigations" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab value="results" label={`Orders & Results${orders.length ? ` (${orders.length})` : ""}`} sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName} — ordering labs sends the request to the lab queue; once the sample is collected and results entered, the charge rolls onto the discharge bill.
        </Typography>

        {tab === "order" ? (
          <Stack spacing={2}>
            <Box>
              <Button variant="outlined" startIcon={<ScienceRounded />} onClick={() => setPickerOpen(true)} sx={{ textTransform: "none" }}>
                {basket.length ? `${basket.length} test${basket.length === 1 ? "" : "s"} selected — add / change` : "Select lab tests"}
              </Button>
            </Box>

            {basket.length > 0 && (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {basket.map((b) => (
                    <Chip key={b.chargeItemId} label={`${b.testName} · ${formatINR(Number(b.price))}`} onDelete={() => toggleTest(b)} sx={{ fontWeight: 600 }} />
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                  {basket.length} test{basket.length === 1 ? "" : "s"} · estimated <strong>{formatINR(basketTotal)}</strong>
                </Typography>
              </Box>
            )}

            <TextField select label="Priority" value={priorityId} onChange={(e) => setPriorityId(Number(e.target.value))} sx={{ maxWidth: 220 }}>
              {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
          </Stack>
        ) : orders.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>No lab orders yet for this admission.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {orders.map((o) => {
              const sc = STATUS_CHIP[o.status] || STATUS_CHIP.PENDING;
              const isOpen = expanded === o.labOrderId;
              return (
                <Box key={o.labOrderId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {o.reports?.length || 0} parameter{(o.reports?.length || 0) === 1 ? "" : "s"} · <span style={{ fontFamily: "monospace" }}>{o.sampleBarcode}</span>
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {o.createdAt ? dayjs(o.createdAt).format("DD MMM YYYY, h:mm A") : "—"}
                      </Typography>
                    </Box>
                    <SoftChip {...sc} />
                    {o.status === "PENDING" && (
                      <IconButton size="small" disabled={busyId === o.labOrderId} onClick={() => cancelOrder(o)} sx={{ color: SEMANTIC.danger }} title="Cancel order">
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setExpanded(isOpen ? null : o.labOrderId)}>
                      {isOpen ? <ExpandLessRounded /> : <ExpandMoreRounded />}
                    </IconButton>
                  </Box>
                  <Collapse in={isOpen}>
                    <TableContainer sx={{ borderTop: "1px solid", borderColor: "divider" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Parameter</TableCell>
                            <TableCell>Result</TableCell>
                            <TableCell>Normal range</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(o.reports || []).map((r: any) => {
                            const pending = !r.resultValue || r.resultValue === "PENDING";
                            return (
                              <TableRow key={r.labReportId}>
                                <TableCell>{r.testName || r.testCode || "—"}</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: r.isCritical ? SEMANTIC.danger : pending ? "text.disabled" : "text.primary" }}>
                                  {pending ? "Pending" : r.resultValue}{r.isCritical ? " ⚠" : ""}
                                </TableCell>
                                <TableCell sx={{ color: "text.secondary" }}>{r.normalRange || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
        {tab === "order" && (
          <Button variant="contained" onClick={submit} disabled={saving || basket.length === 0}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
>
            Order {basket.length || ""} test{basket.length === 1 ? "" : "s"}
          </Button>
        )}
      </DialogActions>
      <LabTestPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onToggle={toggleTest}
        selectedIds={selectedIds}
        catalogUrl="/ipd/lab-tests"
        accent={BRAND.action}
      />
    </Dialog>
  );
}
