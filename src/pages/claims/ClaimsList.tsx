import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Chip, Button, TextField, MenuItem, InputAdornment,
} from "@mui/material";
import { AddRounded, SearchRounded } from "@mui/icons-material";
import { ACCENTS } from "../../styles/accents";
import { axiosInstance } from "../../api/axios";
import { formatINR } from "../../utils/format";
import PageHeader from "../../components/layout/PageHeader";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { CLAIM_STATUS_META, statusMeta } from "./claimMeta";

const ACCENT = ACCENTS.reception;

export default function ClaimsList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data: claims = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["claims", status, search],
    queryFn: async () => (await axiosInstance.get("/claims", { params: { status: status || undefined, search: search || undefined } })).data.data as any[],
    placeholderData: keepPreviousData,
  });

  return (
    <Box>
      <PageHeader
        title="Insurance Claims"
        subtitle="Track insurance & government-scheme (MAA / PMJAY) cases through pre-auth, treatment, and settlement."
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate("/reception/claims/new")} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>
            New Claim
          </Button>
        }
      />

      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {Object.entries(CLAIM_STATUS_META).map(([code, m]) => (
            <MenuItem key={code} value={code}>{m.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small" placeholder="Search claim #, patient, UHID, policy…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280, flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
        />
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Claim #", "Patient", "Payer", "Scheme", "Status", "Estimated", "Registered"].map((h, i) => (
                  <TableCell key={h} align={i === 5 ? "right" : "left"} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={7} />
              ) : isError ? (
                <TableRow><TableCell colSpan={7}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : claims.length === 0 ? (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ py: 4 }}>
                    <Mascot pose="nothing-here-yet" title="No claims yet" subtitle="Register a claim to start tracking a cashless or reimbursement case." size={120} />
                  </Box>
                </TableCell></TableRow>
              ) : (
                claims.map((c) => {
                  const m = statusMeta(c.status);
                  return (
                    <TableRow key={c.claimId} hover sx={{ cursor: "pointer", opacity: isFetching ? 0.7 : 1 }} onClick={() => navigate(`/reception/claims/${c.claimId}`)}>
                      <TableCell sx={{ fontWeight: 600 }}>{c.claimNumber}</TableCell>
                      <TableCell>{c.patientName}<Box component="span" sx={{ color: "text.secondary", fontSize: "0.8rem", display: "block" }}>{c.uhid}</Box></TableCell>
                      <TableCell>{c.payerName || "—"}</TableCell>
                      <TableCell>{c.schemeType || "—"}</TableCell>
                      <TableCell><Chip size="small" label={m.label} sx={{ bgcolor: `${m.color}22`, color: m.color, fontWeight: 700 }} /></TableCell>
                      <TableCell align="right">{c.estimatedCost != null ? formatINR(Number(c.estimatedCost)) : "—"}</TableCell>
                      <TableCell>{c.registeredAt ? dayjs(c.registeredAt).format("DD MMM YYYY") : "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
