import { useState, useEffect } from "react";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, InputAdornment, Chip, Alert
} from "@mui/material";
import { EditRounded, DeleteRounded, AddRounded, SearchRounded } from "@mui/icons-material";
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
import { validate, hasErrors, required, isNonNegativeNumber, min, max } from "@/utils/validation";

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
  const { data: taxGaps } = useQuery<{ total: number; missingHsn: number; missingCost: number }>({
    queryKey: ["pharmacy-tax-gaps"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/medicines/tax-gaps")).data.data,
  });
  const { orderBy, order, onSort } = useServerSort();

  const [openDialog, setOpenDialog] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);

  const [medicineCode, setMedicineCode] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  // Show only medicines that would bill without an HSN code.
  const [taxOnly, setTaxOnly] = useState(false);
  // Show only medicines with no cost from any source.
  const [costOnly, setCostOnly] = useState(false);
  const [costPrice, setCostPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("10");
  const [defaultSupplierId, setDefaultSupplierId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

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
    queryKey: ["pharmacy-medicines", page, debouncedSearch, orderBy, order, taxOnly, costOnly],
    queryFn: async () =>
      (await axiosInstance.get("/pharmacy/medicines", {
        params: {
          page,
          limit: ROWS_PER_PAGE,
          search: debouncedSearch || undefined,
          taxIncomplete: taxOnly || undefined,
          costMissing: costOnly || undefined,
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
    setGstPercent("");
    setHsnCode("");
    setCostPrice("");
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
    setGstPercent(med.gstPercent != null && Number(med.gstPercent) > 0 ? med.gstPercent.toString() : "");
    setHsnCode(med.hsnCode || "");
    setCostPrice(med.costPrice != null ? String(med.costPrice) : "");
    setMinStockLevel(med.minStockLevel?.toString() || "10");
    setDefaultSupplierId(med.defaultSupplierId || "");
    setErrorMsg("");
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    // One pass over every field, so the error lands ON the offending input
    // instead of a banner saying "fill in all required fields" that leaves the
    // user hunting for which one. Numeric bounds mirror the server's caps.
    const errors = validate(
      { medicineCode, medicineName, genericName, sellingPrice, minStockLevel, gstPercent },
      {
        medicineCode: [required("Medicine code")],
        medicineName: [required("Medicine name")],
        genericName: [required("Generic name")],
        sellingPrice: [required("Selling price"), isNonNegativeNumber, max(10000000)],
        minStockLevel: [min(0), max(100000)],
        gstPercent: [min(0), max(100)],
      },
    );
    if (hasErrors(errors)) {
      setFieldErrors(errors);
      setErrorMsg("");
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
        gstPercent: gstPercent === "" ? 0 : parseFloat(gstPercent),
        hsnCode: hsnCode.trim() || null,
        // Blank clears it, which is how a wrong typed cost is withdrawn.
        costPrice: costPrice.trim() === "" ? null : parseFloat(costPrice),
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete the medicine."));
    }
  };

  return (
    <PharmacyPage
      title="Medicine Catalog"
      subtitle="Manage the hospital's drug formulary, generic compositions, and pricing."
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
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
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
        {/* Stated once, over the whole catalog. A medicine with no HSN still
            sells perfectly well — it just bills without a code on the line, and
            nothing anywhere said so. */}
        {(!!taxGaps?.missingHsn || !!taxGaps?.missingCost) && (
          <Alert severity="warning" sx={{ borderRadius: 0 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {!!taxGaps?.missingHsn && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <span>{taxGaps.missingHsn} of {taxGaps.total} have no HSN/SAC — those lines print on the tax invoice without one.</span>
                  <Button size="small" color="inherit" onClick={() => { setTaxOnly((v) => !v); setCostOnly(false); setPage(1); }}
                    sx={{ textTransform: "none", fontWeight: 700 }}>
                    {taxOnly ? "Show all" : "Show these"}
                  </Button>
                </Box>
              )}
              {!!taxGaps?.missingCost && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <span>{taxGaps.missingCost} of {taxGaps.total} have no cost on record — stock valuation cannot speak for them.</span>
                  <Button size="small" color="inherit" onClick={() => { setCostOnly((v) => !v); setTaxOnly(false); setPage(1); }}
                    sx={{ textTransform: "none", fontWeight: 700 }}>
                    {costOnly ? "Show all" : "Show these"}
                  </Button>
                </Box>
              )}
            </Box>
          </Alert>
        )}
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
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
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
                      <TableCell sx={{ fontWeight: 600, color: BRAND.action }}>{med.medicineName}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{med.genericName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{med.manufacturer || 'N/A'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: SEMANTIC.success }}>
                        ₹{parseFloat(med.sellingPrice).toFixed(2)}
                        {Number(med.gstPercent) > 0 && (
                          <Typography component="span" sx={{ ml: 0.5, fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
                            +{Number(med.gstPercent)}% GST
                          </Typography>
                        )}
                        {/* GST 0 is not flagged — plenty of drugs are genuinely
                            zero-rated, and marking those would teach the reader
                            to ignore the marker. A missing HSN is unambiguous. */}
                        {!med.hsnCode && (
                          <Tooltip title="No HSN/SAC code — this medicine bills without one on the tax invoice">
                            <Chip label="No HSN" size="small" sx={{ ml: 1, height: 18, fontSize: 10, fontWeight: 700,
                              bgcolor: `${SEMANTIC.warning}22`, color: SEMANTIC.warning }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenEdit(med)}
                            sx={{ '&:hover': { bgcolor: alpha(BRAND.action, 0.1) } }}
                          >
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(med.medicineId)}
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
              <Box sx={{ p: 1.5, bgcolor: alpha(SEMANTIC.danger, 0.1), borderRadius: 2, border: '1px solid', borderColor: alpha(SEMANTIC.danger, 0.2) }}>
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
                error={!!fieldErrors.medicineCode}
                helperText={fieldErrors.medicineCode}
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
                inputProps={{ min: 0, max: 10000000 }}
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
              error={!!fieldErrors.medicineName}
              helperText={fieldErrors.medicineName}
            />

            <TextField
              label="Generic Name / Composition"
              placeholder="e.g., Paracetamol 500mg"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              fullWidth
              variant="outlined"
              required
              error={!!fieldErrors.genericName}
              helperText={fieldErrors.genericName || "The active pharmaceutical ingredient (Salt)"}
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
                label="GST % (optional)"
                type="number"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                fullWidth
                variant="outlined"
                inputProps={{ min: 0, max: 100 }}
                error={!!fieldErrors.gstPercent}
                helperText={fieldErrors.gstPercent || "0 = zero-rated. Applied per medicine on the bill."}
              />
              <TextField
                label="Cost / unit (optional)"
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                fullWidth
                variant="outlined"
                inputProps={{ min: 0, step: "0.01" }}
                helperText="Used to value stock until a supplier invoice supersedes it"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="HSN/SAC"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                fullWidth
                variant="outlined"
                inputProps={{ maxLength: 10 }}
                helperText={hsnCode.trim() ? " " : "Prints on the tax invoice line"}
              />
            </Box>

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
                inputProps={{ min: 0, max: 100000 }}
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
              boxShadow: 'none',
            }}
          >
            {saving ? <HeartbeatLoader size={22} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </PharmacyPage>
  );
}
