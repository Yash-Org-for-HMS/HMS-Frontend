import { useState } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, Switch, FormControlLabel, Chip, useTheme,
  Fade, Zoom, alpha
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded } from "@mui/icons-material";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import { ListSkeleton } from "../../components/TableRowsSkeleton";
import { useTableSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";
import { useConfirm } from "../../contexts/ConfirmContext";

export default function LabTestCatalog() {
  const theme = useTheme();
  const confirm = useConfirm();

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

  const { data: tests = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["lab-tests"],
    queryFn: async () => (await axiosInstance.get("/lab/tests")).data.data || [],
  });

  const { sorted, orderBy, order, onSort } = useTableSort(tests, {
    type: (t) => (t.isProfile ? "Profile" : "Parameter"),
    testCode: (t) => t.testCode,
    testName: (t) => t.testName,
    price: (t) => Number(t.price),
    normalRange: (t) => t.defaultNormalRange ?? null,
  });

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
      refetch();
    } catch (err: any) {
      console.error("Failed to save lab test", err);
      setErrorMsg(err.response?.data?.message || "Failed to save the lab test.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete lab test",
      message: "Are you sure you want to delete this lab test? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/lab/tests/${id}`);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete the lab test.");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <PageHeader
        title="Lab Test Catalog"
        subtitle="Manage available lab tests, profiles, and their reference ranges."
        actions={
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
        }
      />

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
          <ListSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
        ) : tests.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="No lab tests found" subtitle="Get started by creating your first lab test." />
        ) : (
          <Fade in timeout={500}>
            <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <SortableHeadCell label="Type" sortKey="type" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Test Code" sortKey="testCode" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Test Name" sortKey="testName" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Price" sortKey="price" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Normal Range" sortKey="normalRange" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((test, index) => (
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
            </TableContainer>
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
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
