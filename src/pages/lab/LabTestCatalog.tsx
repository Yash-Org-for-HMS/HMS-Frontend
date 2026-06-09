import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip, Switch, FormControlLabel, Chip, useTheme,
  Fade, Zoom, alpha
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, ScienceRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function LabTestCatalog() {
  const theme = useTheme();
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
            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <ScienceRounded fontSize="large" sx={{ color: '#2563EB' }} />
            Lab Test Catalog
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage available lab tests, profiles, and their reference ranges.
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
          Add New Test
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
            <CircularProgress size={48} thickness={4} sx={{ color: '#2563EB' }} />
          </Box>
        ) : tests.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <ScienceRounded sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">No lab tests found</Typography>
            <Typography variant="body2" color="text.disabled">Get started by creating your first lab test.</Typography>
          </Box>
        ) : (
          <Fade in timeout={500}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Test Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Test Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 2 }}>Normal Range</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tests.map((test, index) => (
                  <TableRow 
                    key={test.labTestId} 
                    hover
                    sx={{ 
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                        transform: 'scale(1.001)'
                      }
                    }}
                  >
                    <TableCell>
                      {test.isProfile ? (
                        <Chip label="Profile" size="small" sx={{ bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED', fontWeight: 600, borderRadius: '6px' }} />
                      ) : (
                        <Chip label="Parameter" size="small" sx={{ bgcolor: alpha('#2563EB', 0.1), color: '#2563EB', fontWeight: 600, borderRadius: '6px' }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{test.testCode}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{test.testName}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#10B981' }}>${parseFloat(test.price).toFixed(2)}</TableCell>
                    <TableCell>
                      {test.defaultNormalRange ? (
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                          {test.defaultNormalRange} <Box component="span" sx={{ opacity: 0.7, fontSize: '0.8em' }}>{test.unit || ""}</Box>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled" fontStyle="italic">N/A</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenEdit(test)}
                          sx={{ '&:hover': { bgcolor: alpha('#2563EB', 0.1) } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          color="error" 
                          onClick={() => handleDelete(test.labTestId)}
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
            {editTest ? "Edit Lab Test" : "Add New Lab Test"}
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
                label="Test Code"
                placeholder="e.g., CBC"
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
              label="Test Name"
              placeholder="e.g., Complete Blood Count"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              fullWidth
              variant="outlined"
            />
            
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <FormControlLabel
                control={<Switch checked={isProfile} onChange={(e) => setIsProfile(e.target.checked)} color="primary" />}
                label={<Typography fontWeight="500">Is this a Profile/Panel? (e.g. CBC contains multiple parameters)</Typography>}
              />
            </Box>

            {!isProfile && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Default Normal Range"
                  placeholder="e.g., 4.5 - 5.9"
                  value={defaultNormalRange}
                  onChange={(e) => setDefaultNormalRange(e.target.value)}
                  fullWidth
                  variant="outlined"
                />
                <TextField
                  label="Unit"
                  placeholder="e.g., g/dL, /mcL"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  fullWidth
                  variant="outlined"
                />
              </Box>
            )}
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
