import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { MedicalServicesRounded, ReceiptLongRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import { ListSkeleton } from "../TableRowsSkeleton";
import ErrorState from "../ErrorState";
import Mascot from "../Mascot";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";

const ACCENT = ACCENTS.reception;

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: SEMANTIC.warning },
  COMPLETED: { label: "Completed", color: SEMANTIC.success },
  CANCELLED: { label: "Cancelled", color: NEUTRAL.muted },
};

// Read-only surgery history across ALL of the patient's admissions — surgeries
// are added/edited from the IPD Admissions page (SurgeryDialog), scoped to a
// specific admission; this tab is just the patient-wide view of that data.
export default function SurgeriesSection({ patientId }: { patientId: string }) {
  const { data: surgeries = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["patient-surgeries", patientId],
    queryFn: async () => (await axiosInstance.get(`/ipd/patients/${patientId}/surgeries`)).data.data,
  });

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <MedicalServicesRounded sx={{ color: ACCENT }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Surgery History</Typography>
      </Box>

      {surgeries.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <Mascot pose="nothing-here-yet" subtitle="No surgeries on record for this patient." />
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Procedure</TableCell>
                <TableCell>Type / Grade</TableCell>
                <TableCell>Surgeon</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surgeries.map((s) => {
                const sm = STATUS_META[s.status] || STATUS_META.SCHEDULED;
                return (
                  <TableRow key={s.surgeryId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.procedureName}</Typography>
                      {s.notes && <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.notes}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: "block" }}>{s.surgeryType === "MAJOR" ? "Major" : "Minor"}</Typography>
                      {s.gradeName && <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.gradeName}</Typography>}
                    </TableCell>
                    <TableCell>{s.surgeonName || "—"}</TableCell>
                    <TableCell>{s.surgeryDate ? dayjs(s.surgeryDate).format("DD MMM YYYY") : "—"}</TableCell>
                    <TableCell align="right">{s.price ? formatINR(s.price) : "—"}</TableCell>
                    <TableCell>
                      <Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, fontWeight: 700 }} />
                      {s.invoiceNumber && (
                        <Chip icon={<ReceiptLongRounded sx={{ fontSize: 14 }} />} label={`Billed: ${s.invoiceNumber}`} size="small"
                          sx={{ display: "block", mt: 0.5, bgcolor: "rgba(8,145,178,0.12)", color: ACCENT, fontWeight: 700 }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
