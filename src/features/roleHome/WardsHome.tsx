import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip, Tooltip,
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
 * The wards, one row each — for a ward in-charge (the wards they run) and for
 * nursing administration (every ward). 15_System_Roles: "Nurse + bed status,
 * ward roster, indents" and "All wards: roster, postings, nurse reports".
 *
 * Per ward: census, beds to turn round, doses overdue, shifts not signed off,
 * ward stock below par, and nurses posted against the ward type's planning
 * ratio (workbook 03 — indicative, to be confirmed against NABH / state norms).
 */

export interface WardFigures {
  wardId: string;
  wardName: string;
  wardCode: string | null;
  wardType: string | null;
  beds: number;
  occupied: number;
  free: number;
  toTurnRound: number;
  overdueDoses: number;
  shiftsNotSignedOff: number;
  stockBelowPar: number;
  nursesPosted: number;
  patientsPerNurse: number | null;
  plannedRatio: string | null;
}

/** "1:6" → 6 patients per nurse; null when the ratio is not set or not that shape. */
const plannedPatients = (ratio: string | null) => {
  const m = ratio?.match(/^\s*1\s*:\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : null;
};

/** A figure that is fine at zero and needs someone otherwise. */
function Count({ n, severity = "warning" }: { n: number; severity?: "warning" | "critical" }) {
  if (!n) return <Typography variant="body2" sx={{ color: "text.disabled" }}>—</Typography>;
  const color = severity === "critical" ? SEMANTIC.danger : SEMANTIC.warningDark;
  return <Chip label={n} size="small" sx={{ bgcolor: `${color}1f`, color, fontWeight: 800 }} />;
}

function Staffing({ w }: { w: WardFigures }) {
  const planned = plannedPatients(w.plannedRatio);
  if (!w.nursesPosted) {
    return <Typography variant="body2" sx={{ color: w.occupied ? SEMANTIC.warningDark : "text.disabled", fontWeight: w.occupied ? 700 : 400 }}>{w.occupied ? "No nurse posted" : "—"}</Typography>;
  }
  const over = planned != null && w.patientsPerNurse != null && w.patientsPerNurse > planned;
  return (
    <Tooltip title={planned != null ? `Planned 1:${planned} for this ward type (indicative)` : "No planning ratio set for this ward type"}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: over ? SEMANTIC.danger : "text.primary" }}>
        {w.nursesPosted} posted · 1:{w.patientsPerNurse ?? 0}{planned != null ? ` (plan 1:${planned})` : ""}
      </Typography>
    </Tooltip>
  );
}

export default function WardsHome({ mode }: { mode: "mine" | "all" }) {
  const navigate = useNavigate();
  const q = useRoleHome<{ wards: WardFigures[]; basis?: "in-charge" | "posting" | "none" }>(mode === "mine" ? "ward-incharge" : "nursing-admin");
  const wards = q.data?.wards ?? [];
  const title = mode === "mine" ? "My wards" : "All wards";
  const subtitle = mode === "mine"
    ? q.data?.basis === "posting" ? "The ward you are posted to — you are not set as in-charge of a ward."
      : q.data?.basis === "in-charge" ? "The wards you are in charge of." : "The wards you run."
    : "Every ward side by side, with the nurses posted against the planning ratio.";

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader title={title} subtitle={subtitle}
        actions={<Freshness updatedAt={q.dataUpdatedAt} fetching={q.isFetching} onRefresh={() => q.refetch()} />} />
      {q.isError ? (
        <ErrorState title={`Couldn't load ${title.toLowerCase()}`} message={apiErrorText(q.error)} onRetry={() => q.refetch()} />
      ) : !q.isLoading && !wards.length ? (
        <Paper sx={{ p: 3 }}>
          <Mascot pose="nothing-here-yet"
            title={mode === "mine" ? "No ward to show yet" : "No wards at this branch"}
            subtitle={mode === "mine" ? "Ask the hospital admin to make you in-charge of your ward (Ward & Bed Setup), or Nursing Administration to post you to one." : undefined} />
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ward</TableCell>
                <TableCell align="right">In bed</TableCell>
                <TableCell align="right">Free</TableCell>
                <TableCell align="center">To turn round</TableCell>
                <TableCell align="center">Doses overdue</TableCell>
                <TableCell align="center">Shifts not signed off</TableCell>
                <TableCell align="center">Stock below par</TableCell>
                <TableCell>Nurses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={4} columns={8} /> : wards.map((w) => (
                <TableRow key={w.wardId} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/nurse/ward")}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                    {w.wardType && <Typography variant="caption" sx={{ color: "text.secondary" }}>{w.wardType}</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{w.occupied} / {w.beds}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{w.free}</TableCell>
                  <TableCell align="center"><Count n={w.toTurnRound} /></TableCell>
                  <TableCell align="center"><Count n={w.overdueDoses} severity="critical" /></TableCell>
                  <TableCell align="center"><Count n={w.shiftsNotSignedOff} /></TableCell>
                  <TableCell align="center"><Count n={w.stockBelowPar} /></TableCell>
                  <TableCell><Staffing w={w} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
