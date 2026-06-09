import { useState, useEffect } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, IconButton, Tooltip, useTheme, Fade, Zoom, alpha, Tabs, Tab, MenuItem
} from "@mui/material";
import { AddRounded, InventoryRounded, ShoppingCartRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function InventoryManagement() {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [openPoDialog, setOpenPoDialog] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<any[]>([{ medicineId: "", orderedQuantity: 0, unitPrice: 0 }]);
  const [savingPo, setSavingPo] = useState(false);
  
  const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
  const [activePo, setActivePo] = useState<any>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receiving, setReceiving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, poRes, medRes, supRes] = await Promise.all([
        axiosInstance.get("/pharmacy/inventory"),
        axiosInstance.get("/pharmacy/purchase-orders"),
        axiosInstance.get("/pharmacy/medicines"),
        axiosInstance.get("/pharmacy/suppliers")
      ]);
      setInventory(invRes.data.data || []);
      setPurchaseOrders(poRes.data.data || []);
      setMedicines(medRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch inventory data", err);
    } finally {
      setLoading(false);
    }
  };

  const getMedicineName = (id: string) => medicines.find(m => m.medicineId === id)?.medicineName || 'Unknown';
  const getSupplierName = (id: string) => suppliers.find(s => s.supplierId === id)?.supplierName || 'Unknown';

  const handleCreatePo = async () => {
    if (!poSupplierId || poItems.some(item => !item.medicineId || item.orderedQuantity <= 0)) {
      alert("Please fill all fields properly.");
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
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to create PO");
    } finally {
      setSavingPo(false);
    }
  };

  const handleOpenReceive = (po: any) => {
    setActivePo(po);
    setReceiveItems(po.items.map((item: any) => ({
      ...item,
      receivedQuantity: item.orderedQuantity - item.receivedQuantity,
      batchNumber: "",
      expiryDate: ""
    })));
    setOpenReceiveDialog(true);
  };

  const handleReceivePo = async () => {
    if (receiveItems.some(i => !i.batchNumber || !i.expiryDate)) {
      alert("Please enter batch number and expiry date for all items being received.");
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
          supplierId: activePo.supplierId
        }))
      });
      setOpenReceiveDialog(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to receive PO");
    } finally {
      setReceiving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <InventoryRounded fontSize="large" sx={{ color: '#4F46E5' }} />
            Inventory & POs
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage stock levels, raise purchase orders, and receive goods.
          </Typography>
        </Box>
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
      </Box>

      <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <Tab label="Current Stock" sx={{ fontWeight: 600 }} />
          <Tab label="Purchase Orders" sx={{ fontWeight: 600 }} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
            <CircularProgress size={48} thickness={4} />
          </Box>
        ) : (
          <Box sx={{ p: 0 }}>
            <Fade in timeout={500}>
              <Box>
                {tabValue === 0 && (
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
                )}

                {tabValue === 1 && (
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
                )}
              </Box>
            </Fade>
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
    </Box>
  );
}
