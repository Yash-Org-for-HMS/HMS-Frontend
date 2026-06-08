import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function RadiologyCatalog() {
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
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Radiology Service Catalog</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={handleOpenNew}
        >
          Add New Scan
        </Button>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
        ) : scans.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No radiology scans found. Create one!</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Scan Code</TableCell>
                <TableCell>Scan Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scans.map((scan) => (
                <TableRow key={scan.radiologyTestId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{scan.testCode}</TableCell>
                  <TableCell>{scan.testName}</TableCell>
                  <TableCell>${parseFloat(scan.price).toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenEdit(scan)}>
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => handleDelete(scan.radiologyTestId)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editScan ? "Edit Radiology Scan" : "Add New Radiology Scan"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            {errorMsg && (
              <Typography color="error" variant="body2">{errorMsg}</Typography>
            )}
            <TextField
              label="Scan Code (e.g., MRI-BRN)"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              fullWidth
            />
            <TextField
              label="Scan Name (e.g., MRI Brain)"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Price ($)"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={24} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
