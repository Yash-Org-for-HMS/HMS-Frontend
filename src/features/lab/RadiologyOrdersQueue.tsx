import { useState, useEffect, useRef, useMemo } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { orderStatusColor } from "@/utils/statusColors";
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Link, Alert, Tabs, Tab } from "@mui/material";
import { VisibilityRounded, CheckCircleRounded, InsertDriveFileRounded, EditRounded, CloudUploadRounded, AddRounded } from "@mui/icons-material";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import PointOfCarePOS from "@/components/billing/PointOfCarePOS";
import WalkInOrderDialog from "@/components/lab/WalkInOrderDialog";
import { useSocket } from "@/hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import { assetUrl } from "@/utils/assetUrl";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { useToast } from "@/providers/ToastContext";
import { QUEUE_POLL_MS } from "@/constants/intervals";

export default function RadiologyOrdersQueue() {
  const toast = useToast();
  const { data: orders = [], isLoading: loading, refetch: fetchOrders } = useQuery({
    queryKey: ["radiology-orders-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get(`/lab/radiology-orders?t=${Date.now()}`);
      return res.data.data || [];
    },
    refetchInterval: QUEUE_POLL_MS,
  });

  const [macros, setMacros] = useState<any[]>([]);
  const [selectedMacro, setSelectedMacro] = useState("");
  
  const [editOrder, setEditOrder] = useState<any>(null);
  const [status, setStatus] = useState("PENDING");
  const [notes, setNotes] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real payable amount for this scan (server-priced), so the POS shows the
  // correct figure instead of a hardcoded placeholder. /billing/unbilled is the
  // only lab-authorised price source.
  const { data: unbilledItems = [] } = useQuery({
    queryKey: ["unbilled", editOrder?.patientId],
    enabled: !!editOrder?.patientId,
    queryFn: async () => (await axiosInstance.get(`/billing/unbilled/${editOrder!.patientId}`)).data.data || [],
  });
  const posItem = unbilledItems.find((it: any) => it.id === editOrder?.radiologyOrderId);

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: () => fetchOrders(),
    connect: () => fetchOrders(), // Refetch on socket reconnect
  });

  useEffect(() => {
    fetchMacros();
  }, []);

  const fetchMacros = async () => {
    try {
      const res = await axiosInstance.get("/lab/radiology-macros");
      setMacros(res.data.data || []);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to load report macros"));
    }
  };



  const handleEditClick = (order: any) => {
    setEditOrder(order);
    setStatus(order.status || "PENDING");
    setNotes(order.radiologistNotes || "");
    setReportUrl(order.reportUrl || "");
  };

  const handleClose = () => {
    setEditOrder(null);
    setSelectedMacro("");
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await axiosInstance.post(`/lab/radiology-orders/${editOrder.radiologyOrderId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setReportUrl(res.data.data.reportUrl);
      setStatus("COMPLETED");
    } catch (err: unknown) {
      console.error("Failed to upload report", err);
      alert(getApiErrorMessage(err, "Failed to upload the file."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: any) => e.preventDefault();
  const handleDrop = (e: any) => {
    e.preventDefault();
    handleFileUpload(e);
  };

  const handleSave = async () => {
    if (!editOrder) return;
    try {
      setSaving(true);
      await axiosInstance.put(`/lab/radiology-orders/${editOrder.radiologyOrderId}/results`, {
        status,
        radiologistNotes: notes,
        reportUrl,
      });
      handleClose();
      fetchOrders();
    } catch (err) {
      console.error("Failed to update radiology order", err);
    } finally {
      setSaving(false);
    }
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Memoized so useTableSort's own memo (keyed on this array's identity) isn't
  // defeated by a fresh array on every render — without this, sorting silently
  // re-ran on every unrelated re-render regardless of whether orders/tabValue changed.
  const filteredOrders = useMemo(() => orders.filter((order: any) => {
    const today = isToday(order.orderDate);
    const completed = order.status === "COMPLETED";

    if (tabValue === 0) return today && !completed; // Today's Pending
    if (tabValue === 1) return !today && !completed; // Past Pending
    if (tabValue === 2) return completed; // Completed
    return true; // All
  }), [orders, tabValue]);

  const { sorted, orderBy, order, onSort } = useTableSort(filteredOrders, {
    scanType: (o: any) => o.scanType,
    patient: (o: any) => `${o.patient?.firstName ?? ""} ${o.patient?.lastName ?? ""}`.trim(),
    doctor: (o: any) => `${o.doctor?.user?.firstName ?? ""} ${o.doctor?.user?.lastName ?? ""}`.trim(),
    date: (o: any) => (o.orderDate ? new Date(o.orderDate) : null),
    status: (o: any) => o.status ?? "PENDING",
  });

  return (
    <Box>
      <PageHeader
        title="Radiology Orders"
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setWalkInOpen(true)}>
            New Walk-in Order
          </Button>
        }
      />

      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} variant="scrollable" scrollButtons="auto">
          <Tab label="Today's Queue" />
          <Tab label="Past Pending" />
          <Tab label="Completed" />
          <Tab label="All Orders" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <Mascot pose="all-caught-up" title="No radiology orders" subtitle="No radiology orders found." />
        ) : (
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Scan Type" sortKey="scanType" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Doctor" sortKey="doctor" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Date" sortKey="date" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 3, border: 0 }}>
                    <Mascot pose="no-matches" subtitle="No orders match the selected filter." size={110} />
                  </TableCell>
                </TableRow>
              ) : sorted.map((order: any) => (
                <TableRow key={order.radiologyOrderId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{order.scanType}</TableCell>
                  <TableCell>
                    {order.patient?.firstName} {order.patient?.lastName}
                    {order.admissionNumber && (
                      <Chip label={`IPD · ${order.admissionNumber}`} size="small" sx={{ ml: 1, height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2" }} />
                    )}
                  </TableCell>
                  <TableCell>{order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip label={order.status || "PENDING"} color={orderStatusColor(order.status) as any} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<EditRounded />}
                      onClick={() => handleEditClick(order)}
                    >
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={!!editOrder} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Update Radiology Order</DialogTitle>
        <DialogContent dividers>
          {editOrder?.billingLockActive && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Billing Lock Active: The invoice for this scan has not been paid. Processing is disabled.
            </Alert>
          )}
          {editOrder?.admissionNumber && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Inpatient scan ({editOrder.admissionNumber}) — covered on the IP bill, settled at discharge. No pre-payment needed.
            </Alert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Scan Type: {editOrder?.scanType}</Typography>
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
              disabled={editOrder?.billingLockActive}
              helperText={editOrder?.status === "COMPLETED" ? "A completed report can't be moved back to pending — edit the report in place." : " "}
            >
              {/* A completed report can't be un-completed (it's delivered/billed);
                  the lower options are locked to match the backend guard. */}
              <MenuItem value="PENDING" disabled={editOrder?.status === "COMPLETED"}>Pending</MenuItem>
              <MenuItem value="IN_PROGRESS" disabled={editOrder?.status === "COMPLETED"}>In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
            </TextField>
            
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>Upload Report (PDF/Image)</Typography>
              <Box 
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  if (!editOrder?.billingLockActive) handleDrop(e);
                }}
                onClick={() => {
                  if (!editOrder?.billingLockActive) fileInputRef.current?.click();
                }}
                sx={{
                  border: "2px dashed",
                  borderColor: reportUrl ? "success.main" : "divider",
                  borderRadius: 2,
                  p: 3,
                  textAlign: "center",
                  cursor: !editOrder?.billingLockActive ? "pointer" : "not-allowed",
                  bgcolor: reportUrl ? "success.50" : "action.hover",
                  opacity: !editOrder?.billingLockActive ? 1 : 0.6,
                  transition: "all 0.2s",
                  "&:hover": { borderColor: "primary.main", bgcolor: "primary.50" }
                }}
              >
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept="application/pdf,image/jpeg,image/png"
                />
                {uploading ? (
                  <HeartbeatLoader size={22} />
                ) : reportUrl ? (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <CheckCircleRounded color="success" fontSize="large" />
                    <Typography variant="body2" color="success.main" fontWeight="600">File Uploaded Successfully</Typography>
                    <Link href={assetUrl(reportUrl)} target="_blank" underline="hover">View Uploaded File</Link>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <CloudUploadRounded color="action" fontSize="large" />
                    <Typography variant="body2" color="text.secondary">
                      Drag & drop a file here, or click to browse
                    </Typography>
                    <Typography variant="caption" color="text.disabled">Max size: 10MB (PDF, JPG, PNG)</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <TextField
                select
                label="Insert Template / Macro"
                value={selectedMacro}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMacro(val);
                  const macro = macros.find(m => m.macroId === val);
                  if (macro) {
                    setNotes(prev => prev ? `${prev}\n\n${macro.content}` : macro.content);
                  }
                }}
                fullWidth
                disabled={editOrder?.billingLockActive}
                sx={{ mb: 2 }}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {macros.map(m => (
                  <MenuItem key={m.macroId} value={m.macroId}>{m.title}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Radiologist Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={4}
              disabled={editOrder?.billingLockActive}
            />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {editOrder?.billingLockActive && (
            <Button color="success" variant="outlined" onClick={() => setShowPOS(true)}>Collect Payment</Button>
          )}
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || editOrder?.billingLockActive}>
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {showPOS && editOrder && (
        <PointOfCarePOS
          open={showPOS}
          onClose={() => setShowPOS(false)}
          onSuccess={() => {
            setShowPOS(false);
            fetchOrders();
            setEditOrder({...editOrder, paymentStatus: 'PAID', billingLockActive: false});
          }}
          patientId={editOrder.patientId}
          patientName={`${editOrder.patient?.firstName || ''} ${editOrder.patient?.lastName || ''}`}
          item={{
            id: editOrder.radiologyOrderId,
            type: "RADIOLOGY",
            description: posItem?.description || `Radiology Scan: ${editOrder.scanType}`,
            amount: Number(posItem?.amount ?? 0),
            date: editOrder.orderDate
          }}
        />
      )}

      <WalkInOrderDialog kind="radiology" open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreated={() => fetchOrders()} />
    </Box>
  );
}
