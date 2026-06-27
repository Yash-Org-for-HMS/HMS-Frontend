import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, IconButton, useTheme, Autocomplete, Divider, alpha,
  List, ListItem, ListItemButton, Chip, Pagination, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Tooltip, Alert
} from "@mui/material";
import { PointOfSaleRounded, AddCircleRounded, RemoveCircleRounded, DeleteRounded, PaymentRounded, LocalPharmacyRounded, DownloadRounded, EditRounded, CancelRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PointOfCarePOS from "../../components/billing/PointOfCarePOS";
import { useSocket } from "../../hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import PharmacyPage, { ROWS_PER_PAGE } from "./components/PharmacyPage";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { useHospitalTaxRate } from "../../hooks/useHospitalTaxRate";

export default function DispensaryPOS() {
  const theme = useTheme();
  const location = useLocation();
  const toast = useToast();
  const confirm = useConfirm();
  // A pharmacy sale is stamped to one branch. Org admins viewing "All branches"
  // (consolidated) have no active branch, so the backend rejects the sale — guide
  // them to pick a concrete branch here instead of failing at checkout.
  const { activeBranchId, availableBranches, setActiveBranch } = useHospitalAuth();
  const taxRate = useHospitalTaxRate();
  const { data, isLoading: loading, refetch: fetchData } = useQuery({
    queryKey: ["dispensary-pos-data"],
    queryFn: async () => {
      const ts = Date.now();
      const [medRes, invRes, presRes, salesRes] = await Promise.all([
        axiosInstance.get(`/pharmacy/medicines?t=${ts}`),
        axiosInstance.get(`/pharmacy/inventory?t=${ts}`),
        axiosInstance.get(`/pharmacy/prescriptions/pending?t=${ts}`),
        axiosInstance.get(`/pharmacy/orders?t=${ts}`)
      ]);
      return {
        medicines: medRes.data.data || [],
        inventory: invRes.data.data || [],
        pendingPrescriptions: presRes.data.data || [],
        sales: salesRes.data.data || []
      };
    },
    refetchInterval: 30000,
  });

  const medicines = data?.medicines || [];
  const inventory = data?.inventory || [];
  const pendingPrescriptions = data?.pendingPrescriptions || [];
  const sales = data?.sales || [];

  // Cart state
  const [cart, setCart] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  
  // Pagination for Today's Orders
  const [page, setPage] = useState(1);
  const itemsPerPage = ROWS_PER_PAGE;

  const todaysOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales.filter((s: any) => new Date(s.createdAt) >= today);
  }, [sales]);

  const pageCount = Math.ceil(todaysOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return todaysOrders.slice(start, start + itemsPerPage);
  }, [todaysOrders, page]);

  // Cancellation State
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<any>(null);
  const [cancelReasonType, setCancelReasonType] = useState("Out of stock");
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Dismiss Prescription State
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [prescriptionToDismiss, setPrescriptionToDismiss] = useState<any>(null);
  const [dismissReasonType, setDismissReasonType] = useState("Patient no-show");
  const [dismissReasonText, setDismissReasonText] = useState("");
  const [dismissing, setDismissing] = useState(false);

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: () => fetchData(),
    connect: () => fetchData(), // Refetch on socket reconnect
  });

  // Map inventory to medicines to see what's actually in stock
  const medicineStock = useMemo(() => {
    const stockMap: Record<string, number> = {};
    inventory.forEach((inv: any) => {
      stockMap[inv.medicineId] = (stockMap[inv.medicineId] || 0) + inv.availableQuantity;
    });
    return stockMap;
  }, [inventory]);

  const availableMedicines = useMemo(() => {
    return medicines.map((med: any) => ({
      ...med,
      inStock: medicineStock[med.medicineId] || 0,
      label: `${med.medicineName} (${med.genericName}) - ₹${parseFloat(med.sellingPrice).toFixed(2)}`
    }));
  }, [medicines, medicineStock]);

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    const finalReason = cancelReasonType === "Other" ? cancelReasonText : cancelReasonType;
    if (!finalReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      setCancelling(true);
      await axiosInstance.put(`/pharmacy/orders/${orderToCancel.pharmacyOrderId}/cancel`, { reason: finalReason });
      setCancelDialogOpen(false);
      setOrderToCancel(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error((err as any)?.response?.data?.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const handleDismissPrescription = async () => {
    if (!prescriptionToDismiss) return;
    const finalReason = dismissReasonType === "Other" ? dismissReasonText : dismissReasonType;
    if (!finalReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      setDismissing(true);
      await axiosInstance.put(`/pharmacy/prescriptions/${prescriptionToDismiss.prescriptionId}/status`, { 
        status: 'cancelled',
        reason: finalReason
      });
      setDismissDialogOpen(false);
      setPrescriptionToDismiss(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error((err as any)?.response?.data?.message || "Failed to dismiss prescription");
    } finally {
      setDismissing(false);
    }
  };

  const handleEditOrder = async (order: any) => {
    const ok = await confirm({
      title: "Edit order",
      message: "Editing an order will cancel it and create a new one in the POS. Proceed?",
      confirmText: "Proceed",
    });
    if (ok) {
      try {
        setCancelling(true);
        await axiosInstance.put(`/pharmacy/orders/${order.pharmacyOrderId}/cancel`, { reason: "Editing Order" });
        
        // Load items into cart
        const initialCart: any[] = [];
        order.items.forEach((item: any) => {
          const match = availableMedicines.find((m: any) => m.medicineId === item.medicineId);
          if (match) {
            initialCart.push({
              ...match,
              quantity: item.quantity,
              unitPrice: item.unitPrice || parseFloat(match.sellingPrice),
            });
          }
        });
        setCart(initialCart);
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to cancel order for editing");
      } finally {
        setCancelling(false);
        fetchData();
      }
    }
  };

  useEffect(() => {
    if (location.state?.editItems && availableMedicines.length > 0 && cart.length === 0) {
      const editItems = location.state.editItems;
      const initialCart: any[] = [];
      let missingItems: string[] = [];
      
      editItems.forEach((item: any) => {
        const match = availableMedicines.find((m: any) => m.medicineId === item.medicineId);
        if (match) {
          initialCart.push({
            ...match,
            quantity: item.quantity,
            unitPrice: item.unitPrice || parseFloat(match.sellingPrice),
          });
        } else {
          missingItems.push(item.medicineId);
        }
      });
      
      setCart(initialCart);
      
      if (missingItems.length > 0) {
        toast.warning(`Some items from the edited order were not found: ${missingItems.join(', ')}`);
      }
      
      // Clear state so it doesn't trigger again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [availableMedicines, location.state]);

  const addToCart = (medicine: any, quantity: number = 1) => {
    if (!medicine) return;
    if (medicine.inStock <= 0) {
      toast.error("Item is out of stock!");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }
    const existing = cart.find(item => item.medicineId === medicine.medicineId);
    if (existing) {
      if (existing.quantity + quantity > medicine.inStock) {
        toast.error(`Cannot exceed available stock for ${medicine.medicineName}!`);
        return;
      }
      setCart(cart.map(item => item.medicineId === medicine.medicineId ? { ...item, quantity: item.quantity + quantity } : item));
    } else {
      if (medicine.inStock < quantity) {
        toast.error(`Not enough stock for ${medicine.medicineName}!`);
        return;
      }
      setCart(prev => [...prev, { 
        ...medicine, 
        quantity: quantity, 
        unitPrice: parseFloat(medicine.sellingPrice) 
      }]);
    }
  };

  const loadPrescription = (prescription: any) => {
    setSelectedPrescriptionId(prescription.prescriptionId);
    setPatientId(prescription.patientId || "");
    
    const newCart: any[] = [];
    let missingItems: string[] = [];
    
    prescription.items.forEach((item: any) => {
      const match = availableMedicines.find((m: any) => m.medicineId === item.medicineId || 
        (m.genericName && item.genericName && m.genericName.toLowerCase().includes(item.genericName.toLowerCase())));
      
      if (match) {
        if (match.inStock < item.quantity) {
          toast.error(`Not enough stock for ${match.medicineName}! Available: ${match.inStock}`);
        } else {
          newCart.push({
            ...match,
            quantity: item.quantity,
            unitPrice: parseFloat(match.sellingPrice)
          });
        }
      } else {
        missingItems.push(item.medicineName || item.genericName);
      }
    });

    setCart(newCart);

    if (missingItems.length > 0) {
      toast.warning(`Some prescribed items were not found in stock/catalog: ${missingItems.join(', ')}. Add a generic substitute manually.`);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.medicineId === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.inStock) {
          toast.error("Cannot exceed available stock!");
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.medicineId !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  // GST preview so the cart total matches what the payment dialog actually collects.
  const cartTax = cartTotal * (taxRate / 100);
  const cartGrandTotal = cartTotal + cartTax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!activeBranchId) {
      toast.error("Select a branch before processing a sale.");
      return;
    }
    try {
      setProcessing(true);
      const payload = {
        patientId: patientId || null,
        prescriptionId: selectedPrescriptionId,
        totalAmount: cartTotal,
        items: cart.map(item => ({
          medicineId: item.medicineId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };
      const res = await axiosInstance.post("/pharmacy/orders", payload);
      setCreatedOrder(res.data.data);
      setShowPOS(true);
    } catch (err: any) {
      console.error(err);
      // Surface the real backend reason (e.g. "Select a branch before performing
      // this action", "Insufficient stock to complete this sale.") instead of a
      // generic message that hides what actually went wrong.
      toast.error(err.response?.data?.message || "Failed to process sale");
    } finally {
      setProcessing(false);
    }
  };

  const handlePOSSuccess = () => {
    toast.success("Sale completed and paid successfully!");
    setCart([]);
    setPatientId("");
    setSelectedPrescriptionId(null);
    setShowPOS(false);
    fetchData(); // refresh stock and pending prescriptions
  };

  const handlePOSClose = async () => {
    // If they cancel payment, we should automatically cancel the order to return stock
    try {
      if (createdOrder) {
        await axiosInstance.put(`/pharmacy/orders/${createdOrder.pharmacyOrderId}/cancel`, { reason: "Payment aborted" });
        toast.info("Payment cancelled. The draft order was automatically removed and inventory restored.");
      }
    } catch (err) {
      console.error(err);
      toast.warning("Payment cancelled, but failed to automatically remove the order. You may need to cancel it from Order History.");
    }
    
    setCart([]);
    setPatientId("");
    setSelectedPrescriptionId(null);
    setShowPOS(false);
    fetchData(); 
  };

  return (
    <PharmacyPage
      title="Dispensary & POS"
      subtitle="Process sales, auto-load prescriptions, and auto-deduct inventory."
      icon={<PointOfSaleRounded fontSize="large" sx={{ color: '#4F46E5' }} />}
      action={
        <Button variant="outlined" onClick={() => { setCart([]); setSelectedPrescriptionId(null); setPatientId(""); }}>
          Clear Cart
        </Button>
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
          <HeartbeatLoader size={48} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* Branch required: a sale must be recorded against a specific branch.
              Shown when operating in consolidated / no-branch mode. */}
          {!activeBranchId && (
            <Alert
              severity="warning"
              action={
                availableBranches.length > 0 ? (
                  <Select
                    size="small"
                    displayEmpty
                    value=""
                    onChange={(e) => {
                      setActiveBranch(e.target.value);
                      // Reload so every query re-runs scoped to the chosen branch.
                      window.location.reload();
                    }}
                    sx={{ minWidth: 200, bgcolor: 'background.paper' }}
                  >
                    <MenuItem value="" disabled>Select a branch…</MenuItem>
                    {availableBranches.map((b) => (
                      <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>
                    ))}
                  </Select>
                ) : undefined
              }
            >
              Select a branch to process sales. Pharmacy sales are recorded against a specific branch and can't be created in the consolidated "All branches" view.
            </Alert>
          )}

          {/* Top Row: Prescriptions + POS Area */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '300px minmax(0, 1fr)' }, gap: 4 }}>
            
            {/* Top Left: Prescriptions Queue */}
            <Paper sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '650px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, minWidth: 0 }}>
                <Typography variant="h6" fontWeight="700" display="flex" alignItems="center" gap={1}>
                  <LocalPharmacyRounded color="primary" /> Pending Prescriptions
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
                {pendingPrescriptions.length === 0 ? (
                  <Box sx={{ p: 2 }}>
                    <Mascot pose="nothing-here-yet" subtitle="No pending prescriptions." size={110} />
                  </Box>
                ) : (
                  <List disablePadding>
                    {pendingPrescriptions.map((p: any) => (
                      <ListItem 
                        key={p.prescriptionId} 
                        disablePadding 
                        divider
                        secondaryAction={
                          <Tooltip title="Dismiss Prescription">
                            <IconButton 
                              edge="end" 
                              size="small" 
                              color="error" 
                              onClick={async (e) => {
                                e.stopPropagation();
                                setPrescriptionToDismiss(p);
                                setDismissReasonType("Patient no-show");
                                setDismissReasonText("");
                                setDismissDialogOpen(true);
                              }}
                            >
                              <CancelRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                          <ListItemButton 
                            selected={selectedPrescriptionId === p.prescriptionId}
                            onClick={() => loadPrescription(p)}
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 2, pr: 6 }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                              <Typography fontWeight="700" variant="body2">{p.patientName || p.patientId || "Unknown Patient"}</Typography>
                              <Chip size="small" label={`${p.items.length} items`} color="primary" variant="outlined" />
                            </Box>
                            {p.uhidNumber && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                                UHID: {p.uhidNumber}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Date: {new Date(p.prescriptionDate).toLocaleDateString()}
                            </Typography>
                            <Button size="small" startIcon={<DownloadRounded />} sx={{ mt: 1, textTransform: 'none' }}>
                              Load to POS
                            </Button>
                          </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Paper>

            {/* Top Right: POS Workspace (Merged Cart + Checkout) */}
            <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '650px', minWidth: 0 }}>
              <Typography variant="h6" fontWeight="700" mb={3} flexShrink={0}>Cart Items</Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 4, flexDirection: { xs: 'column', md: 'row' }, flexShrink: 0 }}>
                <Autocomplete
                  options={availableMedicines}
                  getOptionLabel={(option: any) => option.label}
                  onChange={(e, newValue) => addToCart(newValue)}
                  renderOption={(props, option: any) => (
                    <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body1" fontWeight={600}>{option.medicineName}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.genericName}</Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="body2" fontWeight={600} color="#10B981">₹{parseFloat(option.sellingPrice).toFixed(2)}</Typography>
                        <Typography variant="caption" color={option.inStock > 0 ? "text.secondary" : "error"}>
                          Stock: {option.inStock}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Search Medicine (Manual Add)..." 
                      variant="outlined" 
                      fullWidth 
                      size="small"
                    />
                  )}
                  sx={{ flexGrow: 1 }}
                  clearOnBlur
                />
                
                <TextField 
                  label="Patient ID" 
                  variant="outlined" 
                  size="small"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  sx={{ width: { xs: '100%', md: '250px' } }}
                  placeholder="e.g. PAT-1234"
                  helperText={selectedPrescriptionId ? "Auto-filled" : "Optional"}
                />
              </Box>

              <Box sx={{ flexGrow: 1, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3, minHeight: 0, minWidth: 0 }}>
                <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '40%', fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>Item</TableCell>
                      <TableCell sx={{ width: '15%', fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>Price</TableCell>
                      <TableCell sx={{ width: '20%', fontWeight: 700, align: 'center', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>Qty</TableCell>
                      <TableCell sx={{ width: '15%', fontWeight: 700, align: 'right', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>Total</TableCell>
                      <TableCell sx={{ width: '10%', fontWeight: 700, align: 'right', bgcolor: alpha(theme.palette.primary.main, 0.04) }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow><TableCell colSpan={5} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="Cart is empty — add items or load a prescription." size={110} /></TableCell></TableRow>
                    ) : cart.map((item) => (
                      <TableRow key={item.medicineId}>
                        <TableCell>
                          <Typography variant="body1" fontWeight={700} color="text.primary">{item.medicineName}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.genericName}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>₹{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => updateQuantity(item.medicineId, -1)}><RemoveCircleRounded fontSize="small" /></IconButton>
                            <Typography fontWeight={700} sx={{ width: 28, textAlign: 'center', fontSize: '1.1rem' }}>{item.quantity}</Typography>
                            <IconButton size="small" onClick={() => updateQuantity(item.medicineId, 1)} color="primary"><AddCircleRounded fontSize="small" /></IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: "#10B981", fontSize: '1.1rem' }}>₹{(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => removeFromCart(item.medicineId)}>
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {/* Merged Checkout Footer */}
              <Box sx={{ flexShrink: 0, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.02), borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>
                    Subtotal: ₹{cartTotal.toFixed(2)} | Tax ({taxRate}%): ₹{cartTax.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="h5" fontWeight={800}>Total:</Typography>
                    <Typography variant="h4" fontWeight={800} color="#10B981">₹{cartGrandTotal.toFixed(2)}</Typography>
                  </Box>
                </Box>
                
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PaymentRounded />}
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || processing || !activeBranchId}
                  sx={{
                    px: { xs: 4, md: 6 },
                    py: 1.5,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    boxShadow: cart.length > 0 ? '0 8px 16px -4px rgba(16, 185, 129, 0.4)' : 'none',
                    minWidth: { xs: '100%', md: '250px' }
                  }}
                >
                  {processing ? "Processing..." : "Complete Sale"}
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* Bottom Row: Today's Orders (Horizontal Wide Table Format) */}
          <Paper sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight="700" display="flex" alignItems="center" gap={1}>
                <PointOfSaleRounded color="success" /> Today's Orders
              </Typography>
              {pageCount > 1 && (
                <Pagination count={pageCount} page={page} onChange={(e, v) => setPage(v)} size="small" color="primary" />
              )}
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Order ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todaysOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="No orders today." size={110} /></TableCell></TableRow>
                  ) : paginatedOrders.map((sale: any) => (
                    <TableRow key={sale.pharmacyOrderId} sx={{ opacity: sale.status === 'cancelled' ? 0.6 : 1 }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {sale.pharmacyOrderId.split('-')[0].toUpperCase()}
                      </TableCell>
                      <TableCell>{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell>
                        {sale.status === 'cancelled' ? (
                          <Tooltip title={sale.cancellationReason || "Cancelled"}>
                            <Chip size="small" label="Cancelled" color="error" variant="outlined" />
                          </Tooltip>
                        ) : sale.status === 'completed' ? (
                          <Chip size="small" label="Completed" color="success" variant="outlined" />
                        ) : (
                          <Tooltip title="Draft sale — payment not yet collected">
                            <Chip size="small" label="Unpaid" color="warning" variant="outlined" />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#10B981' }}>
                        ₹{parseFloat(sale.totalAmount).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        {sale.status !== 'cancelled' && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Button size="small" variant="outlined" color="primary" onClick={() => handleEditOrder(sale)}>Edit</Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => {
                              setOrderToCancel(sale);
                              setCancelReasonType("Out of stock");
                              setCancelDialogOpen(true);
                            }}>Cancel</Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Cancellation Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => !cancelling && setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Order</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Cancelling this order will restore the deducted inventory and mark the order as cancelled.
          </Typography>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Reason for cancellation</Typography>
            <Select
              fullWidth
              size="small"
              value={cancelReasonType}
              onChange={(e) => setCancelReasonType(e.target.value)}
            >
              <MenuItem value="Out of stock">Out of stock</MenuItem>
              <MenuItem value="Data entry error">Data entry error</MenuItem>
              <MenuItem value="Patient refused">Patient refused</MenuItem>
              <MenuItem value="Other">Other (Specify)</MenuItem>
            </Select>
          </Box>

          {cancelReasonType === "Other" && (
            <TextField
              fullWidth
              size="small"
              label="Specify Reason"
              value={cancelReasonText}
              onChange={(e) => setCancelReasonText(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>Close</Button>
          <Button onClick={handleCancelOrder} variant="contained" color="error" disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dismiss Prescription Dialog */}
      <Dialog open={dismissDialogOpen} onClose={() => !dismissing && setDismissDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dismiss Pending Prescription</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Dismissing this prescription will remove it from the pending queue permanently.
          </Typography>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Reason for dismissal</Typography>
            <Select
              fullWidth
              size="small"
              value={dismissReasonType}
              onChange={(e) => setDismissReasonType(e.target.value)}
            >
              <MenuItem value="Patient no-show">Patient no-show</MenuItem>
              <MenuItem value="Patient refused purchase">Patient refused purchase</MenuItem>
              <MenuItem value="Sent to different pharmacy">Sent to different pharmacy</MenuItem>
              <MenuItem value="Other">Other (Specify)</MenuItem>
            </Select>
          </Box>

          {dismissReasonType === "Other" && (
            <TextField
              fullWidth
              size="small"
              label="Specify Reason"
              value={dismissReasonText}
              onChange={(e) => setDismissReasonText(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDismissDialogOpen(false)} disabled={dismissing}>Close</Button>
          <Button onClick={handleDismissPrescription} variant="contained" color="error" disabled={dismissing}>
            {dismissing ? "Dismissing..." : "Dismiss Prescription"}
          </Button>
        </DialogActions>
      </Dialog>

      {showPOS && createdOrder && (
        <PointOfCarePOS
          open={showPOS}
          onClose={handlePOSClose}
          onSuccess={handlePOSSuccess}
          patientId={createdOrder.patientId || patientId || "Walk-in"}
          patientName={patientId ? `Patient ID: ${patientId}` : "Walk-in Patient"}
          item={{
            id: createdOrder.pharmacyOrderId,
            type: "PHARMACY",
            description: `Pharmacy Sale: ${cart.map((c: any) => c.medicineName).join(', ')}`,
            amount: createdOrder.totalAmount,
            date: createdOrder.createdAt || new Date()
          }}
        />
      )}
    </PharmacyPage>
  );
}
