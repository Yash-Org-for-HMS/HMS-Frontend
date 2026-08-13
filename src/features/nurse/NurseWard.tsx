import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Button, TextField, InputAdornment, Dialog, DialogTitle, DialogContent, Typography, Stack,
} from "@mui/material";
import { SearchRounded, MedicationRounded, MedicalServicesRounded, DescriptionRounded, MonitorHeartRounded, WaterDropRounded, SwapHorizRounded, AssignmentRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import MarChart from "@/components/ipd/MarChart";
import IpdDoctorVisitsDialog from "@/components/ipd/IpdDoctorVisitsDialog";
import NursingNotesDialog from "@/components/ipd/NursingNotesDialog";
import ObservationChartDialog from "@/components/ipd/ObservationChartDialog";
import FluidBalanceDialog from "@/components/ipd/FluidBalanceDialog";
import HandoverDialog from "@/components/ipd/HandoverDialog";
import { apiErrorText } from "@/utils/apiError";

// Nurse ward view: current in-patients + their medication chart (MAR).
export default function NurseWard() {
  const [search, setSearch] = useState("");
  const [chartFor, setChartFor] = useState<any>(null);
  const [visitsFor, setVisitsFor] = useState<any>(null);
  const [notesFor, setNotesFor] = useState<any>(null);
  const [obsFor, setObsFor] = useState<any>(null);
  const [fluidFor, setFluidFor] = useState<any>(null);
  const [handoverFor, setHandoverFor] = useState<any>(null);
  const navigate = useNavigate();

  const { data: admissions = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["nurse-ward-admissions"],
    queryFn: async () => (await axiosInstance.get("/ipd/admissions", { params: { status: "ADMITTED" } })).data.data,
  });

  const s = search.trim().toLowerCase();
  const filtered = s ? admissions.filter((a) => [a.patientName, a.uhid, a.bed?.label].filter(Boolean).some((v: string) => v.toLowerCase().includes(s))) : admissions;

  return (
    <Box>
      <PageHeader title="Ward" subtitle="Current in-patients and their medication chart" />

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <TextField placeholder="Search patient, UHID, bed…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }} sx={{ minWidth: 300 }} />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Patient", "IPD #", "Bed", "Doctor", ""].map((h, i) => (
                  <TableCell key={h || i} align={i === 4 ? "right" : "left"} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={5} />
              ) : isError ? (
                <TableRow><TableCell colSpan={5}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5}><Box sx={{ py: 4 }}><Mascot pose="all-caught-up" title="No in-patients" subtitle="No active admissions right now." size={120} /></Box></TableCell></TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.admissionId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{a.uhid}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{a.admissionNumber || "—"}</TableCell>
                    <TableCell>{a.bed?.label || "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.doctorName || "—"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" startIcon={<AssignmentRounded />} onClick={() => navigate("/nurse/chart/" + a.admissionId)}
                          sx={{ textTransform: "none" }}>Chart</Button>
                        <Button size="small" variant="outlined" startIcon={<MonitorHeartRounded />} onClick={() => setObsFor(a)}
                          sx={{ textTransform: "none" }}>Observations</Button>
                        <Button size="small" variant="outlined" startIcon={<SwapHorizRounded />} onClick={() => setHandoverFor(a)}
                          sx={{ textTransform: "none", borderColor: "divider" }}>Handover</Button>
                        <Button size="small" variant="outlined" startIcon={<WaterDropRounded />} onClick={() => setFluidFor(a)}
                          sx={{ textTransform: "none", borderColor: "divider" }}>Fluids</Button>
                        <Button size="small" variant="outlined" startIcon={<DescriptionRounded />} onClick={() => setNotesFor(a)}
                          sx={{ textTransform: "none", borderColor: "divider", color: "#0891b2" }}>Nursing notes</Button>
                        <Button size="small" variant="outlined" startIcon={<MedicalServicesRounded />} onClick={() => setVisitsFor(a)}
                          sx={{ textTransform: "none", borderColor: "divider", color: "#0891b2" }}>Doctor visits</Button>
                        <Button size="small" variant="outlined" startIcon={<MedicationRounded />} onClick={() => setChartFor(a)}
                          sx={{ textTransform: "none", borderColor: "divider", color: "#0891b2" }}>Medication chart</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!chartFor} onClose={() => setChartFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MedicationRounded sx={{ color: "#0891b2" }} /> Medication Chart — {chartFor?.patientName}
        </DialogTitle>
        <DialogContent dividers>
          {chartFor && <MarChart admissionId={chartFor.admissionId} />}
        </DialogContent>
      </Dialog>

      {visitsFor && <IpdDoctorVisitsDialog open admission={visitsFor} onClose={() => setVisitsFor(null)} />}
      {notesFor && <NursingNotesDialog open admission={notesFor} onClose={() => setNotesFor(null)} />}
      {obsFor && <ObservationChartDialog open admission={obsFor} onClose={() => setObsFor(null)} />}
      {fluidFor && <FluidBalanceDialog open admission={fluidFor} onClose={() => setFluidFor(null)} />}
      {handoverFor && <HandoverDialog open admission={handoverFor} onClose={() => setHandoverFor(null)} />}
    </Box>
  );
}
