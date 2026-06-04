import { Box, Typography, Paper, Grid, Button } from "@mui/material";
import { ReceiptLongRounded, CalendarTodayRounded, QueueRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

export default function BillingDashboard() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <ReceiptLongRounded sx={{ color: "#06b6d4", fontSize: 32 }} />
          Reception Billing
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Manage patient invoices and collect payments.
        </Typography>
      </Box>

      <Paper sx={{ p: 5, bgcolor: "background.paper", borderRadius: 3, textAlign: "center", border: "1px solid", borderColor: "divider" }}>
        <ReceiptLongRounded sx={{ fontSize: 64, color: "rgba(6, 182, 212, 0.5)", mb: 2 }} />
        <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 600, mb: 2 }}>
          Basic Billing is Active
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 4, maxWidth: 600, mx: "auto" }}>
          In the Basic Reception module, billing and receipt generation are linked directly to patient appointments. 
          To generate an invoice or record a consultation payment, please select a patient from the Appointments List or the Patient Queue.
        </Typography>
        
        <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 600, mx: "auto" }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CalendarTodayRounded />}
              onClick={() => navigate("/reception/appointments")}
              sx={{
                py: 2,
                bgcolor: "rgba(6, 182, 212, 0.1)",
                color: "#06b6d4",
                border: "1px solid", borderColor: "divider",
                "&:hover": { bgcolor: "rgba(6, 182, 212, 0.2)" }
              }}
            >
              Go to Appointments
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<QueueRounded />}
              onClick={() => navigate("/reception/queue")}
              sx={{
                py: 2,
                bgcolor: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                "&:hover": { bgcolor: "rgba(16, 185, 129, 0.2)" }
              }}
            >
              Go to Patient Queue
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
