import { useState, useEffect } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, InputAdornment
} from "@mui/material";
import GeoAddressPicker from "@/components/GeoAddressPicker";
import { EditRounded, DeleteRounded, AddRounded, LocalShippingRounded, SearchRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import Mascot from "@/components/Mascot";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import ErrorState from "@/components/ErrorState";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { useServerSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { validate, hasErrors, isEmail, isPhone } from "@/utils/validation";

// Match the existing plain (non-uppercase) table-head look, overriding
// SortableHeadCell's default uppercase/secondary styling.
const HEAD_SX = {
  fontWeight: 700,
  py: 2,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: "inherit",
  color: "inherit",
} as const;

export default function SupplierDirectory() {
  const theme = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const { orderBy, order, onSort } = useServerSort();

  const [openDialog, setOpenDialog] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);

  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [city, setCity] = useState("");
  const [districtLoc, setDistrictLoc] = useState("");
  const [stateLoc, setStateLoc] = useState("");
  const [country, setCountry] = useState("India");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; email?: string }>({});

  const [errorMsg, setErrorMsg] = useState("");

  // Debounce the search box, resetting to page 1 whenever the term changes.
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 350);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  // Reset to the first page whenever the sort column/direction changes.
  useEffect(() => { setPage(1); }, [orderBy, order]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pharmacy-suppliers", page, debouncedSearch, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/pharmacy/suppliers", {
        params: {
          page,
          limit: ROWS_PER_PAGE,
          search: debouncedSearch || undefined,
          sortBy: orderBy || undefined,
          sortOrder: order,
        },
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
    setDistrictLoc("");
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
    setDistrictLoc(sup.district || "");
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
    // Format guards mirror the backend supplier validator.
    const fmtErrors = validate({ phone, email }, { phone: [isPhone], email: [isEmail] });
    if (hasErrors(fmtErrors)) {
      setFieldErrors(fmtErrors);
      return;
    }
    setFieldErrors({});

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
        district: districtLoc,
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
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, "Failed to save the supplier."));
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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete the supplier."));
    }
  };

  return (
    <PharmacyPage
      title="Supplier Directory"
      subtitle="Manage vendors, distributors, and pharmacy suppliers."
      icon={<LocalShippingRounded fontSize="large" sx={{ color: ACCENTS.pharmacy }} />}
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
          <Box sx={{ p: 2 }}>
            <ListSkeleton rows={6} />
          </Box>
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : suppliers.length === 0 ? (
          <Mascot
            pose={debouncedSearch ? "no-matches" : "nothing-here-yet"}
            title="No suppliers found"
            subtitle={debouncedSearch ? "Try a different search term." : "Get started by adding your first supplier."}
          />
        ) : (
          <Fade in timeout={500}>
            <Box>
              <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <SortableHeadCell label="Code" sortKey="code" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Company Name" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Contact Person" sortKey="contact" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Phone" sortKey="phone" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Email" sortKey="email" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
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
                      <TableCell sx={{ fontWeight: 600, color: ACCENTS.pharmacy }}>{sup.supplierName}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{sup.contactPersonName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{sup.phone}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{sup.email}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenEdit(sup)}
                            sx={{ '&:hover': { bgcolor: alpha(ACCENTS.pharmacy, 0.1) } }}
                          >
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(sup.supplierId)}
                            sx={{ '&:hover': { bgcolor: alpha(SEMANTIC.danger, 0.1) } }}
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
              <Box sx={{ p: 1.5, bgcolor: alpha(SEMANTIC.danger, 0.1), borderRadius: 2, border: '1px solid', borderColor: alpha(SEMANTIC.danger, 0.2) }}>
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
                onChange={(e) => { setPhone(e.target.value); setFieldErrors((p) => ({ ...p, phone: undefined })); }}
                fullWidth
                variant="outlined"
                required
                error={!!fieldErrors.phone}
                helperText={fieldErrors.phone}
              />
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                fullWidth
                variant="outlined"
                required
                error={!!fieldErrors.email}
                helperText={fieldErrors.email}
              />

              <Box sx={{ gridColumn: '1 / -1' }}>
                <Grid container spacing={2}>
                  <GeoAddressPicker
                    showPincode={false} colSpan={6}
                    value={{ stateName: stateLoc, districtName: districtLoc, city }}
                    onChange={(patch) => {
                      if (patch.stateName !== undefined) setStateLoc(patch.stateName);
                      if (patch.districtName !== undefined) setDistrictLoc(patch.districtName);
                      if (patch.city !== undefined) setCity(patch.city);
                    }}
                  />
                </Grid>
              </Box>
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
              background: 'linear-gradient(135deg, #0d9488 0%, #3B82F6 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }
            }}
          >
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </PharmacyPage>
  );
}
