import { useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha
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

export default function RadiologyCatalog() {
  const theme = useTheme();
  const confirm = useConfirm();

  const [openDialog, setOpenDialog] = useState(false);
  const [editScan, setEditScan] = useState<any>(null);
  
  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");

  const { data: scans = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["radiology-catalog"],
    queryFn: async () => (await axiosInstance.get("/lab/radiology-catalog")).data.data || [],
  });

  const { sorted, orderBy, order, onSort } = useTableSort(scans, {
    testCode: (s) => s.testCode,
    testName: (s) => s.testName,
    price: (s) => Number(s.price),
  });

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
      refetch();
    } catch (err: any) {
      setErrorMsg(getApiErrorMessage(err, "Failed to save the radiology scan."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete radiology scan",
      message: "Are you sure you want to delete this radiology scan? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/lab/radiology-catalog/${id}`);
      refetch();
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to delete the radiology scan."));
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <PageHeader
        title="Radiology Catalog"
        subtitle="Manage available radiology scans, imaging services, and pricing."
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
            Add New Scan
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
        ) : scans.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="No radiology scans found" subtitle="Get started by creating your first scan." />
        ) : (
          <Fade in timeout={500}>
            <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <SortableHeadCell label="Scan Code" sortKey="testCode" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Scan Name" sortKey="testName" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <SortableHeadCell label="Price" sortKey="price" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((scan) => (
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
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
