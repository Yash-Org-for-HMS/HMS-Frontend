import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, TextField, InputAdornment,
  Pagination, Avatar, Tooltip, IconButton,
} from "@mui/material";
import {
  PeopleAltRounded, SearchRounded, ChevronRightRounded, BloodtypeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";

const DOCTOR_BLUE = "#3b82f6";
const PAGE_SIZE = 20;

export default function DoctorPatients() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box; reset to page 1 whenever the term changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["doctor-patients", search, page],
    queryFn: async () =>
      (await axiosInstance.get("/doctor/patients", {
        params: { search, page, limit: PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  });

  const patients: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number } | undefined;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <PeopleAltRounded sx={{ color: DOCTOR_BLUE, fontSize: 32 }} />
            My Patients
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Patients you've consulted with — search and open a read-only clinical record.
          </Typography>
        </Box>
      </Box>

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
          endAdornment: isFetching ? <CircularProgress size={16} sx={{ color: DOCTOR_BLUE }} /> : undefined,
        }}
      />

      <Paper elevation={0} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 640 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {["Patient", "UHID", "Age / Gender", "Blood", "Phone", "Last Visit", ""].map((h, i) => (
                  <TableCell key={i} sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <CircularProgress sx={{ color: DOCTOR_BLUE }} />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, borderBottom: "none" }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle={search ? "No patients match your search." : "You haven't consulted any patients yet."} size={130} />
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
                        <Avatar sx={{ width: 34, height: 34, bgcolor: `${DOCTOR_BLUE}22`, color: DOCTOR_BLUE, fontWeight: 700, fontSize: "0.85rem" }}>
                          {p.firstName?.charAt(0) || "P"}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {p.firstName} {p.lastName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontFamily: "monospace", fontSize: "0.8rem" }}>
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
