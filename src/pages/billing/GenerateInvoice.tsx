import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Autocomplete, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Checkbox,
  Button, Divider, Grid, Dialog, DialogTitle, DialogContent, DialogActions, alpha, useTheme
} from "@mui/material";
import { ReceiptLongRounded, PaymentRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import { useHospitalTaxRate } from "../../hooks/useHospitalTaxRate";
import { useToast } from "../../contexts/ToastContext";

export default function GenerateInvoice({ patientId: initialPatientId }: { patientId?: string } = {}) {
  const theme = useTheme();
  const toast = useToast();
  
  // Patient Search
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Billing Items
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Invoice Calculator — tax defaults to the hospital's configured GST rate.
  const [discount, setDiscount] = useState<number | "">("");
  const taxRate = useHospitalTaxRate();
  const [taxPercent, setTaxPercent] = useState<number | "">(0);
  useEffect(() => { setTaxPercent(taxRate); }, [taxRate]);
  
  // Modal State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Debounced patient search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(patientQuery), 500);
    return () => clearTimeout(t);
  }, [patientQuery]);

  // Preselect a patient when launched from "Bill" on a patient row.
  useEffect(() => {
    if (!initialPatientId) return;
    let cancelled = false;
    axiosInstance.get(`/reception/patients/${initialPatientId}`)
      .then((res) => { if (!cancelled && res.data?.data) setSelectedPatient(res.data.data); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [initialPatientId]);

  const { data: patients = [], isFetching: patientLoading } = useQuery<any[]>({
    queryKey: ["patient-search", debouncedQuery],
    queryFn: async () =>
      (await axiosInstance.get("/reception/patients", { params: { search: debouncedQuery } })).data.data || [],
    enabled: debouncedQuery.trim().length >= 2,
  });

  const patientId = selectedPatient?.patientId;
  const {
    data: unbilledData,
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErr,
    refetch: refetchUnbilled,
  } = useQuery<any[]>({
    queryKey: ["unbilled", patientId],
    queryFn: async () => (await axiosInstance.get(`/billing/unbilled/${patientId}`)).data.data || [],
    enabled: !!patientId,
  });
  const unbilledItems: any[] = unbilledData ?? [];

  // Auto-select all charges when a fresh set loads (and clear on patient change).
  useEffect(() => {
    setSelectedItemIds(new Set((unbilledData ?? []).map((i: any) => i.id)));
  }, [unbilledData]);

  const handleToggleItem = (id: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedItemIds(newSelected);
  };

  const selectedItemsList = unbilledItems.filter(i => selectedItemIds.has(i.id));
  const grossAmount = selectedItemsList.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Number(discount || 0);
  const taxableAmount = grossAmount - discountAmount;
  const taxAmount = taxableAmount * (Number(taxPercent || 0) / 100);
  const netAmount = taxableAmount + taxAmount;

  const handleGenerateInvoice = async () => {
    if (!selectedPatient || selectedItemIds.size === 0) return;
    try {
      setIsGenerating(true);
      const payload = {
        selectedItems: selectedItemsList,
        discountAmount,
        taxPercentage: Number(taxPercent || 0)
      };
      const res = await axiosInstance.post(`/billing/invoices/${selectedPatient.patientId}`, payload);
      setGeneratedInvoice(res.data.data);
      setPaymentAmount(netAmount);
      toast.success(`Invoice ${res.data.data?.invoiceNumber || ""} generated`);
    } catch (err) {
      toast.error((err as any)?.response?.data?.message || "Error generating invoice");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!generatedInvoice) return;
    try {
      setIsProcessingPayment(true);
      await axiosInstance.post(`/billing/payments/${generatedInvoice.invoiceId}`, {
        amount: Number(paymentAmount),
        paymentMethod
      });
      toast.success("Payment collected successfully");
      setGeneratedInvoice(null);
      refetchUnbilled();
    } catch (err) {
      toast.error((err as any)?.response?.data?.message || "Payment failed");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2" fontWeight={700} mb={2}>
          Select a patient to bill their pending charges
        </Typography>
        <Autocomplete
          options={patients}
          getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.uhidNumber})`}
          loading={patientLoading}
          value={selectedPatient}
          onInputChange={(e, val) => setPatientQuery(val)}
          onChange={(e, val) => setSelectedPatient(val)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search by Name or UHID"
              variant="outlined"
              fullWidth
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {patientLoading ? <HeartbeatLoader size={22} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Paper>

      {selectedPatient && (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="700">Unbilled Charges</Typography>
              </Box>
              
              {itemsLoading ? (
                <PageLoader />
              ) : itemsError ? (
                <Box sx={{ p: 2 }}>
                  <ErrorState message={(itemsErr as any)?.response?.data?.message} onRetry={() => refetchUnbilled()} />
                </Box>
              ) : unbilledItems.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                  No pending charges found for this patient.
                </Box>
              ) : (
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <Table sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox 
                          checked={selectedItemIds.size === unbilledItems.length && unbilledItems.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedItemIds(new Set(unbilledItems.map(i => i.id)));
                            else setSelectedItemIds(new Set());
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unbilledItems.map((item) => (
                      <TableRow key={item.id} hover selected={selectedItemIds.has(item.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedItemIds.has(item.id)} onChange={() => handleToggleItem(item.id)} />
                        </TableCell>
                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ 
                            px: 1, py: 0.5, borderRadius: 1, fontWeight: 700,
                            bgcolor: item.type === "CONSULTATION" ? "#E0E7FF" : item.type === "PHARMACY" ? "#D1FAE5" : "#FEF3C7",
                            color: item.type === "CONSULTATION" ? "#3730A3" : item.type === "PHARMACY" ? "#065F46" : "#92400E"
                          }}>
                            {item.type}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>₹{item.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', position: 'sticky', top: 24 }}>
              <Typography variant="h6" fontWeight="700" mb={3}>Invoice Summary</Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">Gross Amount</Typography>
                <Typography fontWeight={600}>₹{grossAmount.toFixed(2)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">Discount (₹)</Typography>
                <TextField 
                  size="small" type="number" 
                  value={discount} onChange={e => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                  sx={{ width: 100 }}
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography color="text.secondary">Tax (%)</Typography>
                <TextField 
                  size="small" type="number" 
                  value={taxPercent} onChange={e => setTaxPercent(e.target.value === "" ? "" : Number(e.target.value))}
                  sx={{ width: 100 }}
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Box>

              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">Tax Amount</Typography>
                <Typography fontWeight={600}>₹{taxAmount.toFixed(2)}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, mt: 2 }}>
                <Typography variant="h5" fontWeight={800}>Net Total</Typography>
                <Typography variant="h5" fontWeight={800} color="primary.main">₹{netAmount.toFixed(2)}</Typography>
              </Box>

              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<ReceiptLongRounded />}
                disabled={selectedItemIds.size === 0 || isGenerating}
                onClick={handleGenerateInvoice}
                sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
              >
                {isGenerating ? "Generating..." : "Generate Invoice"}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Payment Modal */}
      <Dialog open={!!generatedInvoice} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleRounded color="success" /> Invoice Created
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Invoice <strong>{generatedInvoice?.invoiceNumber}</strong> has been created successfully. Would you like to collect payment now?
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Amount to Pay (₹)"
              type="number"
              fullWidth
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
              inputProps={{ min: 0, max: netAmount, step: "0.01" }}
              error={Number(paymentAmount || 0) > netAmount + 0.005}
              helperText={Number(paymentAmount || 0) > netAmount + 0.005 ? `Cannot exceed the bill of ₹${netAmount.toFixed(2)}` : undefined}
            />
            <Autocomplete
              options={["Cash", "Credit Card", "Insurance", "Bank Transfer"]}
              value={paymentMethod}
              onChange={(e, val) => setPaymentMethod(val || "Cash")}
              renderInput={(params) => <TextField {...params} label="Payment Method" />}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGeneratedInvoice(null)} color="inherit">
            Pay Later
          </Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleProcessPayment}
            disabled={isProcessingPayment || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > netAmount + 0.005}
            startIcon={<PaymentRounded />}
          >
            {isProcessingPayment ? "Processing..." : "Collect Payment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
