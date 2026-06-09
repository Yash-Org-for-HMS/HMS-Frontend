import { useState, useEffect, useMemo } from "react";
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, 
  Button, CircularProgress, TextField, IconButton, useTheme, Autocomplete, Divider, alpha,
  List, ListItem, ListItemText, ListItemButton, Chip
} from "@mui/material";
import { PointOfSaleRounded, AddCircleRounded, RemoveCircleRounded, DeleteRounded, PaymentRounded, LocalPharmacyRounded, DownloadRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import PointOfCarePOS from "../../components/billing/PointOfCarePOS";

export default function DispensaryPOS() {
  const theme = useTheme();
  const [medicines, setMedicines] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [medRes, invRes, presRes] = await Promise.all([
        axiosInstance.get("/pharmacy/medicines"),
        axiosInstance.get("/pharmacy/inventory"),
        axiosInstance.get("/pharmacy/prescriptions/pending")
      ]);
      setMedicines(medRes.data.data || []);
      setInventory(invRes.data.data || []);
      setPendingPrescriptions(presRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch data for POS", err);
    } finally {
      setLoading(false);
    }
  };

  // Map inventory to medicines to see what's actually in stock
  const medicineStock = useMemo(() => {
    const stockMap: Record<string, number> = {};
    inventory.forEach(inv => {
      stockMap[inv.medicineId] = (stockMap[inv.medicineId] || 0) + inv.availableQuantity;
    });
    return stockMap;
  }, [inventory]);

  const availableMedicines = useMemo(() => {
    return medicines.map(med => ({
      ...med,
      inStock: medicineStock[med.medicineId] || 0,
      label: `${med.medicineName} (${med.genericName}) - $${parseFloat(med.sellingPrice).toFixed(2)}`
    }));
  }, [medicines, medicineStock]);

  const addToCart = (medicine: any, quantity: number = 1) => {
    if (!medicine) return;
    const existing = cart.find(item => item.medicineId === medicine.medicineId);
    if (existing) {
      if (existing.quantity + quantity > medicine.inStock) {
        alert(`Cannot exceed available stock for ${medicine.medicineName}!`);
        return;
      }
      setCart(cart.map(item => item.medicineId === medicine.medicineId ? { ...item, quantity: item.quantity + quantity } : item));
    } else {
      if (medicine.inStock < quantity) {
        alert(`Not enough stock for ${medicine.medicineName}!`);
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
    // Clear current cart
    setCart([]);
    setSelectedPrescriptionId(prescription.prescriptionId);
    setPatientId(prescription.patientId || "");
    
    // Auto load items
    let missingItems: string[] = [];
    
    prescription.items.forEach((item: any) => {
      const match = availableMedicines.find(m => m.medicineId === item.medicineId || 
        (m.genericName && item.genericName && m.genericName.toLowerCase().includes(item.genericName.toLowerCase())));
      
      if (match) {
        addToCart(match, item.quantity);
      } else {
        missingItems.push(item.medicineName || item.genericName);
      }
    });

    if (missingItems.length > 0) {
      alert(`The following prescribed items were not found in stock or catalog:\n- ${missingItems.join('\n- ')}\n\nPlease add a generic substitute manually.`);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.medicineId === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.inStock) {
          alert("Cannot exceed available stock!");
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
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
    } catch (err) {
      console.error(err);
      alert("Failed to process sale");
    } finally {
      setProcessing(false);
    }
  };

  const handlePOSSuccess = () => {
    alert("Sale completed and paid successfully!");
    setCart([]);
    setPatientId("");
    setSelectedPrescriptionId(null);
    setShowPOS(false);
    fetchData(); // refresh stock and pending prescriptions
  };

  const handlePOSClose = () => {
    // If they cancel payment, the order is still created as UNPAID
    alert("Order created but payment was cancelled. It remains UNPAID.");
    setCart([]);
    setPatientId("");
    setSelectedPrescriptionId(null);
    setShowPOS(false);
    fetchData(); 
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <PointOfSaleRounded fontSize="large" sx={{ color: '#4F46E5' }} />
            Dispensary & POS
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Process sales, auto-load prescriptions, and auto-deduct inventory.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => { setCart([]); setSelectedPrescriptionId(null); setPatientId(""); }}>
          Clear Cart
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr 1fr' }, gap: 4 }}>
          
          {/* Left Column - Prescriptions Queue */}
          <Paper sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', height: 'fit-content', overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight="700" display="flex" alignItems="center" gap={1}>
                <LocalPharmacyRounded color="primary" /> Pending Prescriptions
              </Typography>
            </Box>
            {pendingPrescriptions.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body2">No pending prescriptions</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {pendingPrescriptions.map(p => (
                  <ListItem key={p.prescriptionId} disablePadding divider>
                      <ListItemButton 
                        selected={selectedPrescriptionId === p.prescriptionId}
                        onClick={() => loadPrescription(p)}
                        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 2 }}
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
          </Paper>

          {/* Middle Column - Product Selection & Cart */}
          <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: 'fit-content' }}>
            <Typography variant="h6" fontWeight="700" mb={3}>Cart Items</Typography>
            
            <Autocomplete
              options={availableMedicines}
              getOptionLabel={(option) => option.label}
              onChange={(e, newValue) => {
                addToCart(newValue);
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Box>
                    <Typography variant="body1" fontWeight={600}>{option.medicineName}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.genericName}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" fontWeight={600} color="#10B981">${parseFloat(option.sellingPrice).toFixed(2)}</Typography>
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
              sx={{ mb: 4 }}
              clearOnBlur
            />

            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, align: 'center' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, align: 'right' }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 700, align: 'right' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>Cart is empty</TableCell></TableRow>
                ) : cart.map((item) => (
                  <TableRow key={item.medicineId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{item.medicineName}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.genericName}</Typography>
                    </TableCell>
                    <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" onClick={() => updateQuantity(item.medicineId, -1)}><RemoveCircleRounded fontSize="small" /></IconButton>
                        <Typography fontWeight={600} sx={{ width: 24, textAlign: 'center' }}>{item.quantity}</Typography>
                        <IconButton size="small" onClick={() => updateQuantity(item.medicineId, 1)} color="primary"><AddCircleRounded fontSize="small" /></IconButton>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>${(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => removeFromCart(item.medicineId)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Right Column - Checkout Summary */}
          <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: 'fit-content', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
            <Typography variant="h6" fontWeight="700" mb={3}>Order Summary</Typography>
            
            <TextField 
              label="Patient ID" 
              variant="outlined" 
              fullWidth 
              size="small"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="e.g. PAT-1234"
              helperText={selectedPrescriptionId ? "Auto-filled from prescription" : "Optional for OTC sales"}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography color="text.secondary">Subtotal</Typography>
              <Typography fontWeight={600}>${cartTotal.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography color="text.secondary">Tax (0%)</Typography>
              <Typography fontWeight={600}>$0.00</Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
              <Typography variant="h5" fontWeight={800}>Total</Typography>
              <Typography variant="h5" fontWeight={800} color="#10B981">${cartTotal.toFixed(2)}</Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<PaymentRounded />}
              onClick={handleCheckout}
              disabled={cart.length === 0 || processing}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: cart.length > 0 ? '0 8px 16px -4px rgba(16, 185, 129, 0.4)' : 'none',
              }}
            >
              {processing ? "Processing..." : "Complete Sale"}
            </Button>
          </Paper>
        </Box>
      )}

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
            description: `Pharmacy Sale: ${cart.map(c => c.medicineName).join(', ')}`,
            amount: createdOrder.totalAmount,
            date: createdOrder.createdAt || new Date()
          }}
        />
      )}
    </Box>
  );
}

