import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Button, TextField, InputAdornment, Dialog, DialogTitle, DialogContent, Typography,
  IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  SearchRounded, MedicationRounded, MedicalServicesRounded, DescriptionRounded,
  MonitorHeartRounded, WaterDropRounded, SwapHorizRounded, AssignmentRounded,
  MoreVertRounded, HotelRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { BRAND, NEUTRAL } from "@/styles/accents";
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

/**
 * The ward list.
 *
 * Every action used to be a labelled button on the row — seven of them, all the
 * same weight, so nothing read as primary and the column wrapped. They are now
 * ranked by how often a nurse actually reaches for them:
 *
 *   Chart          the hub, and the thing you print → one primary button
 *   Obs / Fluids / Medicines   charted through the shift → one tap each
 *   Handover, notes, visits    once a shift or less     → behind the ⋮
 */
export default function NurseWard() {
  const [search, setSearch] = useState("");
  const [chartFor, setChartFor] = useState<any>(null);
  const [visitsFor, setVisitsFor] = useState<any>(null);
  const [notesFor, setNotesFor] = useState<any>(null);
  const [obsFor, setObsFor] = useState<any>(null);
  const [fluidFor, setFluidFor] = useState<any>(null);
  const [handoverFor, setHandoverFor] = useState<any>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; admission: any } | null>(null);
  const navigate = useNavigate();

  const { data: admissions = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["nurse-ward-admissions"],
    queryFn: async () => (await axiosInstance.get("/ipd/admissions", { params: { status: "ADMITTED" } })).data.data,
  });

  const s = search.trim().toLowerCase();
  const filtered = s
    ? admissions.filter((a) => [a.patientName, a.uhid, a.bed?.label].filter(Boolean).some((v: string) => v.toLowerCase().includes(s)))
    : admissions;

  const closeMenu = () => setMenu(null);
  const fromMenu = (fn: (a: any) => void) => () => { const a = menu?.admission; closeMenu(); if (a) fn(a); };

  /** The three things charted repeatedly through a shift — one tap, not a menu. */
  const quickActions = [
    { key: "obs", label: "Record observations", icon: <MonitorHeartRounded fontSize="small" />, onClick: setObsFor },
    { key: "fluid", label: "Record intake / output", icon: <WaterDropRounded fontSize="small" />, onClick: setFluidFor },
    { key: "meds", label: "Medication chart", icon: <MedicationRounded fontSize="small" />, onClick: setChartFor },
  ];

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader title="Ward" subtitle="Current in-patients — open a chart to record or read the day" />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {isLoading ? "" : `${filtered.length} patient${filtered.length === 1 ? "" : "s"}${s ? " matching" : " in the ward"}`}
        </Typography>
        <TextField
          placeholder="Search patient, UHID, bed…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
          sx={{ minWidth: 300 }}
        />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Bed</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Consultant</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "text.secondary" }}>Chart</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={4} />
              ) : isError ? (
                <TableRow><TableCell colSpan={4}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box sx={{ py: 4 }}>
                      <Mascot pose="all-caught-up" title={s ? "No match" : "No in-patients"} subtitle={s ? "No patient matches that search." : "No active admissions right now."} size={120} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.admissionId} hover>
                    {/* Identity in one block — name, UHID and IPD number belong
                        together, and merging them frees a whole column. */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{a.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {[a.uhid, a.admissionNumber].filter(Boolean).join(" · ")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {a.bed?.label ? (
                        <Chip
                          size="small" icon={<HotelRounded sx={{ fontSize: 15 }} />} label={a.bed.label}
                          sx={{ bgcolor: alpha(BRAND.action, 0.1), color: BRAND.action, fontWeight: 600 }}
                        />
                      ) : <Typography variant="caption" sx={{ color: "text.disabled" }}>No bed</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.doctorName || "—"}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <Button
                          size="small" variant="contained" startIcon={<AssignmentRounded />}
                          onClick={() => navigate("/nurse/chart/" + a.admissionId)}
                          sx={{ textTransform: "none", mr: 0.5, whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          Open chart
                        </Button>

                        {quickActions.map((q) => (
                          <Tooltip key={q.key} title={q.label}>
                            <IconButton
                              size="small" aria-label={q.label} onClick={() => q.onClick(a)}
                              sx={{
                                color: NEUTRAL.muted, border: "1px solid", borderColor: "divider",
                                "&:hover": { color: BRAND.action, borderColor: BRAND.action, bgcolor: alpha(BRAND.action, 0.06) },
                              }}
                            >
                              {q.icon}
                            </IconButton>
                          </Tooltip>
                        ))}

                        <Tooltip title="More">
                          <IconButton size="small" aria-label="More actions" onClick={(e) => setMenu({ el: e.currentTarget, admission: a })} sx={{ color: NEUTRAL.muted }}>
                            <MoreVertRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Once a shift or less — real estate on the row is worth more than the
          click these save. */}
      <Menu anchorEl={menu?.el} open={!!menu} onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={fromMenu(setHandoverFor)}>
          <ListItemIcon><SwapHorizRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Shift handover" secondary="Notes and sign-off" />
        </MenuItem>
        <MenuItem onClick={fromMenu(setNotesFor)}>
          <ListItemIcon><DescriptionRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Nursing notes" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={fromMenu(setVisitsFor)}>
          <ListItemIcon><MedicalServicesRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Doctor visits" />
        </MenuItem>
      </Menu>

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
