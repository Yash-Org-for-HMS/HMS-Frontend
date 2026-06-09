import { useState, useEffect } from "react";
import { Box, Typography, Paper, Grid, TextField, Button, CircularProgress, Alert, Chip, Divider } from "@mui/material";
import { SaveRounded, ArrowBackRounded, ScienceRounded, AccessTimeRounded, PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useParams, useNavigate } from "react-router-dom";
import PointOfCarePOS from "../../components/billing/PointOfCarePOS";

const evaluateCriticalValue = (testCode: string, resultValue: string): boolean => {
  const val = parseFloat(resultValue);
  if (isNaN(val)) return false;

  const code = testCode?.toUpperCase() || "";
  if (code === 'HEMO' || code === 'HB' || code === 'CBC-HB') return val < 7.0 || val > 20.0;
  if (code === 'PLT' || code === 'PLATELETS') return val < 20000 || val > 1000000;
  if (code === 'GLU' || code === 'FBS' || code === 'RBS') return val < 50 || val > 400;
  if (code === 'K' || code === 'POTASSIUM') return val < 2.5 || val > 6.5;
  if (code === 'WBC') return val < 2000 || val > 30000;

  return false;
};

export default function UpdateLabOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [results, setResults] = useState<Record<string, { value: string, range: string, remarks: string }>>({});
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/lab/orders/${id}`);
      const data = res.data.data;
      setOrder(data);
      
      const initialResults: any = {};
      data.reports.forEach((r: any) => {
        initialResults[r.labReportId] = {
          value: r.resultValue === "PENDING" ? "" : r.resultValue,
          range: r.normalRange === "N/A" ? "" : r.normalRange,
          remarks: r.remarks || "",
        };
      });
      setResults(initialResults);
    } catch (err) {
      console.error("Failed to fetch lab order", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const payload = Object.entries(results).map(([labReportId, data]) => ({
        labReportId,
        resultValue: data.value || "PENDING",
        normalRange: data.range || "N/A",
        remarks: data.remarks || "",
      }));

      await axiosInstance.put(`/lab/orders/${id}/results`, { results: payload });
      setMessage({ type: "success", text: "Lab results updated successfully!" });
      setTimeout(() => fetchOrder(), 1000);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update results." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ display: "flex", p: 4, justifyContent: "center" }}><CircularProgress /></Box>;
  if (!order) return <Typography>Order not found</Typography>;

  return (
    <Box>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/lab/orders")} sx={{ mb: 2 }}>
        Back to Queue
      </Button>
      
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Update Lab Order: {order.sampleBarcode}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Chip label={order.paymentStatus === "PAID" ? "PAID" : "UNPAID"} color={order.paymentStatus === "PAID" ? "success" : "error"} />
          {order.paymentStatus !== "PAID" && (
            <Button size="small" variant="outlined" color="success" onClick={() => setShowPOS(true)}>
              Collect Payment (Cash)
            </Button>
          )}
          <Chip label={order.status || "PENDING"} color={order.status === "COMPLETED" ? "success" : "warning"} />
          {order.status === "COMPLETED" && (
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<PrintRounded />} 
              onClick={() => window.open(`/lab/orders/${id}/print`, '_blank')}
            >
              Print Report
            </Button>
          )}
        </Box>
      </Box>

      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Patient Information</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Name</Typography>
            <Typography variant="body1">{order.patient?.firstName} {order.patient?.lastName}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">UHID</Typography>
            <Typography variant="body1">{order.patient?.uhidNumber}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Referring Doctor</Typography>
            <Typography variant="body1">{order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <ScienceRounded fontSize="small" /> Sample Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Barcode</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{order.sampleBarcode}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Collection Status</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip 
                label={order.sampleCollectedAt ? "Collected" : "Not Collected"} 
                color={order.sampleCollectedAt ? "success" : "default"} 
                size="small" 
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Collected At</Typography>
            <Typography variant="body1" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <AccessTimeRounded fontSize="small" color="disabled" />
              {order.sampleCollectedAt ? new Date(order.sampleCollectedAt).toLocaleString() : "N/A"}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Test Results</Typography>

        {order.billingLockActive && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Billing Lock Active: The invoice for these tests has not been paid. Processing is disabled.
          </Alert>
        )}
        {order.status === "PENDING" && !order.sampleCollectedAt && !order.billingLockActive && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Sample collection is pending. You cannot enter test results until the sample is collected and verified.
          </Alert>
        )}
        {order.reports?.map((report: any) => {
          const val = results[report.labReportId]?.value || "";
          const isCriticalNow = evaluateCriticalValue(report.labTest?.testCode || "", val);
          
          return (
          <Box key={report.labReportId} sx={{ 
            p: 2, mb: 2, 
            border: "2px solid", 
            borderColor: isCriticalNow ? "error.main" : "divider", 
            borderRadius: 2, 
            bgcolor: isCriticalNow ? "error.50" : "transparent",
            transition: "all 0.3s"
          }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isCriticalNow ? "error.main" : "text.primary" }}>
                {report.labTest?.testName} ({report.labTest?.testCode})
              </Typography>
              {isCriticalNow && (
                <Chip label="CRITICAL PANIC VALUE" color="error" size="small" sx={{ animation: "pulse 1.5s infinite" }} />
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth label="Result Value" size="small"
                  value={results[report.labReportId]?.value || ""}
                  onChange={(e) => setResults({...results, [report.labReportId]: {...results[report.labReportId], value: e.target.value}})}
                  disabled={order.billingLockActive || (order.status === "PENDING" && !order.sampleCollectedAt)}
                  error={isCriticalNow}
                  helperText={isCriticalNow ? "Immediate doctor notification will be sent upon saving." : ""}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth label="Normal Range" size="small"
                  value={results[report.labReportId]?.range || ""}
                  onChange={(e) => setResults({...results, [report.labReportId]: {...results[report.labReportId], range: e.target.value}})}
                  disabled={order.billingLockActive || (order.status === "PENDING" && !order.sampleCollectedAt)}
                />
              </Grid>
                  <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth label="Remarks" size="small"
                  value={results[report.labReportId]?.remarks || ""}
                  onChange={(e) => setResults({...results, [report.labReportId]: {...results[report.labReportId], remarks: e.target.value}})}
                  disabled={order.billingLockActive || (order.status === "PENDING" && !order.sampleCollectedAt)}
                />
              </Grid>
            </Grid>
          </Box>
        )})}
        
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button 
            variant="contained" 
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />} 
            onClick={handleSave}
            disabled={saving || order.billingLockActive || (order.status === "PENDING" && !order.sampleCollectedAt)}
          >
            Save Results
          </Button>
        </Box>
      </Paper>

      {showPOS && (
        <PointOfCarePOS
          open={showPOS}
          onClose={() => setShowPOS(false)}
          onSuccess={() => {
            setShowPOS(false);
            fetchOrder();
          }}
          patientId={order.patientId}
          patientName={`${order.patient?.firstName || ''} ${order.patient?.lastName || ''}`}
          item={{
            id: order.labOrderId,
            type: "LAB",
            description: `Lab Tests: ${order.reports?.map((r: any) => r.labTest?.testName).filter(Boolean).join(', ') || 'Pending Tests'}`,
            amount: order.reports?.reduce((sum: number, r: any) => sum + Number(r.labTest?.price || 0), 0) || 300,
            date: order.createdAt
          }}
        />
      )}
    </Box>
  );
}
