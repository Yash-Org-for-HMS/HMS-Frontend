import { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, InputAdornment
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, LocalShippingRounded, SearchRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";

export default function SupplierDirectory() {
  const theme = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const [openDialog, setOpenDialog] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);

  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [city, setCity] = useState("");
  const [stateLoc, setStateLoc] = useState("");
  const [country, setCountry] = useState("India");
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  // Debounce the search box, resetting to page 1 whenever the term changes.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pharmacy-suppliers", page, debouncedSearch],
    queryFn: async () =>
      (await axiosInstance.get("/pharmacy/suppliers", {
        params: { page, limit: ROWS_PER_PAGE, search: debouncedSearch || undefined },
      })).data,
  });
  const suppliers: any[] = data?.data ?? [];
  const total: number = data?.pagination?.total ?? suppliers.length;
  const pageCount = Math.ceil(total / ROWS_PER_PAGE);

  const handleOpenNew = () => {
    setEditSupplier(null);
    setSupplierCode(`SUP-${Math.floor(1000 + Math.random() * 9000)}`);
    setSupplierName("");
    setContactPersonName("");
    setPhone("");
    setEmail("");
    setGstNumber("");
    setCity("");
    setStateLoc("");
    setCountry("India");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleOpenEdit = (sup: any) => {
    setEditSupplier(sup);
    setSupplierCode(sup.supplierCode);
    setSupplierName(sup.supplierName || "");
    setContactPersonName(sup.contactPersonName || "");
    setPhone(sup.phone || "");
    setEmail(sup.email || "");
    setGstNumber(sup.gstNumber || "");
    setCity(sup.city || "");
    setStateLoc(sup.state || "");
    setCountry(sup.country || "India");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    if (!supplierCode || !supplierName || !contactPersonName || !phone || !email || !city || !stateLoc || !country || !gstNumber) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      const payload = {
        supplierCode,
        supplierName,
        contactPersonName,
        phone,
        email,
        gstNumber,
        city,
        state: stateLoc,
        country
      };

      if (editSupplier) {
        await axiosInstance.put(`/pharmacy/suppliers/${editSupplier.supplierId}`, payload);
      } else {
        await axiosInstance.post("/pharmacy/suppliers", payload);
      }
      handleClose();
      refetch();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to save the supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete supplier",
      message: "Are you sure you want to delete this supplier? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/pharmacy/suppliers/${id}`);
      // If we just removed the last row on this page, step back a page.
      if (suppliers.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        refetch();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete the supplier.");
    }
  };

  return (
    <PharmacyPage
      title="Supplier Directory"
      subtitle="Manage vendors, distributors, and pharmacy suppliers."
      icon={<LocalShippingRounded fontSize="large" sx={{ color: '#4F46E5' }} />}
      action={
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
          Add Supplier
        </Button>
      }
    >
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
            placeholder="Search by Company, Contact Name, or Code..."
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

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
            <CircularProgress size={48} thickness={4} sx={{ color: '#4F46E5' }} />
          </Box>
        ) : isError ? (
          <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
        ) : suppliers.length === 0 ? (
          <Mascot
            pose={debouncedSearch ? "no-matches" : "nothing-here-yet"}
            title="No suppliers found"
            subtitle={debouncedSearch ? "Try a different search term." : "Get started by adding your first supplier."}
          />
        ) : (
          <Fade in timeout={500}>
            <Box>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, py: 2 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }}>Company Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }}>Contact Person</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }}>Email</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suppliers.map((sup) => (
                    <TableRow
                      key={sup.supplierId}
                      hover
                      sx={{
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                          transform: 'scale(1.001)'
                        }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{sup.supplierCode}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#4F46E5' }}>{sup.supplierName}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{sup.contactPersonName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{sup.phone}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{sup.email}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenEdit(sup)}
                            sx={{ '&:hover': { bgcolor: alpha('#4F46E5', 0.1) } }}
                          >
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(sup.supplierId)}
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
              <PaginationBar page={page} pageCount={pageCount} total={total} onChange={setPage} />
            </Box>
          </Fade>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleClose}
        maxWidth="md"
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
            {editSupplier ? "Edit Supplier" : "Add New Supplier"}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {errorMsg && (
              <Box sx={{ p: 1.5, bgcolor: alpha('#EF4444', 0.1), borderRadius: 2, border: '1px solid', borderColor: alpha('#EF4444', 0.2) }}>
                <Typography color="error" variant="body2" fontWeight="500">{errorMsg}</Typography>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Supplier Code"
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
              <TextField
                label="Company Name"
                placeholder="e.g., Apex Pharmaceuticals"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />

              <TextField
                label="Contact Person"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
              <TextField
                label="GST Number"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />

              <TextField
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />

              <TextField
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
              <TextField
                label="State"
                value={stateLoc}
                onChange={(e) => setStateLoc(e.target.value)}
                fullWidth
                variant="outlined"
                required
              />
            </Box>

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
    </PharmacyPage>
  );
}
