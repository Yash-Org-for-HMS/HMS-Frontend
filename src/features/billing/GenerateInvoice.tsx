import { useState, useEffect } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Autocomplete, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Checkbox,
  Button, Divider, Grid, Dialog, DialogTitle, DialogContent, DialogActions, alpha, useTheme
} from "@mui/material";
import { ReceiptLongRounded, PaymentRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import StatusChip from "@/components/StatusChip";
import InvoiceViewDialog from "@/components/reception/InvoiceViewDialog";
import { formatINR, formatDate } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

export default function GenerateInvoice({ patientId: initialPatientId }: { patientId?: string } = {}) {
  const theme = useTheme();
  const toast = useToast();
  
  // Patient Search
  const [patientQuery, setPatientQuery] = useState("");
  const debouncedQuery = useDebouncedValue(patientQuery, 500);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Billing Items
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Invoice Calculator — GST is now computed per line from each charge's rate card
  // (0 = exempt), mirroring the server. No manual flat rate.
  const [discount, setDiscount] = useState<number | "">("");
  
  // Modal State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  // The selected configured payment-method row (has paymentMethodId + methodName).
  const [paymentMethod, setPaymentMethod] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Invoice to view/collect from the patient's history panel.
  const [invoiceView, setInvoiceView] = useState<string | null>(null);


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

  // This patient's existing invoices (paid + pending) — so staff can see what's
  // already billed/outstanding right here, and collect a pending one, instead of
  // accidentally raising a duplicate.
  const { data: billing, refetch: refetchBilling } = useQuery<{ invoices: any[] }>({
    queryKey: ["geninvoice-patient-billing", patientId],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${patientId}/billing-summary`)).data.data,
    enabled: !!patientId,
  });
  const patientInvoices: any[] = billing?.invoices ?? [];
  const outstanding = patientInvoices
    .filter((i) => i.invoiceStatus !== "CANCELLED")
    .reduce((sum, i) => sum + Math.max(0, Number(i.balance) || 0), 0);

  // The hospital's configured payment methods — the SAME list the reception
  // BillingModal / InvoiceViewDialog use — so tender options (and the stored
  // method) are consistent across every billing screen instead of a hardcoded four.
  const { data: paymentMethods = [] } = useQuery<any[]>({
    queryKey: ["billing-payment-methods"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/lookups")).data?.data?.methods || [],
    staleTime: 5 * 60 * 1000,
  });
  // Default the tender to the first configured method once they load.
  useEffect(() => {
    if (paymentMethods.length && !paymentMethod) setPaymentMethod(paymentMethods[0]);
  }, [paymentMethods]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Per-line GST from the rate card (server is authoritative; this only mirrors it
  // for the preview). Tax is on each line's gross; a pharmacy order carries a
  // precomputed taxAmount (per-medicine, mixed rates). The discount reduces net.
  const taxAmount = selectedItemsList.reduce((sum, item) => sum + (item.taxAmount != null ? Number(item.taxAmount) : item.amount * (Number(item.taxPercent || 0) / 100)), 0);
  const netAmount = taxableAmount + taxAmount;
  // Amount the payment dialog collects against. Once the invoice is created the
  // selected items are refetched away (no longer "unbilled"), so the derived
  // netAmount above collapses to 0 — read the created invoice's own net instead.
  const payableNet = generatedInvoice ? Number(generatedInvoice.netAmount || 0) : netAmount;

  const handleGenerateInvoice = async () => {
    if (!selectedPatient || selectedItemIds.size === 0) return;
    try {
      setIsGenerating(true);
      const payload = {
        selectedItems: selectedItemsList,
        discountAmount,
      };
      const res = await axiosInstance.post(`/billing/invoices/${selectedPatient.patientId}`, payload);
      setGeneratedInvoice(res.data.data);
      // Prefill from the created invoice's actual net (the refetch below clears
      // the selected items, so the derived netAmount would otherwise read 0).
      setPaymentAmount(Number(res.data.data?.netAmount ?? netAmount));
      toast.success(`Invoice ${res.data.data?.invoiceNumber || ""} generated`);
      // The billed items are no longer unbilled; the new invoice now shows in the
      // patient's history panel below (whether they pay now or later).
      refetchUnbilled();
      refetchBilling();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error generating invoice"));
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
        paymentMethod: paymentMethod?.methodName || "Cash",
        paymentMethodId: paymentMethod?.paymentMethodId,
      });
      toast.success("Payment collected successfully");
      setGeneratedInvoice(null);
      refetchUnbilled();
      refetchBilling();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Payment failed"));
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
                <ListSkeleton />
              ) : itemsError ? (
                <Box sx={{ p: 2 }}>
                  <ErrorState message={apiErrorText(itemsErr)} onRetry={() => refetchUnbilled()} />
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
                        <TableCell>{formatDate(item.date)}</TableCell>
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

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary">GST (CGST + SGST)</Typography>
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

      {/* This patient's invoices — paid history + pending (collectible here) */}
      {selectedPatient && (
        <Paper elevation={0} sx={{ mt: 3, borderRadius: 3, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h6" fontWeight={700}>This patient's invoices</Typography>
            <Typography variant="body2" sx={{ color: outstanding > 0.005 ? SEMANTIC.danger : "text.secondary", fontWeight: 700 }}>
              Outstanding: {formatINR(outstanding)}
            </Typography>
          </Box>
          {patientInvoices.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>No invoices yet for this patient.</Box>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Table sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Invoice #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Balance</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientInvoices.map((inv) => {
                    const due = Number(inv.balance) > 0.005;
                    return (
                      <TableRow key={inv.invoiceId} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{inv.invoiceNumber}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{formatDate(inv.invoiceDate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(inv.netAmount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: due ? SEMANTIC.danger : SEMANTIC.success }}>
                          {due ? formatINR(inv.balance) : "—"}
                        </TableCell>
                        <TableCell><StatusChip label={inv.statusLabel} color={inv.statusColor} /></TableCell>
                        <TableCell align="right">
                          <Button size="small" variant={due ? "contained" : "text"} onClick={() => setInvoiceView(inv.invoiceId)}
                            sx={{ textTransform: "none", ...(due ? {} : { color: "text.secondary" }) }}>
                            {due ? "Collect" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      )}

      {invoiceView && (
        <InvoiceViewDialog
          open
          invoiceId={invoiceView}
          onClose={() => setInvoiceView(null)}
          onChanged={() => { refetchBilling(); refetchUnbilled(); }}
        />
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
              inputProps={{ min: 0, max: payableNet, step: "0.01" }}
              error={Number(paymentAmount || 0) > payableNet + 0.005}
              helperText={Number(paymentAmount || 0) > payableNet + 0.005 ? `Cannot exceed the bill of ₹${payableNet.toFixed(2)}` : undefined}
            />
            <Autocomplete
              options={paymentMethods}
              getOptionLabel={(m: any) => m?.methodName || ""}
              isOptionEqualToValue={(a: any, b: any) => a?.paymentMethodId === b?.paymentMethodId}
              value={paymentMethod}
              onChange={(e, val) => setPaymentMethod(val)}
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
            disabled={isProcessingPayment || !paymentMethod || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > payableNet + 0.005}
            startIcon={<PaymentRounded />}
          >
            {isProcessingPayment ? "Processing..." : "Collect Payment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
