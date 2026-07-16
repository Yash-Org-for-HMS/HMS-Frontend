import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, useTheme, alpha, Tabs, Tab, MenuItem, Select, IconButton, Tooltip, Autocomplete, Chip
} from "@mui/material";
import { AddRounded, InventoryRounded, ShoppingCartRounded, CheckCircleRounded, EditRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";
import { ListSkeleton } from "../../components/TableRowsSkeleton";
import { useServerSort, useTableSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";

// Match the existing plain (non-uppercase) table-head look, overriding
// SortableHeadCell's default uppercase/secondary styling.
const HEAD_SX = {
  fontWeight: 700,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: "inherit",
  color: "inherit",
} as const;

export default function InventoryManagement() {
  const theme = useTheme();
  const toast = useToast();
  const { activeBranchId } = useHospitalAuth();
  const [tabValue, setTabValue] = useState(0);

  const [inventory, setInventory] = useState<any[]>([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poTotal, setPoTotal] = useState(0);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const [stockPage, setStockPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);

  // Server-side sort for the two genuinely server-paginated tabs.
  const stockSort = useServerSort();
  const poSort = useServerSort();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const didMount = useRef(false);

  const [openPoDialog, setOpenPoDialog] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<any[]>([{ medicineId: "", orderedQuantity: 0, unitPrice: 0 }]);
  const [savingPo, setSavingPo] = useState(false);

  // Auto-generate review dialog: pre-filled from low-stock, but editable and
  // extendable with hand-picked medicines before the POs are actually created.
  const [openAutoDialog, setOpenAutoDialog] = useState(false);
  const [autoRows, setAutoRows] = useState<any[]>([]);

  const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
  const [activePo, setActivePo] = useState<any>(null);
  const [receiveSupplierId, setReceiveSupplierId] = useState("");
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receiving, setReceiving] = useState(false);

  // Correct a mis-entered batch number / expiry date on an already-received
  // inventory row (quantity isn't editable here — that only ever moves via a
  // tracked stock transaction, e.g. receiving, dispensing, ward issue/return).
  const [editInvItem, setEditInvItem] = useState<any>(null);
  const [editBatchNumber, setEditBatchNumber] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [savingInvEdit, setSavingInvEdit] = useState(false);

  // Reference data (full, not paginated) — used for name lookups and the
  // Create PO / Receive dialogs' dropdowns. Also includes low-stock alerts,
  // which are computed by a full scan and paginated client-side.
  const fetchReference = async () => {
    const [medRes, supRes, alertsRes] = await Promise.all([
      axiosInstance.get("/pharmacy/medicines"),
      axiosInstance.get("/pharmacy/suppliers"),
      axiosInstance.get("/pharmacy/low-stock-alerts"),
    ]);
    setMedicines(medRes.data.data || []);
    setSuppliers(supRes.data.data || []);
    setLowStockAlerts(alertsRes.data.data || []);
  };

  const fetchInventory = async (p = stockPage) => {
    const res = await axiosInstance.get("/pharmacy/inventory", {
      params: {
        page: p,
        limit: ROWS_PER_PAGE,
        sortBy: stockSort.orderBy || undefined,
        sortOrder: stockSort.order,
      },
    });
    setInventory(res.data.data || []);
    setStockTotal(res.data.pagination?.total ?? (res.data.data || []).length);
  };

  const fetchPurchaseOrders = async (p = poPage) => {
    const res = await axiosInstance.get("/pharmacy/purchase-orders", {
      params: {
        page: p,
        limit: ROWS_PER_PAGE,
        sortBy: poSort.orderBy || undefined,
        sortOrder: poSort.order,
      },
    });
    setPurchaseOrders(res.data.data || []);
    setPoTotal(res.data.pagination?.total ?? (res.data.data || []).length);
  };

  // Initial load (also re-run on branch switch). Suppress the page-change
  // effects while we reset pagination to 1, so the reset doesn't trigger a
  // duplicate fetch.
  const loadInitial = async () => {
    try {
      didMount.current = false;
      setLoading(true);
      setLoadError(null);
      setStockPage(1);
      setPoPage(1);
      setAlertPage(1);
      await Promise.all([fetchReference(), fetchInventory(1), fetchPurchaseOrders(1)]);
    } catch (err: any) {
      setLoadError(getApiErrorMessage(err, "Failed to load inventory data"));
    } finally {
      setLoading(false);
      didMount.current = true;
    }
  };

  // Reload when the active branch changes — this page fetches imperatively, so
  // BranchSwitcher's react-query invalidation doesn't cover it. The axios
  // interceptor already carries the new X-Branch-Id by the time this runs.
  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  // Page changes fetch only the affected list (skipped on the initial mount).
  useEffect(() => {
    if (didMount.current) fetchInventory(stockPage).catch(err => toast.error(getApiErrorMessage(err, "Failed to load that page of inventory")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockPage]);

  useEffect(() => {
    if (didMount.current) fetchPurchaseOrders(poPage).catch(err => toast.error(getApiErrorMessage(err, "Failed to load that page of purchase orders")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poPage]);

  // Sort changes reset to page 1 and refetch the affected list. We fetch page 1
  // directly here (rather than relying on the page-change effect) because setPage
  // is a no-op when already on page 1.
  useEffect(() => {
    if (!didMount.current) return;
    setStockPage(1);
    fetchInventory(1).catch(err => toast.error(getApiErrorMessage(err, "Failed to sort inventory")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSort.orderBy, stockSort.order]);

  useEffect(() => {
    if (!didMount.current) return;
    setPoPage(1);
    fetchPurchaseOrders(1).catch(err => toast.error(getApiErrorMessage(err, "Failed to sort purchase orders")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poSort.orderBy, poSort.order]);

  const getMedicineName = (id: string) => medicines.find(m => m.medicineId === id)?.medicineName || 'Unknown';
  const getSupplierName = (id: string) => suppliers.find(s => s.supplierId === id)?.supplierName || 'Unknown';

  const stockPageCount = Math.ceil(stockTotal / ROWS_PER_PAGE);
  const poPageCount = Math.ceil(poTotal / ROWS_PER_PAGE);

  // Low Stock Alerts are computed by a full scan and paginated client-side, so
  // we sort the full list in memory (client-side) before slicing the page.
  const { sorted: sortedAlerts, orderBy: alertOrderBy, order: alertOrder, onSort: onAlertSort } =
    useTableSort<any>(lowStockAlerts, {
      medicine: (a) => a.medicineName,
      minStock: (a) => a.minStockLevel,
      currentStock: (a) => a.currentStock,
      pendingStock: (a) => a.pendingStock || 0,
    });
  const alertPageCount = Math.ceil(sortedAlerts.length / ROWS_PER_PAGE);
  const paginatedAlerts = sortedAlerts.slice((alertPage - 1) * ROWS_PER_PAGE, alertPage * ROWS_PER_PAGE);

  // Client-side alert sort just reorders in memory; reset to the first page.
  useEffect(() => { setAlertPage(1); }, [alertOrderBy, alertOrder]);

  const handleCreatePo = async () => {
    if (!poSupplierId || poItems.some(item => !item.medicineId || item.orderedQuantity <= 0)) {
      toast.error("Please fill all fields properly.");
      return;
    }

    try {
      setSavingPo(true);
      const payload = {
        supplierId: poSupplierId,
        orderDate: new Date(),
        items: poItems.map(item => ({
          ...item,
          totalPrice: item.orderedQuantity * item.unitPrice
        }))
      };
      await axiosInstance.post("/pharmacy/purchase-orders", payload);
      setOpenPoDialog(false);
      // Newest PO lands on page 1 (ordered by date desc); jump there and refresh.
      setPoPage(1);
      await Promise.all([fetchPurchaseOrders(1), fetchReference()]);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage((err as any), "Failed to create PO"));
    } finally {
      setSavingPo(false);
    }
  };

  // ── Auto-generate review dialog ────────────────────────────────────────────
  // Suggested order qty / cost mirror the server's auto-generate formulas so the
  // pre-filled numbers match what one-click generation would have produced.
  const suggestedQty = (minStock: number, currentStock: number) => Math.max((minStock || 0) * 2 - (currentStock || 0), minStock || 0) || 1;
  const suggestedPrice = (sellingPrice: any) => Number(((Number(sellingPrice) || 0) * 0.7).toFixed(2));

  const rowFromMedicine = (med: any, currentStock: number | null, low: boolean) => ({
    medicineId: med.medicineId,
    medicineName: med.medicineName,
    genericName: med.genericName,
    currentStock,
    minStockLevel: med.minStockLevel ?? 0,
    orderedQuantity: suggestedQty(med.minStockLevel ?? 0, currentStock ?? 0),
    unitPrice: suggestedPrice(med.sellingPrice),
    supplierId: med.defaultSupplierId || "",
    low,
  });

  const openAutoGenerate = () => {
    // Pre-fill one row per low-stock alert (the alert carries the full medicine).
    setAutoRows(lowStockAlerts.map((a) => rowFromMedicine(a, a.currentStock ?? 0, true)));
    setOpenAutoDialog(true);
  };

  const addAutoMedicine = (med: any) => {
    if (!med || autoRows.some((r) => r.medicineId === med.medicineId)) return;
    setAutoRows((rows) => [...rows, rowFromMedicine(med, null, false)]);
  };
  const updateAutoRow = (idx: number, patch: any) => setAutoRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeAutoRow = (idx: number) => setAutoRows((rows) => rows.filter((_, i) => i !== idx));

  // Distinct supplier buckets = number of POs that will be created (an empty
  // supplier becomes one "no supplier" PO, same as the server's behaviour).
  const autoPoCount = new Set(autoRows.map((r) => r.supplierId || "__none__")).size;

  const handleAutoGenerate = async () => {
    if (autoRows.length === 0) { toast.error("Add at least one medicine."); return; }
    if (autoRows.some((r) => !r.medicineId || r.orderedQuantity <= 0)) { toast.error("Every line needs a medicine and a quantity above zero."); return; }

    // Group by supplier → one PO per supplier (unsupplied items → a null-supplier
    // PO, whose supplier is assigned later at receive time).
    const groups = new Map<string, any[]>();
    autoRows.forEach((r) => {
      const key = r.supplierId || "__none__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    try {
      setAutoGenerating(true);
      let poCount = 0;
      for (const [key, rows] of groups) {
        await axiosInstance.post("/pharmacy/purchase-orders", {
          supplierId: key === "__none__" ? null : key,
          orderDate: new Date(),
          isAutoGenerated: true,
          items: rows.map((r) => ({ medicineId: r.medicineId, orderedQuantity: r.orderedQuantity, unitPrice: r.unitPrice, totalPrice: r.orderedQuantity * r.unitPrice })),
        });
        poCount++;
      }
      toast.success(`Created ${poCount} purchase order${poCount === 1 ? "" : "s"}`);
      setOpenAutoDialog(false);
      setPoPage(1);
      await Promise.all([fetchPurchaseOrders(1), fetchReference()]);
    } catch (err) {
      toast.error(getApiErrorMessage((err as any), "Failed to generate purchase orders"));
      // Some POs may have been created before the failure — refresh so the list is honest.
      await Promise.all([fetchPurchaseOrders(1), fetchReference()]);
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleOpenReceive = (po: any) => {
    setActivePo(po);
    setReceiveSupplierId(po.supplierId || "");
    // Only show items that still have something outstanding — a line already
    // fully received (in an earlier partial round) needs no further action,
    // so it shouldn't sit in this list demanding a batch/expiry it doesn't need.
    setReceiveItems(
      po.items
        .filter((item: any) => item.orderedQuantity - item.receivedQuantity > 0)
        .map((item: any) => ({
          ...item,
          receivedQuantity: item.orderedQuantity - item.receivedQuantity,
          batchNumber: "",
          expiryDate: ""
        }))
    );
    setOpenReceiveDialog(true);
  };

  const handleReceivePo = async () => {
    if (!activePo.supplierId && !receiveSupplierId) {
      toast.error("Please select a supplier for this PO before receiving.");
      return;
    }
    // Batch/expiry are only required for items actually arriving THIS round —
    // a line left at 0 (back-ordered / not delivered yet) is simply skipped,
    // so it stays open on the PO for a later partial receipt instead of
    // blocking the whole submission.
    const itemsToReceive = receiveItems.filter(i => Number(i.receivedQuantity) > 0);
    if (itemsToReceive.length === 0) {
      toast.error("Enter a received quantity greater than 0 for at least one item.");
      return;
    }
    if (itemsToReceive.some(i => !i.batchNumber || !i.expiryDate)) {
      toast.error("Please enter batch number and expiry date for each item you're receiving.");
      return;
    }
    try {
      setReceiving(true);
      await axiosInstance.put(`/pharmacy/purchase-orders/${activePo.purchaseOrderId}/receive`, {
        receivedItems: itemsToReceive.map(item => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          medicineId: item.medicineId,
          receivedQuantity: item.receivedQuantity,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          supplierId: activePo.supplierId || receiveSupplierId
        }))
      });
      setOpenReceiveDialog(false);
      // Receiving changes stock, PO status, and alerts — refresh all three.
      await Promise.all([fetchInventory(stockPage), fetchPurchaseOrders(poPage), fetchReference()]);
    } catch (err: any) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Failed to receive PO"));
    } finally {
      setReceiving(false);
    }
  };

  const handleOpenEditInventory = (inv: any) => {
    setEditInvItem(inv);
    setEditBatchNumber(inv.batchNumber || "");
    setEditExpiryDate(inv.expiryDate ? new Date(inv.expiryDate).toISOString().slice(0, 10) : "");
  };

  const handleSaveInventoryEdit = async () => {
    if (!editInvItem || !editBatchNumber.trim() || !editExpiryDate) {
      toast.error("Batch number and expiry date are required.");
      return;
    }
    try {
      setSavingInvEdit(true);
      await axiosInstance.put(`/pharmacy/inventory/${editInvItem.inventoryId}`, {
        batchNumber: editBatchNumber.trim(),
        expiryDate: editExpiryDate,
      });
      toast.success("Batch updated");
      setEditInvItem(null);
      await fetchInventory(stockPage);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update this batch"));
    } finally {
      setSavingInvEdit(false);
    }
  };

  return (
    <PharmacyPage
      title="Inventory & POs"
      subtitle="Manage stock levels, raise purchase orders, and receive goods."
      icon={<InventoryRounded fontSize="large" sx={{ color: '#4F46E5' }} />}
      action={
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => {
            setPoSupplierId("");
            setPoItems([{ medicineId: "", orderedQuantity: 0, unitPrice: 0 }]);
            setOpenPoDialog(true);
          }}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1.2,
            background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
            boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
          }}
        >
          Create PO
        </Button>
      }
    >
      <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <Tab label="Current Stock" sx={{ fontWeight: 600 }} />
          <Tab label="Purchase Orders" sx={{ fontWeight: 600 }} />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Low Stock Alerts
              {lowStockAlerts.length > 0 && (
                <Box sx={{ bgcolor: 'error.main', color: 'white', px: 1, borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 }}>
                  {lowStockAlerts.length}
                </Box>
              )}
            </Box>
          } sx={{ fontWeight: 600 }} />
        </Tabs>

        {/* Shared action bar — always rendered so height never shifts between tabs */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          minHeight: 56
        }}>
          {tabValue === 2 && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<ShoppingCartRounded />}
              disabled={lowStockAlerts.length === 0 || autoGenerating}
              onClick={openAutoGenerate}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Auto-Generate POs
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ p: 2, minHeight: 400 }}>
            <ListSkeleton rows={6} />
          </Box>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadInitial} />
        ) : (
          <Box sx={{ minHeight: 400 }}>
            {/* Tab 0: Current Stock */}
            <Box role="tabpanel" hidden={tabValue !== 0}>
              <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                    <SortableHeadCell label="Batch No." sortKey="batch" orderBy={stockSort.orderBy} order={stockSort.order} onSort={stockSort.onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Expiry Date" sortKey="expiry" orderBy={stockSort.orderBy} order={stockSort.order} onSort={stockSort.onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Available Qty" sortKey="quantity" orderBy={stockSort.orderBy} order={stockSort.order} onSort={stockSort.onSort} sx={HEAD_SX} />
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventory.length === 0 ? (
                    <TableRow><TableCell colSpan={6} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="No stock available." size={110} /></TableCell></TableRow>
                  ) : inventory.map(inv => (
                    <TableRow key={inv.inventoryId} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#4F46E5' }}>{getMedicineName(inv.medicineId)}</TableCell>
                      <TableCell>{inv.batchNumber}</TableCell>
                      <TableCell sx={{ color: new Date(inv.expiryDate) < new Date() ? 'error.main' : 'inherit' }}>
                        {new Date(inv.expiryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: inv.availableQuantity <= inv.reorderLevel ? 'warning.main' : 'success.main' }}>
                        {inv.availableQuantity}
                      </TableCell>
                      <TableCell>{getSupplierName(inv.supplierId)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Correct batch no. / expiry date">
                          <IconButton size="small" onClick={() => handleOpenEditInventory(inv)}>
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
              <PaginationBar page={stockPage} pageCount={stockPageCount} total={stockTotal} onChange={setStockPage} />
            </Box>

            {/* Tab 1: Purchase Orders */}
            <Box role="tabpanel" hidden={tabValue !== 1}>
              <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>PO Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                    <SortableHeadCell label="Date" sortKey="date" orderBy={poSort.orderBy} order={poSort.order} onSort={poSort.onSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Status" sortKey="status" orderBy={poSort.orderBy} order={poSort.order} onSort={poSort.onSort} sx={HEAD_SX} />
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="No purchase orders." size={110} /></TableCell></TableRow>
                  ) : purchaseOrders.map(po => (
                    <TableRow key={po.purchaseOrderId} hover>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{po.purchaseOrderId.split('-')[0].toUpperCase()}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{getSupplierName(po.supplierId)}</TableCell>
                      <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Box sx={{
                          display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 2, fontSize: '0.875rem', fontWeight: 600,
                          bgcolor: po.status === 'pending' ? alpha('#F59E0B', 0.1) : po.status === 'partial' ? alpha('#3B82F6', 0.1) : alpha('#10B981', 0.1),
                          color: po.status === 'pending' ? '#F59E0B' : po.status === 'partial' ? '#3B82F6' : '#10B981'
                        }}>
                          {po.status.toUpperCase()}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {(po.status === 'pending' || po.status === 'partial') && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CheckCircleRounded />}
                            onClick={() => handleOpenReceive(po)}
                          >
                            Receive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
              <PaginationBar page={poPage} pageCount={poPageCount} total={poTotal} onChange={setPoPage} />
            </Box>

            {/* Tab 2: Low Stock Alerts */}
            <Box role="tabpanel" hidden={tabValue !== 2}>
              <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <SortableHeadCell label="Medicine" sortKey="medicine" orderBy={alertOrderBy} order={alertOrder} onSort={onAlertSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Min Stock Level" sortKey="minStock" orderBy={alertOrderBy} order={alertOrder} onSort={onAlertSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Current Stock" sortKey="currentStock" orderBy={alertOrderBy} order={alertOrder} onSort={onAlertSort} sx={HEAD_SX} />
                    <SortableHeadCell label="Pending (On the way)" sortKey="pendingStock" orderBy={alertOrderBy} order={alertOrder} onSort={onAlertSort} sx={HEAD_SX} />
                    <TableCell sx={{ fontWeight: 700 }}>Default Supplier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowStockAlerts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} sx={{ py: 3, border: 0 }}><Mascot pose="all-caught-up" subtitle="No low stock alerts — stock is healthy." size={110} /></TableCell></TableRow>
                  ) : paginatedAlerts.map(alert => (
                    <TableRow key={alert.medicineId} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#4F46E5' }}>{alert.medicineName}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{alert.minStockLevel}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'error.main' }}>{alert.currentStock}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'warning.main' }}>{alert.pendingStock || 0}</TableCell>
                      <TableCell>
                        {alert.defaultSupplierId ? (
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{getSupplierName(alert.defaultSupplierId)}</Typography>
                        ) : (
                          <Select
                            size="small"
                            displayEmpty
                            value=""
                            onChange={async (e) => {
                              if (e.target.value) {
                                try {
                                  await axiosInstance.put(`/pharmacy/medicines/${alert.medicineId}`, {
                                    defaultSupplierId: e.target.value
                                  });
                                  await fetchReference();
                                } catch(err) {
                                  toast.error(getApiErrorMessage((err as any), "Failed to assign default supplier"));
                                }
                              }
                            }}
                            sx={{ minWidth: 150, fontSize: '0.875rem' }}
                          >
                            <MenuItem value="" disabled>Assign Supplier</MenuItem>
                            {suppliers.map(sup => (
                              <MenuItem key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</MenuItem>
                            ))}
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
              <PaginationBar page={alertPage} pageCount={alertPageCount} total={lowStockAlerts.length} onChange={setAlertPage} />
            </Box>
          </Box>
        )}
      </Paper>

      {/* Create PO Dialog */}
      <Dialog open={openPoDialog} onClose={() => setOpenPoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Raise Purchase Order</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField select label="Supplier" value={poSupplierId} onChange={e => setPoSupplierId(e.target.value)} fullWidth>
            {suppliers.map(sup => (
              <MenuItem key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</MenuItem>
            ))}
          </TextField>

          <Typography variant="subtitle2">Order Items</Typography>
          {poItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField select label="Medicine" value={item.medicineId} onChange={e => {
                const newItems = [...poItems];
                newItems[idx].medicineId = e.target.value;
                setPoItems(newItems);
              }} sx={{ flex: 2 }}>
                {medicines.map(med => <MenuItem key={med.medicineId} value={med.medicineId}>{med.medicineName} ({med.genericName})</MenuItem>)}
              </TextField>
              <TextField type="number" label="Qty" value={item.orderedQuantity} onChange={e => {
                const newItems = [...poItems];
                newItems[idx].orderedQuantity = parseInt(e.target.value) || 0;
                setPoItems(newItems);
              }} sx={{ flex: 1 }} />
              <TextField type="number" label="Unit Price" value={item.unitPrice} onChange={e => {
                const newItems = [...poItems];
                newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                setPoItems(newItems);
              }} sx={{ flex: 1 }} />
            </Box>
          ))}
          <Button onClick={() => setPoItems([...poItems, { medicineId: "", orderedQuantity: 0, unitPrice: 0 }])} variant="text" sx={{ alignSelf: 'flex-start' }}>
            + Add Item
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPoDialog(false)}>Cancel</Button>
          <Button onClick={handleCreatePo} variant="contained" disabled={savingPo}>{savingPo ? "Creating..." : "Create PO"}</Button>
        </DialogActions>
      </Dialog>

      {/* Auto-Generate PO review dialog */}
      <Dialog open={openAutoDialog} onClose={() => !autoGenerating && setOpenAutoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Auto-Generate Purchase Orders</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pre-filled from low-stock items with suggested quantities. Adjust anything, remove what you don't need, or add other medicines below. Items are grouped by supplier into separate POs.
          </Typography>

          {/* Add a separate (not necessarily low-stock) medicine */}
          <Autocomplete
            options={medicines.filter((m) => !autoRows.some((r) => r.medicineId === m.medicineId))}
            getOptionLabel={(m: any) => (m ? `${m.medicineName}${m.genericName ? ` (${m.genericName})` : ""}` : "")}
            isOptionEqualToValue={(o: any, v: any) => o.medicineId === v?.medicineId}
            value={null}
            onChange={(_, v) => v && addAutoMedicine(v)}
            renderInput={(params) => <TextField {...params} label="Add another medicine" placeholder="Search by name or generic…" />}
          />

          {autoRows.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No items — add a medicine to order.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_SX}>Medicine</TableCell>
                    <TableCell sx={HEAD_SX} align="center">Stock (cur / min)</TableCell>
                    <TableCell sx={HEAD_SX}>Supplier</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Qty</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Unit price</TableCell>
                    <TableCell sx={HEAD_SX} align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {autoRows.map((r, idx) => (
                    <TableRow key={r.medicineId}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {r.medicineName}
                          {!r.low && <Chip label="added" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(8,145,178,0.12)', color: '#0891b2' }} />}
                        </Typography>
                        {r.genericName && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.genericName}</Typography>}
                      </TableCell>
                      <TableCell align="center" sx={{ color: 'text.secondary' }}>
                        {r.currentStock == null ? "—" : r.currentStock} / {r.minStockLevel}
                      </TableCell>
                      <TableCell>
                        <Select size="small" value={r.supplierId} displayEmpty onChange={(e) => updateAutoRow(idx, { supplierId: e.target.value })} sx={{ minWidth: 150 }}>
                          <MenuItem value=""><em>— No supplier —</em></MenuItem>
                          {suppliers.map((sup) => <MenuItem key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</MenuItem>)}
                        </Select>
                      </TableCell>
                      <TableCell align="right">
                        <TextField type="number" size="small" value={r.orderedQuantity} onChange={(e) => updateAutoRow(idx, { orderedQuantity: parseInt(e.target.value) || 0 })} inputProps={{ min: 1, style: { textAlign: 'right', width: 70 } }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField type="number" size="small" value={r.unitPrice} onChange={(e) => updateAutoRow(idx, { unitPrice: parseFloat(e.target.value) || 0 })} inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', width: 80 } }} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => removeAutoRow(idx)} sx={{ color: '#ef4444' }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {autoRows.length} item{autoRows.length === 1 ? "" : "s"} · {autoPoCount} purchase order{autoPoCount === 1 ? "" : "s"}
          </Typography>
          <Box>
            <Button onClick={() => setOpenAutoDialog(false)} disabled={autoGenerating}>Cancel</Button>
            <Button onClick={handleAutoGenerate} variant="contained" color="warning" disabled={autoGenerating || autoRows.length === 0} sx={{ ml: 1 }}>
              {autoGenerating ? "Generating…" : `Generate ${autoPoCount} PO${autoPoCount === 1 ? "" : "s"}`}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Receive PO Dialog */}
      <Dialog open={openReceiveDialog} onClose={() => setOpenReceiveDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Receive Goods (PO: {activePo?.purchaseOrderId.split('-')[0].toUpperCase()})</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {!activePo?.supplierId && (
            <TextField
              select
              label="Assign Supplier"
              value={receiveSupplierId}
              onChange={e => setReceiveSupplierId(e.target.value)}
              fullWidth
              SelectProps={{ native: true }}
              helperText="This Auto-Generated PO is missing a supplier. Please assign one."
              error={!receiveSupplierId}
            >
              <option value=""></option>
              {suppliers.map(sup => (
                <option key={sup.supplierId} value={sup.supplierId}>{sup.supplierName}</option>
              ))}
            </TextField>
          )}
          {receiveItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="primary">{getMedicineName(item.medicineId)}</Typography>
                <Typography variant="caption" color="text.secondary">Ordered: {item.orderedQuantity}</Typography>
              </Box>
              <TextField type="number" label="Receiving Qty" size="small" value={item.receivedQuantity} onChange={e => {
                const newItems = [...receiveItems];
                newItems[idx].receivedQuantity = parseInt(e.target.value) || 0;
                setReceiveItems(newItems);
              }} />
              <TextField label="Batch No." size="small" value={item.batchNumber} onChange={e => {
                const newItems = [...receiveItems];
                newItems[idx].batchNumber = e.target.value;
                setReceiveItems(newItems);
              }} />
              <TextField type="date" label="Expiry" size="small" InputLabelProps={{ shrink: true }} value={item.expiryDate} onChange={e => {
                const newItems = [...receiveItems];
                newItems[idx].expiryDate = e.target.value;
                setReceiveItems(newItems);
              }} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReceiveDialog(false)}>Cancel</Button>
          <Button onClick={handleReceivePo} variant="contained" color="success" disabled={receiving}>{receiving ? "Processing..." : "Confirm Receipt"}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Inventory Batch Dialog — correct a mis-entered batch no. / expiry */}
      <Dialog open={!!editInvItem} onClose={() => setEditInvItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Batch — {editInvItem ? getMedicineName(editInvItem.medicineId) : ""}</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            label="Batch No."
            value={editBatchNumber}
            onChange={e => setEditBatchNumber(e.target.value)}
            fullWidth
            required
          />
          <TextField
            type="date"
            label="Expiry Date"
            InputLabelProps={{ shrink: true }}
            value={editExpiryDate}
            onChange={e => setEditExpiryDate(e.target.value)}
            fullWidth
            required
          />
          <Typography variant="caption" color="text.secondary">
            Quantity isn't editable here — it only changes via receiving, dispensing, or ward stock issue/return.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditInvItem(null)} disabled={savingInvEdit}>Cancel</Button>
          <Button onClick={handleSaveInventoryEdit} variant="contained" disabled={savingInvEdit}>
            {savingInvEdit ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </PharmacyPage>
  );
}
