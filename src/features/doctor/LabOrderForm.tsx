import { ACCENTS, BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, TextField, IconButton,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, MenuItem
} from "@mui/material";
import { DeleteRounded, SaveRounded, ScienceRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import LabTestPicker, { type PickedLabTest } from "@/components/lab/LabTestPicker";
import { formatINR } from "@/utils/format";

const DOCTOR_BLUE = BRAND.action;

interface LabOrderFormProps {
  consultationId?: string | null;
  patientId?: string;
  onRequireSave: () => Promise<string | undefined>;
}

const priorities = [
  { value: 1, label: "Routine" },
  { value: 2, label: "Urgent" },
  { value: 3, label: "STAT" }
];

export default function LabOrderForm({ consultationId, patientId, onRequireSave }: LabOrderFormProps) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  // Basket of picked SOC lab tests + the browse picker.
  const [items, setItems] = useState<PickedLabTest[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState(1);
  const selectedIds = new Set(items.map((i) => i.chargeItemId));

  const { data: existingOrders = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["lab-orders", consultationId],
    queryFn: async () => (await axiosInstance.get(`/doctor/lab-orders/consultations/${consultationId}`)).data.data || [],
    enabled: !!consultationId,
  });

  const toggleTest = (t: PickedLabTest) =>
    setItems((prev) => prev.some((i) => i.chargeItemId === t.chargeItemId) ? prev.filter((i) => i.chargeItemId !== t.chargeItemId) : [...prev, t]);
  const handleRemoveItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Please add at least one test to create an order.");
      return;
    }

    try {
      setSaving(true);
      let targetConsultationId = consultationId;

      if (!targetConsultationId) {
        targetConsultationId = await onRequireSave();
        if (!targetConsultationId) {
          throw new Error("Could not create consultation draft. Save failed.");
        }
      }

      await axiosInstance.post(`/doctor/lab-orders/consultations/${targetConsultationId}`, {
        patientId,
        priorityId: selectedPriority,
        chargeItemIds: items.map(i => i.chargeItemId)
      });

      toast.success("Lab order created successfully!");
      setItems([]);
      setSelectedPriority(1);
      // Refresh list (covers both the existing consultation and a freshly-created one)
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, (err instanceof Error && err.message) || "Failed to create lab order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
<Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Create New Lab Order</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button fullWidth variant="outlined" startIcon={<ScienceRounded />} onClick={() => setPickerOpen(true)} sx={{ textTransform: "none", justifyContent: "flex-start" }}>
            {items.length ? `${items.length} test${items.length === 1 ? "" : "s"} selected — add / change` : "Select lab tests"}
          </Button>
          <TextField
            select
            fullWidth
            size="small"
            label="Priority"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(Number(e.target.value))}
          >
            {priorities.map(p => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        {items.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "background.default" }}>
                <TableRow>
                  <TableCell>Test Name</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.chargeItemId}>
                    <TableCell>{item.testName}</TableCell>
                    <TableCell align="right">{formatINR(Number(item.price))}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button 
                variant="contained" 
                startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
                sx={{ bgcolor: DOCTOR_BLUE }}
                onClick={handleSubmit}
                disabled={saving}
              >
                Submit Lab Order
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Existing Orders */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <ScienceRounded sx={{ color: "text.secondary" }} fontSize="small" /> Previously Ordered Tests
        </Typography>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, "Failed to load lab orders")} onRetry={refetch} />
        ) : existingOrders.length === 0 ? (
          <Mascot pose="nothing-here-yet" subtitle="No lab orders for this consultation yet." size={130} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {existingOrders.map((order, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Order ID: {order.sampleBarcode}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                    Priority: {priorities.find(p => p.value === order.priorityId)?.label || "Unknown"}
                  </Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    {order.reports?.map((report: any, rIdx: number) => (
                      <TableRow key={rIdx}>
                        <TableCell sx={{ pl: 0 }}>
                          <Typography variant="body2">{report.testName} ({report.testCode})</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 0 }}>
                          <Typography variant="body2" sx={{ 
                            color: report.resultValue === "PENDING" ? "warning.main" : "success.main",
                            fontWeight: 600 
                          }}>
                            {report.resultValue}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      <LabTestPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onToggle={toggleTest}
        selectedIds={selectedIds}
        catalogUrl="/doctor/lab-orders/tests"
        accent={DOCTOR_BLUE}
      />
    </Box>
  );
}
