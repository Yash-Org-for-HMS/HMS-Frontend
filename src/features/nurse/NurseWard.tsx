import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Grid, Button, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, Typography, Chip, Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  SearchRounded, MedicationRounded, MedicalServicesRounded, DescriptionRounded,
  MonitorHeartRounded, WaterDropRounded, SwapHorizRounded, AssignmentRounded,
  HotelRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { BRAND, SEMANTIC, NEUTRAL } from "@/styles/accents";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { CardGridSkeleton } from "@/components/TableRowsSkeleton";
import MarChart from "@/components/ipd/MarChart";
import IpdDoctorVisitsDialog from "@/components/ipd/IpdDoctorVisitsDialog";
import NursingNotesDialog from "@/components/ipd/NursingNotesDialog";
import ObservationChartDialog from "@/components/ipd/ObservationChartDialog";
import FluidBalanceDialog from "@/components/ipd/FluidBalanceDialog";
import HandoverDialog from "@/components/ipd/HandoverDialog";
import { apiErrorText } from "@/utils/apiError";

/**
 * The ward, as one card per patient.
 *
 * A table row could not carry seven actions — they were the same weight, the
 * column wrapped, and nothing read as primary. A card gives each patient the
 * room to show every action with its name on it, so nothing is hidden behind a
 * menu, and leaves space for the things a table had nowhere to put: which bed,
 * which consultant, and how long this patient has been in.
 */
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
  const filtered = s
    ? admissions.filter((a) => [a.patientName, a.uhid, a.bed?.label].filter(Boolean).some((v: string) => v.toLowerCase().includes(s)))
    : admissions;

  // Ordered by how often a nurse reaches for them, but all of them visible —
  // the point of the card is that nothing needs hiding.
  const actions = [
    { key: "obs", label: "Observations", icon: <MonitorHeartRounded fontSize="small" />, open: setObsFor, tone: BRAND.action },
    { key: "fluid", label: "Fluids", icon: <WaterDropRounded fontSize="small" />, open: setFluidFor, tone: BRAND.action },
    { key: "meds", label: "Medicines", icon: <MedicationRounded fontSize="small" />, open: setChartFor, tone: BRAND.action },
    { key: "handover", label: "Handover", icon: <SwapHorizRounded fontSize="small" />, open: setHandoverFor, tone: NEUTRAL.muted },
    { key: "notes", label: "Nursing notes", icon: <DescriptionRounded fontSize="small" />, open: setNotesFor, tone: NEUTRAL.muted },
    { key: "visits", label: "Doctor visits", icon: <MedicalServicesRounded fontSize="small" />, open: setVisitsFor, tone: NEUTRAL.muted },
  ];

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader title="Ward" subtitle="Current in-patients — open a chart to record or read the day" />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {isLoading ? "" : `${filtered.length} patient${filtered.length === 1 ? "" : "s"}${s ? " matching" : " in the ward"}`}
        </Typography>
        <TextField
          placeholder="Search patient, UHID, bed…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
          sx={{ minWidth: 300 }}
        />
      </Box>

      {isLoading ? (
        <CardGridSkeleton count={6} height={230} minWidth={330} />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ py: 5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Mascot
            pose="all-caught-up"
            title={s ? "No match" : "No in-patients"}
            subtitle={s ? "No patient matches that search." : "No active admissions right now."}
            size={120}
          />
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((a) => (
            <Grid key={a.admissionId} size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  height: "100%", display: "flex", flexDirection: "column",
                  borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden",
                  transition: "border-color .15s ease",
                  "&:hover": { borderColor: alpha(BRAND.action, 0.5) },
                }}
              >
                {/* Identity first, then where they are and who is looking after
                    them — what a nurse needs to recognise the patient. */}
                <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>
                        {a.patientName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {[a.uhid, a.admissionNumber].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                    {a.days != null && (
                      <Chip
                        size="small" label={`Day ${a.days}`}
                        sx={{ flexShrink: 0, bgcolor: alpha(SEMANTIC.info, 0.12), color: SEMANTIC.info, fontWeight: 700 }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                    {a.bed?.label ? (
                      <Chip
                        size="small" icon={<HotelRounded sx={{ fontSize: 15 }} />} label={a.bed.label}
                        sx={{ bgcolor: alpha(BRAND.action, 0.1), color: BRAND.action, fontWeight: 600 }}
                      />
                    ) : (
                      <Chip size="small" label="No bed assigned" sx={{ bgcolor: alpha(SEMANTIC.warning, 0.12), color: SEMANTIC.warning, fontWeight: 600 }} />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                    {a.doctorName || "No consultant recorded"}
                  </Typography>
                </Box>

                <Divider />

                <Box sx={{ px: 2.5, py: 2, mt: "auto" }}>
                  <Button
                    fullWidth variant="contained" startIcon={<AssignmentRounded />}
                    onClick={() => navigate("/nurse/chart/" + a.admissionId)}
                    sx={{ textTransform: "none", mb: 1.5 }}
                  >
                    Open chart
                  </Button>

                  {/* All six, named. On a card there is room, so nothing has to
                      hide behind a menu. */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                    {actions.map((act) => (
                      <Button
                        key={act.key} size="small" variant="outlined" onClick={() => act.open(a)}
                        sx={{
                          textTransform: "none", px: 0.5, minWidth: 0, borderColor: "divider", color: act.tone,
                          flexDirection: "column", gap: 0.25, py: 0.75, lineHeight: 1.2, fontSize: "0.72rem",
                          "&:hover": { borderColor: act.tone, bgcolor: alpha(act.tone, 0.06) },
                        }}
                      >
                        {act.icon}
                        <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                          {act.label}
                        </Box>
                      </Button>
                    ))}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!chartFor} onClose={() => setChartFor(null)} maxWidth="md" fullWidth>
        <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MedicationRounded sx={{ color: BRAND.action }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Medication chart</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{chartFor?.patientName} · {chartFor?.uhid}</Typography>
          </Box>
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
