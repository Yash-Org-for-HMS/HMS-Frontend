import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip, Switch, FormControlLabel, Chip
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function LabTestCatalog() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editTest, setEditTest] = useState<any>(null);
  
  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [price, setPrice] = useState("");
  const [isProfile, setIsProfile] = useState(false);
  const [defaultNormalRange, setDefaultNormalRange] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/lab/tests");
      setTests(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch lab tests", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditTest(null);
    setTestCode("");
    setTestName("");
    setPrice("");
    setIsProfile(false);
    setDefaultNormalRange("");
    setUnit("");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleOpenEdit = (test: any) => {
    setEditTest(test);
    setTestCode(test.testCode);
    setTestName(test.testName || "");
    setPrice(test.price.toString());
    setIsProfile(test.isProfile || false);
    setDefaultNormalRange(test.defaultNormalRange || "");
    setUnit(test.unit || "");
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
      if (editTest) {
        await axiosInstance.put(`/lab/tests/${editTest.labTestId}`, {
          testCode,
          testName,
          price: parseFloat(price),
          isProfile,
          defaultNormalRange,
          unit
        });
      } else {
        await axiosInstance.post("/lab/tests", {
          testCode,
          testName,
          price: parseFloat(price),
          isProfile,
          defaultNormalRange,
          unit
        });
      }
      handleClose();
      fetchTests();
    } catch (err: any) {
      console.error("Failed to save lab test", err);
      setErrorMsg(err.response?.data?.message || "Failed to save the lab test.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this lab test?")) return;
    try {
      await axiosInstance.delete(`/lab/tests/${id}`);
      fetchTests();
    } catch (err: any) {
      console.error("Failed to delete lab test", err);
      alert(err.response?.data?.message || "Failed to delete the lab test.");
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Lab Test Catalog</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={handleOpenNew}
        >
          Add New Test
        </Button>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
        ) : tests.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No lab tests found. Create one!</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Test Code</TableCell>
                <TableCell>Test Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Normal Range</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test) => (
                <TableRow key={test.labTestId} hover>
                  <TableCell>
                    {test.isProfile ? <Chip label="Profile" color="secondary" size="small" /> : <Chip label="Parameter" size="small" />}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{test.testCode}</TableCell>
                  <TableCell>{test.testName}</TableCell>
                  <TableCell>${parseFloat(test.price).toFixed(2)}</TableCell>
                  <TableCell>{test.defaultNormalRange ? `${test.defaultNormalRange} ${test.unit || ""}` : "N/A"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenEdit(test)}>
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => handleDelete(test.labTestId)}>
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
        <DialogTitle>{editTest ? "Edit Lab Test" : "Add New Lab Test"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            {errorMsg && (
              <Typography color="error" variant="body2">{errorMsg}</Typography>
            )}
            <TextField
              label="Test Code (e.g., CBC)"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              fullWidth
            />
            <TextField
              label="Test Name"
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
            <FormControlLabel
              control={<Switch checked={isProfile} onChange={(e) => setIsProfile(e.target.checked)} />}
              label="Is this a Profile/Panel? (e.g. CBC)"
            />
            {!isProfile && (
              <>
                <TextField
                  label="Default Normal Range (e.g., 4.5 - 5.9)"
                  value={defaultNormalRange}
                  onChange={(e) => setDefaultNormalRange(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Unit (e.g., g/dL, /mcL)"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  fullWidth
                />
              </>
            )}
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
