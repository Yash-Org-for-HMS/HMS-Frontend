import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Typography, Box, IconButton, Chip, Tabs, Tab, MenuItem, Collapse, Link,
} from "@mui/material";
import {
  MonitorHeartRounded, AddRounded, DeleteOutlineRounded, HourglassTopRounded,
  CheckCircleRounded, PendingActionsRounded, ExpandMoreRounded, ExpandLessRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientName }
}

// Same fixed scan list the walk-in radiology counter uses.
const SCAN_TYPES = ["X-Ray", "CT Scan", "MRI Scan", "Ultrasound", "PET Scan", "Mammography"];
const PRIORITIES = [
  { value: 1, label: "Routine" },
  { value: 2, label: "Urgent" },
  { value: 3, label: "STAT" },
];
const STATUS_CHIP: Record<string, any> = {
  PENDING: { label: "Pending", icon: <HourglassTopRounded sx={{ fontSize: 14 }} />, bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  IN_PROGRESS: { label: "In progress", icon: <PendingActionsRounded sx={{ fontSize: 14 }} />, bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  COMPLETED: { label: "Completed", icon: <CheckCircleRounded sx={{ fontSize: 14 }} />, bg: "rgba(16,185,129,0.12)", color: "#059669" },
};

export default function IpdRadiologyOrdersDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"order" | "results">("order");
  const [scanType, setScanType] = useState("");
  const [notes, setNotes] = useState("");
  const [basket, setBasket] = useState<{ scanType: string; notes: string }[]>([]);
  const [priorityId, setPriorityId] = useState(1);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: orders = [], isFetching, refetch } = useQuery<any[]>({
    queryKey: ["ipd-admission-radiology", admission?.admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/radiology-orders`)).data.data,
    enabled: open && !!admission?.admissionId,
  });

  const addToBasket = () => {
    if (!scanType) return;
    setBasket([...basket, { scanType, notes: notes.trim() }]);
    setScanType("");
    setNotes("");
  };
  const removeFromBasket = (idx: number) => setBasket(basket.filter((_, i) => i !== idx));

  // A scan chosen in the picker but not yet "added" still counts — so ordering a
  // single scan needs no extra Add click. Add stays useful for stacking several.
  const effectiveScans = scanType ? [...basket, { scanType, notes: notes.trim() }] : basket;

  const afterChange = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["ipd-admission", admission?.admissionId] });
  };

  const submit = async () => {
    if (!effectiveScans.length) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/radiology-orders`, { priorityId, scans: effectiveScans });
      toast.success(`${effectiveScans.length} scan${effectiveScans.length === 1 ? "" : "s"} sent to radiology`);
      setBasket([]);
      setScanType("");
      setNotes("");
      afterChange();
      setTab("results");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to order scans");
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async (o: any) => {
    const ok = await confirm({
      title: "Cancel scan",
      message: `Cancel the ${o.scanType} order? This is only possible before the radiologist starts.`,
      confirmText: "Cancel scan",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(o.radiologyOrderId);
    try {
      await axiosInstance.delete(`/ipd/admissions/${admission.admissionId}/radiology-orders/${o.radiologyOrderId}`);
      toast.success("Scan cancelled");
      afterChange();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <MonitorHeartRounded sx={{ color: "#0891b2" }} /> Radiology / Imaging
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider", "& .Mui-selected": { color: "#0891b2 !important" }, "& .MuiTabs-indicator": { bgcolor: "#0891b2" } }}>
        <Tab value="order" label="Order Scans" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab value="results" label={`Scans & Reports${orders.length ? ` (${orders.length})` : ""}`} sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName} — ordering a scan sends it to the radiology queue; once reported, the charge rolls onto the discharge bill.
        </Typography>

        {tab === "order" ? (
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr auto" }, gap: 2, alignItems: "start" }}>
              <TextField select label="Scan type" value={scanType} onChange={(e) => setScanType(e.target.value)}>
                {SCAN_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
              <TextField label="Clinical note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. R/O chest infection" />
              <Button onClick={addToBasket} disabled={!scanType} startIcon={<AddRounded />} sx={{ textTransform: "none", mt: 0.5, color: "#0891b2" }}>Add</Button>
            </Box>

            {basket.length > 0 && (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                <Stack spacing={1}>
                  {basket.map((s, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.scanType}</Typography>
                        {s.notes && <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.notes}</Typography>}
                      </Box>
                      <IconButton size="small" onClick={() => removeFromBasket(i)} sx={{ color: "#ef4444" }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            <TextField select label="Priority" value={priorityId} onChange={(e) => setPriorityId(Number(e.target.value))} sx={{ maxWidth: 220 }}>
              {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
          </Stack>
        ) : orders.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>No scans ordered yet for this admission.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {orders.map((o) => {
              const sc = STATUS_CHIP[o.status] || STATUS_CHIP.PENDING;
              const isOpen = expanded === o.radiologyOrderId;
              const report = o.reports?.[0];
              const hasReport = !!(o.radiologistNotes || o.reportUrl || report?.findings || report?.impression);
              return (
                <Box key={o.radiologyOrderId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.scanType}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {o.orderDate ? dayjs(o.orderDate).format("DD MMM YYYY, h:mm A") : "—"}
                      </Typography>
                    </Box>
                    <Chip icon={sc.icon} label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700 }} />
                    {o.status === "PENDING" && (
                      <IconButton size="small" disabled={busyId === o.radiologyOrderId} onClick={() => cancelOrder(o)} sx={{ color: "#ef4444" }} title="Cancel scan">
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setExpanded(isOpen ? null : o.radiologyOrderId)}>
                      {isOpen ? <ExpandLessRounded /> : <ExpandMoreRounded />}
                    </IconButton>
                  </Box>
                  <Collapse in={isOpen}>
                    <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: 1.5 }}>
                      {hasReport ? (
                        <Stack spacing={0.75}>
                          {(report?.findings || o.radiologistNotes) && (
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>Findings</Typography>
                              <Typography variant="body2">{report?.findings || o.radiologistNotes}</Typography>
                            </Box>
                          )}
                          {report?.impression && (
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>Impression</Typography>
                              <Typography variant="body2">{report.impression}</Typography>
                            </Box>
                          )}
                          {(o.reportUrl || report?.reportUrl) && (
                            <Link href={o.reportUrl || report?.reportUrl} target="_blank" rel="noopener" sx={{ fontSize: "0.85rem", color: "#0891b2" }}>View report file</Link>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Report not available yet.</Typography>
                      )}
                    </Box>
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
          <Button variant="contained" onClick={submit} disabled={saving || effectiveScans.length === 0}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
            sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>
            Order {effectiveScans.length || ""} scan{effectiveScans.length === 1 ? "" : "s"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
