import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip, Button, Menu, MenuItem,
} from "@mui/material";
import { EditNoteRounded, AddRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { isResidentOnly } from "@/constants/roles";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import IpdMedicinesDialog from "@/components/ipd/IpdMedicinesDialog";
import IpdLabOrdersDialog from "@/components/ipd/IpdLabOrdersDialog";
import IpdRadiologyOrdersDialog from "@/components/ipd/IpdRadiologyOrdersDialog";
import WardRoundNotesDialog from "@/features/wardRound/WardRoundNotesDialog";
import { useRoleHome } from "./useRoleHome";
import Freshness from "./Freshness";

/**
 * The ward round — a resident's home (15_System_Roles DOCTOR_RESIDENT: "notes,
 * orders (co-sign), ward rounds"). The patients in hospital under their
 * department: admitted under one of its consultants, or in a ward it owns.
 * Longest stay first, with what needs a look flagged. From each row the
 * resident writes the day's note and orders medicines, tests and scans; both
 * take effect at once and go to the consultant to co-sign within 24 hours.
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
  awaitingCosign: number;
}

type Open = { kind: "note" | "medicine" | "lab" | "scan"; patient: RoundPatient } | null;

export default function WardRound() {
  const navigate = useNavigate();
  const { user } = useHospitalAuth();
  const resident = isResidentOnly(user);
  const { isModuleEnabled } = useEnabledModules();
  const q = useRoleHome<{ department: string | null; patients: RoundPatient[] }>("ward-round");
  const patients = q.data?.patients ?? [];
  const [menu, setMenu] = useState<{ anchor: HTMLElement; patient: RoundPatient } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const close = () => { setOpen(null); q.refetch(); };
  const choose = (kind: NonNullable<Open>["kind"]) => { if (menu) setOpen({ kind, patient: menu.patient }); setMenu(null); };
  const dialogAdmission = open ? { admissionId: open.patient.admissionId, patientId: open.patient.patientId, patientName: open.patient.patientName } : null;

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
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={5} columns={6} /> : patients.map((p) => (
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
                      {p.awaitingCosign > 0 && <Chip size="small" label={`${p.awaitingCosign} awaiting co-sign`} sx={{ bgcolor: `${SEMANTIC.info}1f`, color: SEMANTIC.info, fontWeight: 700 }} />}
                      {!p.overdueDoses && !p.dischargeStarted && !p.awaitingCosign && <Typography variant="body2" sx={{ color: "text.disabled" }}>—</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    <Button size="small" startIcon={<EditNoteRounded />} onClick={() => setOpen({ kind: "note", patient: p })}>Note</Button>
                    {resident && (
                      <Button size="small" startIcon={<AddRounded />} onClick={(e) => setMenu({ anchor: e.currentTarget, patient: p })}>Order</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => choose("medicine")} disabled={!isModuleEnabled("Pharmacy")}>Medicine</MenuItem>
        <MenuItem onClick={() => choose("lab")} disabled={!isModuleEnabled("Laboratory")}>Lab test</MenuItem>
        <MenuItem onClick={() => choose("scan")} disabled={!isModuleEnabled("Laboratory")}>Scan</MenuItem>
      </Menu>
      {open?.kind === "note" && dialogAdmission && <WardRoundNotesDialog open onClose={close} admission={dialogAdmission} resident={resident} />}
      {open?.kind === "medicine" && dialogAdmission && <IpdMedicinesDialog open onClose={close} admission={dialogAdmission} orderOnly />}
      {open?.kind === "lab" && dialogAdmission && <IpdLabOrdersDialog open onClose={close} admission={dialogAdmission} orderOnly />}
      {open?.kind === "scan" && dialogAdmission && <IpdRadiologyOrdersDialog open onClose={close} admission={dialogAdmission} orderOnly />}
    </Box>
  );
}
