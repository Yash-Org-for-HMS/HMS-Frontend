import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Grid, Button, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, Typography, Chip, Divider, ToggleButton, ToggleButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, IconButton, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  SearchRounded, MedicationRounded, MedicalServicesRounded, DescriptionRounded, VaccinesRounded,
  ScienceRounded, CameraAltRounded,
  MonitorHeartRounded, WaterDropRounded, SwapHorizRounded, AssignmentRounded,
  HotelRounded, ViewModuleRounded, ViewListRounded,
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
import IpdLabOrdersDialog from "@/components/ipd/IpdLabOrdersDialog";
import SurgeryDialog from "@/components/ipd/SurgeryDialog";
import IpdMedicinesDialog from "@/components/ipd/IpdMedicinesDialog";
import IpdRadiologyOrdersDialog from "@/components/ipd/IpdRadiologyOrdersDialog";
import { apiErrorText } from "@/utils/apiError";

/**
 * The ward, grouped by ward — a flat list made a nurse pick their patients out
 * of every other ward's.
 *
 * Two views answering different questions: cards name every action and have
 * room for bed and length of stay; the list is dense, for scanning a big ward
 * for one patient. The choice is remembered.
 */

const VIEW_KEY = "hms.ward.view";

/** "Room 10" after "Room 9", not before it. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export default function NurseWard() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "cards" | "list") || "cards",
  );
  const [chartFor, setChartFor] = useState<any>(null);
  const [visitsFor, setVisitsFor] = useState<any>(null);
  const [notesFor, setNotesFor] = useState<any>(null);
  const [obsFor, setObsFor] = useState<any>(null);
  const [fluidFor, setFluidFor] = useState<any>(null);
  const [handoverFor, setHandoverFor] = useState<any>(null);
  const [labsFor, setLabsFor] = useState<any>(null);
  const [radiologyFor, setRadiologyFor] = useState<any>(null);
  const [surgeryFor, setSurgeryFor] = useState<WardRow | null>(null);
  const [assignMedsFor, setAssignMedsFor] = useState<WardRow | null>(null);
  const navigate = useNavigate();

  const { data: admissions = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["nurse-ward-admissions"],
    queryFn: async () => (await axiosInstance.get("/ipd/admissions", { params: { status: "ADMITTED" } })).data.data,
  });

  const s = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      s
        ? admissions.filter((a) => [a.patientName, a.uhid, a.bed?.label].filter(Boolean).some((v: string) => v.toLowerCase().includes(s)))
        : admissions,
    [admissions, s],
  );

  // Grouped by ward, each ward ordered by room then bed — the order a nurse
  // walks the ward in, rather than whatever order the API returned.
  const groups = useMemo(() => {
    const byWard = new Map<string, any[]>();
    for (const a of filtered) {
      const ward = a.bed?.wardName || "No ward assigned";
      (byWard.get(ward) ?? byWard.set(ward, []).get(ward)!).push(a);
    }
    return [...byWard.entries()]
      .sort(([x], [y]) => (x === "No ward assigned" ? 1 : y === "No ward assigned" ? -1 : collator.compare(x, y)))
      .map(([ward, list]) => ({
        ward,
        list: list.sort(
          (p, q) =>
            collator.compare(p.bed?.roomNumber ?? "", q.bed?.roomNumber ?? "") ||
            collator.compare(p.bed?.bedNumber ?? "", q.bed?.bedNumber ?? "") ||
            collator.compare(p.patientName ?? "", q.patientName ?? ""),
        ),
      }));
  }, [filtered]);

  // Split by what the action IS, not by guessed frequency — ten buttons a card
  // meant four rows and nothing standing out:
  //
  //   CHART   — recording what happened (the hourly work)
  //   ORDER   — asking for something new, on the doctor's word
  //   RECORD  — reference, read far more often than written
  //
  // Every action stays on the card one tap away; the grouping makes ten of them
  // readable, not to hide six behind a menu.
  //
  // Typed explicitly: inferred, `tone` narrows to the one literal colour the
  // first list contains and the muted entries below stop fitting.
  /** The fields any ward action needs off the row it was opened from. */
  interface WardRow {
    admissionId: string;
    patientId?: string | null;
    patientName?: string;
    uhid?: string;
  }

  interface WardAction {
    key: string;
    label: string;
    icon: React.ReactNode;
    open: (row: WardRow) => void;
    tone: string;
  }

  const ACTION_GROUPS: { group: string; items: WardAction[] }[] = [{ group: "Chart", items: [
    { key: "obs", label: "Observations", icon: <MonitorHeartRounded fontSize="small" />, open: setObsFor, tone: BRAND.action },
    { key: "meds", label: "Medication chart", icon: <MedicationRounded fontSize="small" />, open: setChartFor, tone: BRAND.action },
    { key: "fluid", label: "Fluids", icon: <WaterDropRounded fontSize="small" />, open: setFluidFor, tone: BRAND.action },
    { key: "notes", label: "Nursing notes", icon: <DescriptionRounded fontSize="small" />, open: setNotesFor, tone: BRAND.action },
  ] },
    {
      group: "Order",
      items: [
        // The ward asks; the pharmacy commits. A new order is created REQUESTED —
        // it moves no stock and reaches no bill until the pharmacy confirms it.
        { key: "assign-meds", label: "Assign medicine", icon: <VaccinesRounded fontSize="small" />, open: setAssignMedsFor, tone: BRAND.action },
        // Ordering for an admitted patient goes through the IPD path, not the
        // walk-in one: it must carry the admission so the charge reaches the
        // discharge bill rather than raising a separate OPD invoice.
        { key: "labs", label: "Investigations", icon: <ScienceRounded fontSize="small" />, open: setLabsFor, tone: BRAND.action },
        { key: "imaging", label: "Imaging", icon: <CameraAltRounded fontSize="small" />, open: setRadiologyFor, tone: BRAND.action },
      ],
    },
    {
      group: "Record",
      items: [
        { key: "visits", label: "Doctor visits", icon: <MedicalServicesRounded fontSize="small" />, open: setVisitsFor, tone: NEUTRAL.muted },
        // Full access, same dialog the desk uses: the ward records what actually
        // happened in theatre. Marking a PRICED surgery completed raises its
        // charge, so the price field is the one to be careful with.
        { key: "surgery", label: "Surgery", icon: <MedicalServicesRounded fontSize="small" />, open: setSurgeryFor, tone: NEUTRAL.muted },
        { key: "handover", label: "Handover", icon: <SwapHorizRounded fontSize="small" />, open: setHandoverFor, tone: NEUTRAL.muted },
      ],
    },
  ];

  // The dense view keeps every icon in one strip, in group order, with a hair
  // of space between groups instead of labels — there is no room for headings
  // in a table row and the order alone carries the grouping.
  const allActions = ACTION_GROUPS.flatMap((g) => g.items);


  const chooseView = (_: unknown, v: "cards" | "list" | null) => {
    if (!v) return;
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  /** Room · bed, built from the parts — the API's composed label reads "Bed Bed 1". */
  const bedText = (a: any) => [a.bed?.roomNumber, a.bed?.bedNumber].filter(Boolean).join(" · ");

  const PatientCard = ({ a }: { a: any }) => (
    <Paper
      elevation={0}
      sx={{
        height: "100%", display: "flex", flexDirection: "column",
        borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden",
        transition: "border-color .15s ease",
        "&:hover": { borderColor: alpha(BRAND.action, 0.5) },
      }}
    >
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>{a.patientName}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {[a.uhid, a.admissionNumber].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          {a.days != null && (
            <Chip size="small" label={`Day ${a.days}`}
              sx={{ flexShrink: 0, bgcolor: alpha(SEMANTIC.info, 0.12), color: SEMANTIC.info, fontWeight: 700 }} />
          )}
        </Box>

        <Box sx={{ mt: 1.5 }}>
          {a.bed ? (
            <Chip size="small" icon={<HotelRounded sx={{ fontSize: 15 }} />} label={bedText(a)}
              sx={{ bgcolor: alpha(BRAND.action, 0.1), color: BRAND.action, fontWeight: 600 }} />
          ) : (
            <Chip size="small" label="No bed assigned"
              sx={{ bgcolor: alpha(SEMANTIC.warning, 0.12), color: SEMANTIC.warning, fontWeight: 600 }} />
          )}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          {a.doctorName || "No consultant recorded"}
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ px: 2.5, py: 2, mt: "auto" }}>
        <Button fullWidth variant="contained" startIcon={<AssignmentRounded />}
          onClick={() => navigate("/nurse/chart/" + a.admissionId)} sx={{ textTransform: "none", mb: 1.5 }}>
          Open chart
        </Button>
        {ACTION_GROUPS.map((g) => (
          <Box key={g.group} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 700, fontSize: "0.62rem", letterSpacing: 0.7, textTransform: "uppercase", mb: 0.5 }}>
              {g.group}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {g.items.map((act) => (
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
        ))}
      </Box>
    </Paper>
  );

  const PatientTable = ({ list }: { list: any[] }) => (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Bed</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Consultant</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Stay</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "text.secondary" }}>Chart</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.admissionId} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600, color: BRAND.action }}>{bedText(a) || "—"}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.patientName}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{a.uhid}</Typography>
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{a.doctorName || "—"}</TableCell>
                <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{a.days != null ? `Day ${a.days}` : "—"}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    <Button size="small" variant="contained" startIcon={<AssignmentRounded />}
                      onClick={() => navigate("/nurse/chart/" + a.admissionId)}
                      sx={{ textTransform: "none", whiteSpace: "nowrap", flexShrink: 0, mr: 0.5 }}>
                      Open chart
                    </Button>
                    {/* The dense view trades labels for icons — that is the trade
                        it exists to make. The charting actions stay one tap; the
                        rest are one tap behind the same menu as the cards. */}
                    {allActions.map((act) => (
                      <Tooltip key={act.key} title={act.label}>
                        <IconButton size="small" aria-label={act.label} onClick={() => act.open(a)}
                          sx={{ color: NEUTRAL.muted, "&:hover": { color: act.tone, bgcolor: alpha(act.tone, 0.08) } }}>
                          {act.icon}
                        </IconButton>
                      </Tooltip>
                    ))}

                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader title="Ward" subtitle="Current in-patients — open a chart to record or read the day" />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {isLoading ? "" : `${filtered.length} patient${filtered.length === 1 ? "" : "s"} across ${groups.length} ward${groups.length === 1 ? "" : "s"}${s ? " matching" : ""}`}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            placeholder="Search patient, UHID, bed…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
            sx={{ minWidth: 280 }}
          />
          <ToggleButtonGroup exclusive size="small" value={view} onChange={chooseView}>
            <ToggleButton value="cards" aria-label="Card view"><Tooltip title="Cards — every action named"><ViewModuleRounded fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="list" aria-label="List view"><Tooltip title="List — denser, for a big ward"><ViewListRounded fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {isLoading ? (
        <CardGridSkeleton count={6} height={230} minWidth={330} />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ py: 5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Mascot pose="all-caught-up"
            title={s ? "No match" : "No in-patients"}
            subtitle={s ? "No patient matches that search." : "No active admissions right now."} size={120} />
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
          {groups.map(({ ward, list }) => (
            <Box key={ward}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
                <HotelRounded sx={{ color: NEUTRAL.muted, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>{ward}</Typography>
                <Chip size="small" label={`${list.length} patient${list.length === 1 ? "" : "s"}`}
                  sx={{ bgcolor: alpha(NEUTRAL.muted, 0.12), color: "text.secondary", fontWeight: 600 }} />
                <Divider sx={{ flex: 1, ml: 0.5 }} />
              </Box>

              {view === "cards" ? (
                <Grid container spacing={2.5}>
                  {list.map((a) => (
                    <Grid key={a.admissionId} size={{ xs: 12, md: 6, lg: 4 }}><PatientCard a={a} /></Grid>
                  ))}
                </Grid>
              ) : (
                <PatientTable list={list} />
              )}
            </Box>
          ))}
        </Box>
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
      {labsFor && <IpdLabOrdersDialog open admission={labsFor} onClose={() => setLabsFor(null)} />}
      {radiologyFor && <IpdRadiologyOrdersDialog open admission={radiologyFor} onClose={() => setRadiologyFor(null)} />}
      {surgeryFor && <SurgeryDialog open admission={surgeryFor} onClose={() => setSurgeryFor(null)} />}
      {assignMedsFor && <IpdMedicinesDialog open admission={assignMedsFor} onClose={() => setAssignMedsFor(null)} />}
    </Box>
  );
}
