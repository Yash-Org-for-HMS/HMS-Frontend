import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, useTheme, alpha, Tabs, Tab, MenuItem, Select
} from "@mui/material";
import { AddRounded, InventoryRounded, ShoppingCartRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import PharmacyPage, { PaginationBar, ROWS_PER_PAGE } from "./components/PharmacyPage";

export default function InventoryManagement() {
  const theme = useTheme();
  const toast = useToast();
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

  const [loading, setLoading] = useState(true);
  const didMount = useRef(false);

  const [openPoDialog, setOpenPoDialog] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<any[]>([{ medicineId: "", orderedQuantity: 0, unitPrice: 0 }]);
  const [savingPo, setSavingPo] = useState(false);

  const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
  const [activePo, setActivePo] = useState<any>(null);
  const [receiveSupplierId, setReceiveSupplierId] = useState("");
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receiving, setReceiving] = useState(false);

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
    const res = await axiosInstance.get("/pharmacy/inventory", { params: { page: p, limit: ROWS_PER_PAGE } });
    setInventory(res.data.data || []);
    setStockTotal(res.data.pagination?.total ?? (res.data.data || []).length);
  };

  const fetchPurchaseOrders = async (p = poPage) => {
    const res = await axiosInstance.get("/pharmacy/purchase-orders", { params: { page: p, limit: ROWS_PER_PAGE } });
    setPurchaseOrders(res.data.data || []);
    setPoTotal(res.data.pagination?.total ?? (res.data.data || []).length);
  };

  // Initial load.
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchReference(), fetchInventory(1), fetchPurchaseOrders(1)]);
      } catch (err) {
        console.error("Failed to fetch inventory data", err);
      } finally {
        setLoading(false);
        didMount.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page changes fetch only the affected list (skipped on the initial mount).
  useEffect(() => {
    if (didMount.current) fetchInventory(stockPage).catch(err => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockPage]);

  useEffect(() => {
    if (didMount.current) fetchPurchaseOrders(poPage).catch(err => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poPage]);

  const getMedicineName = (id: string) => medicines.find(m => m.medicineId === id)?.medicineName || 'Unknown';
  const getSupplierName = (id: string) => suppliers.find(s => s.supplierId === id)?.supplierName || 'Unknown';

  const stockPageCount = Math.ceil(stockTotal / ROWS_PER_PAGE);
  const poPageCount = Math.ceil(poTotal / ROWS_PER_PAGE);
  const alertPageCount = Math.ceil(lowStockAlerts.length / ROWS_PER_PAGE);
  const paginatedAlerts = lowStockAlerts.slice((alertPage - 1) * ROWS_PER_PAGE, alertPage * ROWS_PER_PAGE);

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
      toast.error("Failed to create PO");
    } finally {
      setSavingPo(false);
    }
  };

  const handleOpenReceive = (po: any) => {
    setActivePo(po);
    setReceiveSupplierId(po.supplierId || "");
    setReceiveItems(po.items.map((item: any) => ({
      ...item,
      receivedQuantity: item.orderedQuantity - item.receivedQuantity,
      batchNumber: "",
      expiryDate: ""
    })));
    setOpenReceiveDialog(true);
  };

  const handleReceivePo = async () => {
    if (!activePo.supplierId && !receiveSupplierId) {
      toast.error("Please select a supplier for this PO before receiving.");
      return;
    }
    if (receiveItems.some(i => !i.batchNumber || !i.expiryDate)) {
      toast.error("Please enter batch number and expiry date for all items being received.");
      return;
    }
    try {
      setReceiving(true);
      await axiosInstance.put(`/pharmacy/purchase-orders/${activePo.purchaseOrderId}/receive`, {
        receivedItems: receiveItems.map(item => ({
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
      toast.error(err.response?.data?.message || "Failed to receive PO");
    } finally {
      setReceiving(false);
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
              onClick={async () => {
                try {
                  setAutoGenerating(true);
                  const res = await axiosInstance.post("/pharmacy/auto-generate-pos");
                  toast.success(res.data.data.message);
                  setPoPage(1);
                  await Promise.all([fetchPurchaseOrders(1), fetchReference()]);
                } catch(err) {
                  toast.error("Failed to auto-generate POs");
                } finally {
                  setAutoGenerating(false);
                }
              }}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              {autoGenerating ? "Generating..." : "Auto-Generate POs"}
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8, minHeight: 400, alignItems: "center" }}>
            <CircularProgress size={48} thickness={4} />
          </Box>
        ) : (
          <Box sx={{ minHeight: 400 }}>
            {/* Tab 0: Current Stock */}
            <Box role="tabpanel" hidden={tabValue !== 0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Batch No.</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Available Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventory.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No stock available</TableCell></TableRow>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar page={stockPage} pageCount={stockPageCount} total={stockTotal} onChange={setStockPage} />
            </Box>

            {/* Tab 1: Purchase Orders */}
            <Box role="tabpanel" hidden={tabValue !== 1}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>PO Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No purchase orders</TableCell></TableRow>
                  ) : purchaseOrders.map(po => (
                    <TableRow key={po.purchaseOrderId} hover>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{po.purchaseOrderId.split('-')[0].toUpperCase()}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{getSupplierName(po.supplierId)}</TableCell>
                      <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Box sx={{
                          display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 2, fontSize: '0.8rem', fontWeight: 600,
                          bgcolor: po.status === 'pending' ? alpha('#F59E0B', 0.1) : alpha('#10B981', 0.1),
                          color: po.status === 'pending' ? '#F59E0B' : '#10B981'
                        }}>
                          {po.status.toUpperCase()}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {po.status === 'pending' && (
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
              <PaginationBar page={poPage} pageCount={poPageCount} total={poTotal} onChange={setPoPage} />
            </Box>

            {/* Tab 2: Low Stock Alerts */}
            <Box role="tabpanel" hidden={tabValue !== 2}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Min Stock Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Current Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Pending (On the way)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Default Supplier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowStockAlerts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No low stock alerts. Stock is healthy.</TableCell></TableRow>
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
                                  toast.error("Failed to assign default supplier");
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
    </PharmacyPage>
  );
}
