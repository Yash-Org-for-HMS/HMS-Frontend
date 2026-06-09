import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, SettingsAccessibilityRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function RadiologyCatalog() {
  const theme = useTheme();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editScan, setEditScan] = useState<any>(null);
  
  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/lab/radiology-catalog");
      setScans(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch radiology scans", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditScan(null);
    setTestCode("");
    setTestName("");
    setPrice("");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleOpenEdit = (scan: any) => {
    setEditScan(scan);
    setTestCode(scan.testCode);
    setTestName(scan.testName || "");
    setPrice(scan.price.toString());
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    if (!testCode || !testName || !price) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      if (editScan) {
        await axiosInstance.put(`/lab/radiology-catalog/${editScan.radiologyTestId}`, {
          testCode,
          testName,
          price: parseFloat(price)
        });
      } else {
        await axiosInstance.post("/lab/radiology-catalog", {
          testCode,
          testName,
          price: parseFloat(price)
        });
      }
      handleClose();
      fetchScans();
    } catch (err: any) {
      console.error("Failed to save radiology scan", err);
      setErrorMsg(err.response?.data?.message || "Failed to save the radiology scan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this radiology scan?")) return;
    try {
      await axiosInstance.delete(`/lab/radiology-catalog/${id}`);
      fetchScans();
    } catch (err: any) {
      console.error("Failed to delete radiology scan", err);
      alert(err.response?.data?.message || "Failed to delete the radiology scan.");
    }
  };

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
            background: 'linear-gradient(135deg, #0284C7 0%, #4F46E5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <SettingsAccessibilityRounded fontSize="large" sx={{ color: '#0284C7' }} />
            Radiology Catalog
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage available radiology scans, imaging services, and pricing.
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
          Add New Scan
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
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
            <CircularProgress size={48} thickness={4} sx={{ color: '#0284C7' }} />
          </Box>
        ) : scans.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <SettingsAccessibilityRounded sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">No radiology scans found</Typography>
            <Typography variant="body2" color="text.disabled">Get started by creating your first scan.</Typography>
          </Box>
        ) : (
          <Fade in timeout={500}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Scan Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Scan Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Price</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow 
                    key={scan.radiologyTestId} 
                    hover
                    sx={{ 
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                        transform: 'scale(1.001)'
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#0284C7' }}>{scan.testCode}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{scan.testName}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#10B981' }}>${parseFloat(scan.price).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenEdit(scan)}
                          sx={{ '&:hover': { bgcolor: alpha('#0284C7', 0.1) } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(scan.radiologyTestId)}
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
            {editScan ? "Edit Radiology Scan" : "Add New Radiology Scan"}
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
                label="Scan Code"
                placeholder="e.g., MRI-BRN"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                fullWidth
                variant="outlined"
              />
              <TextField
                label="Price ($)"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                fullWidth
                variant="outlined"
              />
            </Box>
            <TextField
              label="Scan Name"
              placeholder="e.g., MRI Brain"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
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
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
