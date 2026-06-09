import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, InputAdornment
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, MedicationRounded, SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function MedicineCatalog() {
  const theme = useTheme();
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);
  
  const [medicineCode, setMedicineCode] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/pharmacy/medicines");
      setMedicines(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch medicines", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditMed(null);
    setMedicineCode(`MED-${Math.floor(1000 + Math.random() * 9000)}`);
    setMedicineName("");
    setGenericName("");
    setManufacturer("");
    setSellingPrice("");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleOpenEdit = (med: any) => {
    setEditMed(med);
    setMedicineCode(med.medicineCode);
    setMedicineName(med.medicineName || "");
    setGenericName(med.genericName || "");
    setManufacturer(med.manufacturer || "");
    setSellingPrice(med.sellingPrice.toString());
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    if (!medicineCode || !medicineName || !genericName || !sellingPrice) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      const payload = {
        medicineCode,
        medicineName,
        genericName,
        manufacturer,
        sellingPrice: parseFloat(sellingPrice)
      };

      if (editMed) {
        await axiosInstance.put(`/pharmacy/medicines/${editMed.medicineId}`, payload);
      } else {
        await axiosInstance.post("/pharmacy/medicines", payload);
      }
      handleClose();
      fetchMedicines();
    } catch (err: any) {
      console.error("Failed to save medicine", err);
      setErrorMsg(err.response?.data?.message || "Failed to save the medicine.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this medicine?")) return;
    try {
      await axiosInstance.delete(`/pharmacy/medicines/${id}`);
      fetchMedicines();
    } catch (err: any) {
      console.error("Failed to delete medicine", err);
      alert(err.response?.data?.message || "Failed to delete the medicine.");
    }
  };

  const filteredMedicines = medicines.filter(med => 
    med.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    med.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.medicineCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ 
        display: "flex", 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: "space-between", 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 4,
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" sx={{ 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <MedicationRounded fontSize="large" sx={{ color: '#4F46E5' }} />
            Medicine Catalog
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage the hospital's drug formulary, generic compositions, and pricing.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={handleOpenNew}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1.2,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 20px -4px rgba(16, 185, 129, 0.5)',
            }
          }}
        >
          Add Medicine
        </Button>
      </Box>

      <Paper sx={{ 
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <TextField
            placeholder="Search by Brand, Generic, or Code..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            sx={{ maxWidth: 400, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchRounded color="action" /></InputAdornment>
            }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
            <CircularProgress size={48} thickness={4} sx={{ color: '#4F46E5' }} />
          </Box>
        ) : filteredMedicines.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <MedicationRounded sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">No medicines found</Typography>
            <Typography variant="body2" color="text.disabled">Get started by creating your first medicine entry.</Typography>
          </Box>
        ) : (
          <Fade in timeout={500}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Brand Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Generic / Salt</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Manufacturer</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Selling Price</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMedicines.map((med) => (
                  <TableRow 
                    key={med.medicineId} 
                    hover
                    sx={{ 
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                        transform: 'scale(1.001)'
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{med.medicineCode}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#4F46E5' }}>{med.medicineName}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{med.genericName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{med.manufacturer || 'N/A'}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#10B981' }}>${parseFloat(med.sellingPrice).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenEdit(med)}
                          sx={{ '&:hover': { bgcolor: alpha('#4F46E5', 0.1) } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(med.medicineId)}
                          sx={{ '&:hover': { bgcolor: alpha('#EF4444', 0.1) } }}
                        >
                          <DeleteRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Fade>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
          }
        }}
        TransitionComponent={Zoom}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight="700">
            {editMed ? "Edit Medicine" : "Add New Medicine"}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {errorMsg && (
              <Box sx={{ p: 1.5, bgcolor: alpha('#EF4444', 0.1), borderRadius: 2, border: '1px solid', borderColor: alpha('#EF4444', 0.2) }}>
                <Typography color="error" variant="body2" fontWeight="500">{errorMsg}</Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Medicine Code"
                value={medicineCode}
                onChange={(e) => setMedicineCode(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
              <TextField
                label="Selling Price ($)"
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
            </Box>

            <TextField
              label="Brand Name"
              placeholder="e.g., Tylenol, Crocin"
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              fullWidth
              variant="outlined"
              required
            />
            
            <TextField
              label="Generic Name / Composition"
              placeholder="e.g., Paracetamol 500mg"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              fullWidth
              variant="outlined"
              required
              helperText="The active pharmaceutical ingredient (Salt)"
            />

            <TextField
              label="Manufacturer"
              placeholder="e.g., Pfizer, GSK"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              fullWidth
              variant="outlined"
            />
            
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 600, borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={saving}
            sx={{ 
              fontWeight: 600, 
              borderRadius: '8px',
              px: 3,
              background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
