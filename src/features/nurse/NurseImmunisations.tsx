import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, TextField, InputAdornment, Typography, Chip, Alert,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  ToggleButton, ToggleButtonGroup, TablePagination,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { SearchRounded, VaccinesRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { BRAND, SEMANTIC } from "@/styles/accents";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { formatDate } from "@/utils/format";

/**
 * The immunisation worklist.
 *
 * Childhood immunisation is recall-driven — the work is finding who has fallen
 * off the schedule, not looking up one child at a time. Until this existed the
 * only route to a dose was opening a patient's record individually, which is
 * not how a defaulter is ever found.
 */

interface DueRow {
  patientVaccinationId: string;
  patientId: string | null;
  patientName: string;
  uhidNumber: string | null;
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  state: string;
}

const STATE_STYLE: Record<string, { label: string; color: string }> = {
  OVERDUE: { label: "Overdue", color: SEMANTIC.danger },
  DUE_SOON: { label: "Due soon", color: SEMANTIC.warningDark },
  UPCOMING: { label: "Upcoming", color: BRAND.action },
};

export default function NurseImmunisations() {
  const navigate = useNavigate();
  const [state, setState] = useState<"OVERDUE" | "DUE_SOON" | "ALL">("OVERDUE");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = 25;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["nurse-immunisations", state, search, page],
    queryFn: async () =>
      (await axiosInstance.get("/vaccination/due", {
        params: { state, search: search.trim() || undefined, limit: rowsPerPage, offset: page * rowsPerPage },
      })).data,
  });

  const rows: DueRow[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const counts = data?.meta?.counts ?? {};
  const unscheduled: number = data?.meta?.unscheduledChildren ?? 0;

  if (isError) {
    return <ErrorState title="Couldn't load the immunisation list" message={(error as Error)?.message} onRetry={() => refetch()} />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Immunisations"
        subtitle="Doses that are overdue or coming up — open a child to record the dose you gave."
      />

      {/* A child whose schedule has never been opened has no doses yet, so it
          cannot appear below. Saying so beats letting them go quietly missing. */}
      {unscheduled > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {unscheduled} child{unscheduled === 1 ? "" : "ren"} {unscheduled === 1 ? "has" : "have"} no immunisation schedule started yet, so
          {unscheduled === 1 ? " it is" : " they are"} not listed here. Opening the patient's Vaccinations tab creates the schedule.
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <ToggleButtonGroup
            size="small" exclusive value={state}
            onChange={(_, v) => { if (v) { setState(v); setPage(0); } }}
          >
            <ToggleButton value="OVERDUE" sx={{ textTransform: "none" }}>
              Overdue{counts.OVERDUE ? ` (${counts.OVERDUE})` : ""}
            </ToggleButton>
            <ToggleButton value="DUE_SOON" sx={{ textTransform: "none" }}>
              Due soon{counts.DUE_SOON ? ` (${counts.DUE_SOON})` : ""}
            </ToggleButton>
            <ToggleButton value="ALL" sx={{ textTransform: "none" }}>All outstanding</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small" placeholder="Search by name or UHID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 260, ml: "auto" }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Patient", "Vaccine", "Dose", "Due", "Status"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={5} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6, textAlign: "center", borderBottom: "none" }}>
                    <Mascot
                      pose="all-caught-up"
                      title="Nothing due"
                      subtitle={`No child is ${state === "OVERDUE" ? "overdue" : "due"} on this filter.`}
                    />
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => {
                const st = STATE_STYLE[r.state] ?? { label: r.state, color: BRAND.action };
                return (
                  <TableRow
                    key={r.patientVaccinationId}
                    hover
                    sx={{ cursor: r.patientId ? "pointer" : "default" }}
                    onClick={() => r.patientId && navigate(`/nurse/patients/${r.patientId}`, { state: { tab: "vaccinations" } })}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{r.uhidNumber || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <VaccinesRounded fontSize="small" sx={{ color: BRAND.action }} />
                        {r.vaccineName}
                      </Box>
                    </TableCell>
                    <TableCell>{r.doseLabel}</TableCell>
                    <TableCell>{formatDate(r.dueDate)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small" label={st.label}
                        sx={{ bgcolor: alpha(st.color, 0.12), color: st.color, fontWeight: 700 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {total > rowsPerPage && (
          <TablePagination
            component="div" count={total} page={page} rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
            onPageChange={(_, p) => setPage(p)}
          />
        )}
      </Paper>
    </Box>
  );
}
