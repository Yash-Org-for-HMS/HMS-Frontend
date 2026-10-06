import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip,
} from "@mui/material";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";
import { useRoleHome } from "./useRoleHome";
import Freshness from "./Freshness";

/**
 * The ward round — a resident's home (15_System_Roles DOCTOR_RESIDENT: "notes,
 * orders (co-sign), ward rounds"). The patients in hospital under their
 * department: admitted under one of its consultants, or in a ward it owns.
 * Longest stay first, with what needs a look flagged.
 */

interface RoundPatient {
  admissionId: string;
  patientId: string | null;
  admissionNumber: string | null;
  patientName: string;
  uhid: string;
  bed: string | null;
  consultant: string | null;
  days: number | null;
  overdueDoses: number;
  dischargeStarted: boolean;
}

export default function WardRound() {
  const navigate = useNavigate();
  const q = useRoleHome<{ department: string | null; patients: RoundPatient[] }>("ward-round");
  const patients = q.data?.patients ?? [];

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Ward round"
        subtitle={q.data?.department ? `Patients in hospital under ${q.data.department}.` : "Patients in hospital."}
        actions={<Freshness updatedAt={q.dataUpdatedAt} fetching={q.isFetching} onRefresh={() => q.refetch()} />}
      />
      {q.isError ? (
        <ErrorState title="Couldn't load the round" message={apiErrorText(q.error)} onRetry={() => q.refetch()} />
      ) : !q.isLoading && !patients.length ? (
        <Paper sx={{ p: 3 }}><Mascot pose="all-caught-up" title="No patient in hospital under your department" /></Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Bed</TableCell>
                <TableCell>Consultant</TableCell>
                <TableCell align="right">Day</TableCell>
                <TableCell>Needs a look</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={5} columns={5} /> : patients.map((p) => (
                <TableRow key={p.admissionId} hover sx={{ cursor: p.patientId ? "pointer" : "default" }}
                  onClick={() => { if (p.patientId) navigate(`/doctor/patients/${p.patientId}`); }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.uhid}{p.admissionNumber ? ` · ${p.admissionNumber}` : ""}</Typography>
                  </TableCell>
                  <TableCell>{p.bed ?? "Awaiting a bed"}</TableCell>
                  <TableCell>{p.consultant ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{p.days != null ? p.days + 1 : "—"}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {p.overdueDoses > 0 && <Chip size="small" label={`${p.overdueDoses} dose${p.overdueDoses === 1 ? "" : "s"} overdue`} sx={{ bgcolor: `${SEMANTIC.danger}1f`, color: SEMANTIC.danger, fontWeight: 700 }} />}
                      {p.dischargeStarted && <Chip size="small" label="Discharge started" sx={{ bgcolor: `${SEMANTIC.warning}22`, color: SEMANTIC.warningDark, fontWeight: 700 }} />}
                      {!p.overdueDoses && !p.dischargeStarted && <Typography variant="body2" sx={{ color: "text.disabled" }}>—</Typography>}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
