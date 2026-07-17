import { useState, useEffect } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Grid, Divider } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useParams } from "react-router-dom";

export default function PrintLabReport() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axiosInstance.get(`/lab/orders/${id}`);
        setOrder(res.data.data);
      } catch (err: unknown) {
        // Distinct from "order not found" — a network/permission error isn't
        // the same thing and shouldn't be reported as one.
        setError(getApiErrorMessage(err, "Failed to load this lab order"));
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  useEffect(() => {
    // Automatically trigger print dialog when data is loaded
    if (!loading && order) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, order]);

  if (loading) return <DetailSkeleton />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!order) return <Typography>Order not found</Typography>;

  return (
    <Box sx={{ 
      width: "210mm", 
      minHeight: "297mm", 
      margin: "0 auto", 
      bgcolor: "white", 
      color: "black",
      p: "20mm",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif",
      // CSS to ensure this looks like a page on screen before printing
      "@media screen": {
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        my: 4
      },
      // Hide standard browser UI (URLs, etc) when printing if possible, and ensure no background bleeding
      "@media print": {
        margin: 0,
        padding: "15mm",
        boxShadow: "none",
        width: "100%",
        minHeight: "100vh"
      }
    }}>
      
      {/* Header / Letterhead */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {order.hospital?.logoUrl && (
            <img src={order.hospital.logoUrl} alt="Hospital Logo" style={{ height: "60px", objectFit: "contain" }} />
          )}
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main", m: 0 }}>
              {order.hospital?.hospitalName || "Hospital Name"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {order.hospital?.addressLine1} {order.hospital?.addressLine2 ? `, ${order.hospital.addressLine2}` : ""}
            </Typography>
            {(order.hospital?.officialPhone || order.hospital?.officialEmail) && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {order.hospital?.officialPhone && `Phone: ${order.hospital.officialPhone}`} 
                {order.hospital?.officialPhone && order.hospital?.officialEmail && " | "}
                {order.hospital?.officialEmail && `Email: ${order.hospital.officialEmail}`}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", m: 0, textTransform: "uppercase", letterSpacing: 1 }}>
            Laboratory Report
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            <strong>Date:</strong> {new Date().toLocaleDateString()}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            <strong>Order ID:</strong> {order.sampleBarcode}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3, borderColor: "rgba(0,0,0,0.1)" }} />

      {/* Patient Information Grid */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, width: "100px" }}>Patient Name:</Typography>
              <Typography variant="body2">{order.patient?.firstName} {order.patient?.lastName}</Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, width: "100px" }}>UHID:</Typography>
              <Typography variant="body2">{order.patient?.uhidNumber}</Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, width: "100px" }}>Age/Gender:</Typography>
              <Typography variant="body2">
                {order.patient?.dateOfBirth ? Math.floor((new Date().getTime() - new Date(order.patient.dateOfBirth).getTime()) / 31557600000) : "N/A"} Yrs / 
                {order.patient?.genderId === 1 ? " Male" : order.patient?.genderId === 2 ? " Female" : " Other"}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, width: "120px" }}>Referred By:</Typography>
              <Typography variant="body2">Dr. {order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, width: "120px" }}>Sample Collected:</Typography>
              <Typography variant="body2">
                {order.sampleCollectedAt ? new Date(order.sampleCollectedAt).toLocaleString() : "N/A"}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Test Results Table */}
      <Box sx={{ mb: 6 }}>
        <Table size="small" sx={{ 
          "& .MuiTableCell-root": { borderColor: "rgba(0,0,0,0.1)", py: 1.5 },
          "& .MuiTableHead-root .MuiTableCell-root": { fontWeight: 700, bgcolor: "rgba(0,0,0,0.02)" }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>Investigation</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Reference Range</TableCell>
              <TableCell>Remarks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.reports?.map((report: any) => {
              // Highlight abnormal results (basic check if value is outside numbers)
              // This is a naive check; in a real app, you'd parse ranges carefully.
              // For now, we just bold the result.
              return (
                <TableRow key={report.labReportId}>
                  <TableCell sx={{ fontWeight: 600 }}>{report.labTest?.testName}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{report.resultValue}</TableCell>
                  <TableCell>{report.normalRange}</TableCell>
                  <TableCell sx={{ fontStyle: report.remarks ? "italic" : "normal" }}>
                    {report.remarks || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Footer / Signatures */}
      <Box sx={{ mt: "auto", display: "flex", justifyContent: "flex-end", pt: 6 }}>
        <Box sx={{ textAlign: "center", width: "200px" }}>
          <Box sx={{ borderBottom: "1px solid rgba(0,0,0,0.5)", height: "40px", mb: 1 }}></Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Verified By</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Pathologist / Lab Technician</Typography>
        </Box>
      </Box>
      
      <Box sx={{ textAlign: "center", mt: 6, pt: 2, borderTop: "1px dashed rgba(0,0,0,0.2)" }}>
         <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>*** End of Report ***</Typography>
      </Box>

    </Box>
  );
}
