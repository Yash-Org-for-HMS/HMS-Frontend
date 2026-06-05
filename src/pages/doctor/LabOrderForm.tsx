import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, IconButton, Autocomplete, CircularProgress,
  Paper, Grid, Alert, Table, TableBody, TableCell, TableHead, TableRow, MenuItem
} from "@mui/material";
import { DeleteRounded, SaveRounded, AddRounded, ScienceRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

const DOCTOR_BLUE = "#3b82f6";

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [existingOrders, setExistingOrders] = useState<any[]>([]);

  // Search state
  const [testQuery, setTestQuery] = useState("");
  const [testOptions, setTestOptions] = useState<any[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  
  // Form state
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [selectedPriority, setSelectedPriority] = useState(1);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (consultationId) {
      fetchExistingOrders(consultationId);
    }
  }, [consultationId]);

  const fetchExistingOrders = async (id: string) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/doctor/lab-orders/consultations/${id}`);
      setExistingOrders(res.data.data || []);
    } catch (err) {
      console.error("Failed to load lab orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (testQuery.length >= 2) {
        try {
          setTestLoading(true);
          const res = await axiosInstance.get(`/doctor/lab-orders/tests?q=${testQuery}`);
          setTestOptions(res.data.data);
        } catch (err) {
          console.error("Failed to fetch lab tests", err);
        } finally {
          setTestLoading(false);
        }
      } else {
        setTestOptions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [testQuery]);

  const handleAddItem = () => {
    if (!selectedTest) {
      setError("Please select a lab test to add.");
      return;
    }
    
    // Check if already in the list
    if (items.some(item => item.labTestId === selectedTest.labTestId)) {
      setError("This test is already added.");
      return;
    }

    setItems([...items, selectedTest]);
    setSelectedTest(null);
    setTestQuery("");
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError("Please add at least one test to create an order.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

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
        testIds: items.map(i => i.labTestId)
      });

      setSuccess("Lab order created successfully!");
      setItems([]);
      setSelectedPriority(1);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh list
      fetchExistingOrders(targetConsultationId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create lab order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {success && <Alert severity="success">{success}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Create New Lab Order</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Autocomplete
            options={testOptions}
            getOptionLabel={(option) => `${option.testName} (${option.testCode})`}
            loading={testLoading}
            value={selectedTest}
            onInputChange={(e, newInputValue) => setTestQuery(newInputValue)}
            onChange={(e, newValue) => setSelectedTest(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Lab Test"
                placeholder="e.g. CBC, Lipid Profile"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {testLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
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
          <Button 
            fullWidth variant="contained" 
            startIcon={<AddRounded />}
            sx={{ bgcolor: DOCTOR_BLUE }} 
            onClick={handleAddItem}
          >
            Add Test
          </Button>
        </Box>
        
        {items.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "background.default" }}>
                <TableRow>
                  <TableCell>Test Name</TableCell>
                  <TableCell>Test Code</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.testName}</TableCell>
                    <TableCell>{item.testCode}</TableCell>
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
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
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
          <CircularProgress size={24} />
        ) : existingOrders.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>No lab orders for this consultation.</Typography>
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
    </Box>
  );
}
