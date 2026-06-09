import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, IconButton, Autocomplete, CircularProgress,
  Paper, Grid, Alert, Divider, Table, TableBody, TableCell, TableHead, TableRow, Tooltip
} from "@mui/material";
import { DeleteRounded, SaveRounded, AddRounded, PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

const DOCTOR_BLUE = "#3b82f6";

interface PrescriptionWriterProps {
  consultationId?: string | null;
  patientId?: string;
  onRequireSave: () => Promise<string | undefined>;
}

export default function PrescriptionWriter({ consultationId, patientId, onRequireSave }: PrescriptionWriterProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [specialInstructions, setSpecialInstructions] = useState("");
  const [items, setItems] = useState<any[]>([]);

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

  useEffect(() => {
    if (consultationId) {
      fetchPrescription(consultationId);
    }
  }, [consultationId]);

  const fetchPrescription = async (id: string) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/doctor/prescription/consultations/${id}`);
      const data = res.data.data;
      if (data) {
        setSpecialInstructions(data.specialInstructions || "");
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load prescription", err);
    } finally {
      setLoading(false);
    }
  };

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
      setError("Please fill medicine, dosage, and frequency.");
      return;
    }

    if (!durationDays && !quantity) {
      setError("Please provide either duration (Days) or Quantity.");
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
      unit
    };

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
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

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

      setSuccess("Prescription saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to save prescription");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {success && <Alert severity="success">{success}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Add Medicine</Typography>
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
                      {medicineLoading ? <CircularProgress color="inherit" size={20} /> : null}
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
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{item.medicineName || "Custom"}</Typography>
                    {item.genericName && <Typography variant="caption" color="text.secondary">{item.genericName}</Typography>}
                  </TableCell>
                  <TableCell>{item.dosage}</TableCell>
                  <TableCell>{item.frequency}</TableCell>
                  <TableCell>{item.durationDays}</TableCell>
                  <TableCell>{item.quantity} {item.unit}</TableCell>
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
          Print Preview
        </Button>
        <Button 
          variant="contained" 
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
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
