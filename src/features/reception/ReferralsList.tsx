import { useEffect, useState } from "react";
import { apiErrorText } from "@/utils/apiError";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment, MenuItem, Tooltip, Pagination,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import dayjs from "dayjs";
import { BRAND } from "@/styles/accents";

// `basePath` keeps a row-click inside whatever shell renders the page (reception
// by default; the admin oversight route can pass "/hospital").
export default function ReferralsList({ basePath = "/reception" }: { basePath?: string } = {}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Search + type filter are applied server-side now (so paging is correct);
  // changing either resets to the first page.
  useEffect(() => { setPage(1); }, [search, typeFilter]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["referred-patients", typeFilter, search, page],
    queryFn: async () => (await axiosInstance.get("/reception/referred-patients", {
      params: { ...(typeFilter ? { type: typeFilter } : {}), ...(search.trim() ? { search: search.trim() } : {}), page, limit: 20 },
    })).data,
    placeholderData: keepPreviousData,
  });
  const rows: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  // Sort the current page client-side (server returns newest-first).
  const { sorted, orderBy, order, onSort } = useTableSort(rows, {
    patient: (r) => r.patientName,
    type: (r) => (r.referredByType === "EXTERNAL" ? "External" : "Internal"),
    source: (r) => r.source,
    registered: (r) => (r.createdAt ? new Date(r.createdAt) : null),
  });

  return (
    <Box>
      <PageHeader
        title="Referred Patients"
        subtitle="Patients referred to us — by one of our own doctors (internal) or an outside practitioner (external). Captured at registration."
      />

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Search patient, referrer, clinic…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
          sx={{ minWidth: 350 }}
        />
        <TextField select size="small" label="Referral type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All referrals</MenuItem>
          <MenuItem value="INTERNAL">Internal (our doctor)</MenuItem>
          <MenuItem value="EXTERNAL">External (outside)</MenuItem>
        </TextField>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 280px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Referral" sortKey="type" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Referred by" sortKey="source" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Registered" sortKey="registered" orderBy={orderBy} order={order} onSort={onSort} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={4} />
              ) : isError ? (
                <TableRow><TableCell colSpan={4} sx={{ py: 4, border: 0 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={4} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No referred patients" subtitle="No patients match this filter. Referral source is set on the patient's registration." /></TableCell></TableRow>
              ) : (
                sorted.map((r) => {
                  const isExternal = r.referredByType === "EXTERNAL";
                  return (
                    <TableRow key={r.patientId} hover sx={{ cursor: "pointer", "&:hover": { bgcolor: "background.default" } }}
                      onClick={() => navigate(`${basePath}/patients/${r.patientId}`)}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{r.patientName}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhid}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={isExternal ? "External" : "Internal"} size="small"
                          sx={{ bgcolor: isExternal ? "rgba(139,92,246,0.12)" : "rgba(8,145,178,0.12)", color: isExternal ? "#8b5cf6" : BRAND.action, fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2" sx={{ color: "text.primary" }}>{r.source}</Typography>
                        {isExternal && (r.externalSpecialty || r.externalClinic) && (
                          <Tooltip title={[r.externalSpecialty, r.externalClinic].filter(Boolean).join(" · ")}>
                            <Typography variant="caption" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 320 }}>
                              {[r.externalSpecialty, r.externalClinic].filter(Boolean).join(" · ")}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: "text.secondary" }}>{dayjs(r.createdAt).format("DD MMM YYYY")}</Typography></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}
    </Box>
  );
}
