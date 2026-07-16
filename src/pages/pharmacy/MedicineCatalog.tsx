import { useState, useEffect } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, InputAdornment
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, MedicationRounded, SearchRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../../api/axios";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import Mascot from "../../components/Mascot";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import ErrorState from "../../components/ErrorState";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";
import { ListSkeleton } from "../../components/TableRowsSkeleton";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useServerSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";
import { validate, hasErrors, required, isNonNegativeNumber, min } from "../../utils/validation";

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

export default function MedicineCatalog() {
  const theme = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const { orderBy, order, onSort } = useServerSort();

  const [openDialog, setOpenDialog] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);

  const [medicineCode, setMedicineCode] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("10");
  const [defaultSupplierId, setDefaultSupplierId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ sellingPrice?: string; minStockLevel?: string }>({});

  const [errorMsg, setErrorMsg] = useState("");

  // Suppliers — used only for the dialog dropdown (full list).
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["pharmacy-suppliers"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/suppliers")).data.data || [],
  });

  // Debounce the search box, resetting to page 1 whenever the term changes.
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 350);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  // Reset to the first page whenever the sort column/direction changes.
  useEffect(() => { setPage(1); }, [orderBy, order]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pharmacy-medicines", page, debouncedSearch, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/pharmacy/medicines", {
        params: {
          page,
          limit: ROWS_PER_PAGE,
          search: debouncedSearch || undefined,
          sortBy: orderBy || undefined,
          sortOrder: order,
        },
      })).data,
  });
  const medicines: any[] = data?.data ?? [];
  const total: number = data?.pagination?.total ?? medicines.length;
  const pageCount = Math.ceil(total / ROWS_PER_PAGE);

  const handleOpenNew = () => {
    setEditMed(null);
    setMedicineCode(`MED-${Math.floor(1000 + Math.random() * 9000)}`);
    setMedicineName("");
    setGenericName("");
    setManufacturer("");
    setSellingPrice("");
    setMinStockLevel("10");
    setDefaultSupplierId("");
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
    setMinStockLevel(med.minStockLevel?.toString() || "10");
    setDefaultSupplierId(med.defaultSupplierId || "");
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
    // Numeric guards mirror the backend: price ≥ 0, min-stock a non-negative whole number.
    const numErrors = validate(
      { sellingPrice, minStockLevel },
      { sellingPrice: [required("Selling price"), isNonNegativeNumber], minStockLevel: [min(0)] },
    );
    if (hasErrors(numErrors)) {
      setFieldErrors(numErrors);
      return;
    }
    setFieldErrors({});

    try {
      setSaving(true);
      setErrorMsg("");
      const payload = {
        medicineCode,
        medicineName,
        genericName,
        manufacturer,
        sellingPrice: parseFloat(sellingPrice),
        minStockLevel: parseInt(minStockLevel) || 10,
        defaultSupplierId: defaultSupplierId || null
      };

      if (editMed) {
        await axiosInstance.put(`/pharmacy/medicines/${editMed.medicineId}`, payload);
      } else {
        await axiosInstance.post("/pharmacy/medicines", payload);
      }
      handleClose();
      refetch();
    } catch (err: any) {
      setErrorMsg(getApiErrorMessage(err, "Failed to save the medicine."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete medicine",
      message: "Are you sure you want to delete this medicine? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/pharmacy/medicines/${id}`);
      // If we just removed the last row on this page, step back a page.
      if (medicines.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        refetch();
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to delete the medicine."));
    }
  };

  return (
    <PharmacyPage
      title="Medicine Catalog"
      subtitle="Manage the hospital's drug formulary, generic compositions, and pricing."
      icon={<MedicationRounded fontSize="large" sx={{ color: '#4F46E5' }} />}
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
          Add Medicine
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

        {isLoading ? (
          <Box sx={{ p: 2 }}>
            <ListSkeleton rows={6} />
          </Box>
        ) : isError ? (
          <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
        ) : medicines.length === 0 ? (
          <Mascot
            pose={debouncedSearch ? "no-matches" : "nothing-here-yet"}
            title="No medicines found"
            subtitle={debouncedSearch ? "Try a different search term." : "Get started by creating your first medicine entry."}
          />
        ) : (
          <Fade in timeout={500}>
            <Box>
              <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <SortableHeadCell label="Code" sortKey="code" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Brand Name" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Generic / Salt" sortKey="generic" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Manufacturer" sortKey="manufacturer" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Selling Price" sortKey="price" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                    <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {medicines.map((med) => (
                    <TableRow
                      key={med.medicineId}
                      hover
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                        }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{med.medicineCode}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#4F46E5' }}>{med.medicineName}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{med.genericName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{med.manufacturer || 'N/A'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#10B981' }}>₹{parseFloat(med.sellingPrice).toFixed(2)}</TableCell>
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
                label="Selling Price (₹)"
                type="number"
                value={sellingPrice}
                onChange={(e) => { setSellingPrice(e.target.value); setFieldErrors((p) => ({ ...p, sellingPrice: undefined })); }}
                fullWidth
                variant="outlined"
                required
                error={!!fieldErrors.sellingPrice}
                helperText={fieldErrors.sellingPrice}
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

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Min Stock Level (Alert Threshold)"
                type="number"
                value={minStockLevel}
                onChange={(e) => { setMinStockLevel(e.target.value); setFieldErrors((p) => ({ ...p, minStockLevel: undefined })); }}
                fullWidth
                variant="outlined"
                error={!!fieldErrors.minStockLevel}
                helperText={fieldErrors.minStockLevel || "Triggers low stock alert"}
              />
              <TextField
                select
                label="Default Supplier (Auto PO)"
                value={defaultSupplierId}
                onChange={(e) => setDefaultSupplierId(e.target.value)}
                fullWidth
                variant="outlined"
                SelectProps={{ native: true }}
                helperText="Supplier for auto POs"
              >
                <option value=""></option>
                {suppliers.map(sup => (
                  <option key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</option>
                ))}
              </TextField>
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
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </PharmacyPage>
  );
}
