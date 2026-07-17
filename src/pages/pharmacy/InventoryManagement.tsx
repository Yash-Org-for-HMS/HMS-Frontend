import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, useTheme, alpha, Tabs, Tab, MenuItem, Select, IconButton, Tooltip
} from "@mui/material";
import { AddRounded, InventoryRounded, ShoppingCartRounded, CheckCircleRounded, EditRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";
import { ListSkeleton } from "../../components/TableRowsSkeleton";
import { useServerSort, useTableSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";
import CreatePODialog from "../../components/pharmacy/CreatePODialog";
import AutoGeneratePODialog from "../../components/pharmacy/AutoGeneratePODialog";
import ReceivePODialog from "../../components/pharmacy/ReceivePODialog";
import EditBatchDialog from "../../components/pharmacy/EditBatchDialog";

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

  const [stockPage, setStockPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);

  // Server-side sort for the two genuinely server-paginated tabs.
  const stockSort = useServerSort();
  const poSort = useServerSort();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const didMount = useRef(false);

  // Dialog triggers — each dialog owns its own form state internally.
  const [openPoDialog, setOpenPoDialog] = useState(false);
  const [openAutoDialog, setOpenAutoDialog] = useState(false);
  const [receivePo, setReceivePo] = useState<any>(null);
  const [editInvItem, setEditInvItem] = useState<any>(null);

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
    } catch (err: unknown) {
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

  // Refresh helpers the dialogs call after a successful write.
  const afterPoCreated = async () => {
    // Newest PO lands on page 1 (ordered by date desc); jump there and refresh.
    setPoPage(1);
    await Promise.all([fetchPurchaseOrders(1), fetchReference()]);
  };
  const afterReceived = async () => {
    // Receiving changes stock, PO status, and alerts — refresh all three.
    await Promise.all([fetchInventory(stockPage), fetchPurchaseOrders(poPage), fetchReference()]);
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
          onClick={() => setOpenPoDialog(true)}
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
              disabled={lowStockAlerts.length === 0}
              onClick={() => setOpenAutoDialog(true)}
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
                          <IconButton size="small" onClick={() => setEditInvItem(inv)}>
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
                            onClick={() => setReceivePo(po)}
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
                                  toast.error(getApiErrorMessage(err, "Failed to assign default supplier"));
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

      <CreatePODialog
        open={openPoDialog}
        onClose={() => setOpenPoDialog(false)}
        suppliers={suppliers}
        medicines={medicines}
        onCreated={afterPoCreated}
      />

      <AutoGeneratePODialog
        open={openAutoDialog}
        onClose={() => setOpenAutoDialog(false)}
        lowStockAlerts={lowStockAlerts}
        medicines={medicines}
        suppliers={suppliers}
        onGenerated={afterPoCreated}
      />

      <ReceivePODialog
        po={receivePo}
        onClose={() => setReceivePo(null)}
        suppliers={suppliers}
        getMedicineName={getMedicineName}
        onReceived={afterReceived}
      />

      <EditBatchDialog
        item={editInvItem}
        onClose={() => setEditInvItem(null)}
        getMedicineName={getMedicineName}
        onSaved={() => fetchInventory(stockPage)}
      />
    </PharmacyPage>
  );
}
