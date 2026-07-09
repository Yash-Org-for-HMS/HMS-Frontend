import { ACCENTS } from "../../styles/accents";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment,
  Pagination, Avatar, Tooltip, IconButton,
} from "@mui/material";
import {
  SearchRounded, ChevronRightRounded, BloodtypeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { useServerSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";
import HeartbeatLoader from "../../components/HeartbeatLoader";

// Match this page's existing table-head styling so SortableHeadCell blends in.
const HEAD_SX = { bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" } as const;

const DOCTOR_BLUE = ACCENTS.doctor;
const PAGE_SIZE = 20;

// `scope="mine"` (default) is this doctor's own caseload (patients they've had
// appointments with). `scope="all"` is the whole hospital register, for
// looking up any patient (e.g. a colleague's, for continuity of care) — both
// hit the same read-only clinical profile at /doctor/patients/:id, which is
// already hospital-scoped rather than caseload-scoped.
export default function DoctorPatients({ scope = "mine" }: { scope?: "mine" | "all" } = {}) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  // Debounce the search box; reset to page 1 whenever the term changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Jump back to the first page whenever the sort changes.
  useEffect(() => { setPage(1); }, [orderBy, order]);

  const endpoint = scope === "all" ? "/doctor/patients/all" : "/doctor/patients";
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["doctor-patients", scope, search, page, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get(endpoint, {
        params: { search, page, limit: PAGE_SIZE, sortBy: orderBy || undefined, sortOrder: order },
      })).data,
    placeholderData: keepPreviousData,
  });

  const patients: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number } | undefined;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title={scope === "all" ? "All Patients" : "My Patients"}
        subtitle={scope === "all"
          ? "Every patient registered at this hospital — search and open a read-only clinical record."
          : "Patients you've consulted with — search and open a read-only clinical record."}
      />

      <TextField
        fullWidth
        size="small"
        placeholder="Search by name, UHID, or phone…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: isFetching ? <HeartbeatLoader size={22} /> : undefined,
        }}
      />

      <Paper elevation={0} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 640 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Patient" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="UHID" sortKey="uhid" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Age / Gender" sortKey="dob" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell sx={HEAD_SX}>Blood</TableCell>
                <SortableHeadCell label="Phone" sortKey="phone" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell sx={HEAD_SX}>Last Visit</TableCell>
                <TableCell sx={HEAD_SX} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={7} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, borderBottom: "none" }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle={search ? "No patients match your search." : scope === "all" ? "No patients registered yet." : "You haven't consulted any patients yet."} size={130} />
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((p) => (
                  <TableRow
                    key={p.patientId}
                    hover
                    onClick={() => navigate(`/doctor/patients/${p.patientId}`)}
                    sx={{ cursor: "pointer", "&:last-child td": { border: 0 } }}
                  >
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: `${DOCTOR_BLUE}22`, color: DOCTOR_BLUE, fontWeight: 700, fontSize: "0.875rem" }}>
                          {p.firstName?.charAt(0) || "P"}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {p.firstName} {p.lastName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontFamily: "monospace", fontSize: "0.875rem" }}>
                      {p.uhidNumber}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {p.age != null ? `${p.age} yrs` : "—"} • {p.genderLabel}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip
                        icon={<BloodtypeRounded sx={{ fontSize: "16px !important" }} />}
                        label={p.bloodGroupLabel}
                        size="small"
                        sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {p.phone || "—"}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {fmtDate(p.lastVisit)}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Tooltip title="Open record">
                        <IconButton size="small" sx={{ color: DOCTOR_BLUE }}>
                          <ChevronRightRounded />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {meta && meta.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {meta.total} patient{meta.total === 1 ? "" : "s"}
            </Typography>
            <Pagination
              count={meta.totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
              shape="rounded"
              size="small"
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
