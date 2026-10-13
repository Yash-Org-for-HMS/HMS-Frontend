import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Checkbox, Button, Pagination,
} from "@mui/material";
import { DoneAllRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import SoftChip from "@/components/SoftChip";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { axiosInstance } from "@/api/axios";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useToast } from "@/providers/ToastContext";
import { useLiveConnected } from "@/hooks/useSocket";
import { isResidentOnly } from "@/constants/roles";
import { DASHBOARD_POLL_MS, LIVE_DASHBOARD_FALLBACK_MS } from "@/constants/intervals";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import Freshness from "@/features/roleHome/Freshness";

dayjs.extend(relativeTime);

/**
 * Co-signing (backend /ward-round/cosign). A consultant's list: what residents
 * wrote or ordered for patients admitted under them, due within 24 hours of
 * being written. A resident sees the same list of their own, waiting.
 */

interface CosignItem {
  cosignId: string;
  kind: "NOTE" | "MEDICATION" | "LAB" | "RADIOLOGY";
  summary: string;
  admissionId: string;
  patientId: string | null;
  patientName: string;
  uhid: string;
  residentName: string;
  createdAt: string;
  dueAt: string;
  cosignedAt: string | null;
  overdue: boolean;
}

const KIND: Record<CosignItem["kind"], string> = { NOTE: "Note", MEDICATION: "Medicine", LAB: "Lab", RADIOLOGY: "Scan" };

export default function CosignPage() {
  const { user } = useHospitalAuth();
  const resident = isResidentOnly(user);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const live = useLiveConnected();
  const [picked, setPicked] = useState<string[]>([]);
  const [signing, setSigning] = useState(false);
  const [page, setPage] = useState(1);
  const q = useQuery<{ pending: CosignItem[]; signedToday: CosignItem[]; totalPages: number }>({
    queryKey: ["ward-round-cosign", page],
    queryFn: async () => {
      const body = (await axiosInstance.get("/ward-round/cosign", { params: { page, limit: 20 } })).data;
      return { ...body.data, totalPages: body.pagination?.totalPages ?? 1 };
    },
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchInterval: live ? LIVE_DASHBOARD_FALLBACK_MS : DASHBOARD_POLL_MS,
  });
  const pending = q.data?.pending ?? [];
  const signedToday = q.data?.signedToday ?? [];
  const totalPages = q.data?.totalPages ?? 1;
  // Co-signing the last items on the last page: step back rather than strand on an empty page.
  if (!q.isPlaceholderData && page > Math.max(1, totalPages)) setPage(Math.max(1, totalPages));
  const chosen = picked.filter((id) => pending.some((p) => p.cosignId === id));

  const sign = async (ids: string[]) => {
    setSigning(true);
    try {
      const { signed } = (await axiosInstance.post("/ward-round/cosign", { cosignIds: ids })).data.data as { signed: number };
      toast.success(signed ? `Co-signed ${signed}` : "Already co-signed");
      setPicked([]);
      qc.invalidateQueries({ queryKey: ["ward-round-cosign"] });
      qc.invalidateQueries({ queryKey: ["doctor-badges"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't co-sign"));
    } finally {
      setSigning(false);
    }
  };

  const row = (p: CosignItem, done: boolean) => (
    <TableRow key={p.cosignId} hover>
      {!resident && !done && (
        <TableCell padding="checkbox">
          <Checkbox
            size="small"
            checked={chosen.includes(p.cosignId)}
            onChange={(e) => setPicked((s) => (e.target.checked ? [...s, p.cosignId] : s.filter((x) => x !== p.cosignId)))}
            inputProps={{ "aria-label": `Choose ${KIND[p.kind]} for ${p.patientName}` }}
          />
        </TableCell>
      )}
      <TableCell sx={{ cursor: p.patientId ? "pointer" : "default" }} onClick={() => { if (p.patientId) navigate(`/doctor/patients/${p.patientId}`); }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.patientName}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.uhid}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{p.summary}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{KIND[p.kind]}{resident ? "" : ` · ${p.residentName}`}</Typography>
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(p.createdAt).format("DD MMM, h:mm A")}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {done
          ? <SoftChip label={`Co-signed ${dayjs(p.cosignedAt).fromNow()}`} bg={`${SEMANTIC.success}1f`} color={SEMANTIC.success} />
          : p.overdue
            ? <SoftChip label={`Overdue ${dayjs(p.dueAt).fromNow(true)}`} bg={`${SEMANTIC.danger}1f`} color={SEMANTIC.danger} />
            : <Typography variant="body2" sx={{ color: "text.secondary" }}>Due {dayjs(p.dueAt).fromNow()}</Typography>}
      </TableCell>
      {!resident && !done && (
        <TableCell align="right">
          <Button size="small" disabled={signing} onClick={() => sign([p.cosignId])}>Co-sign</Button>
        </TableCell>
      )}
    </TableRow>
  );

  const head = (done: boolean) => (
    <TableHead>
      <TableRow>
        {!resident && !done && (
          <TableCell padding="checkbox">
            <Checkbox
              size="small"
              checked={pending.length > 0 && chosen.length === pending.length}
              indeterminate={chosen.length > 0 && chosen.length < pending.length}
              onChange={(e) => setPicked(e.target.checked ? pending.map((p) => p.cosignId) : [])}
              inputProps={{ "aria-label": "Choose all" }}
            />
          </TableCell>
        )}
        <TableCell>Patient</TableCell>
        <TableCell>What</TableCell>
        <TableCell>Written</TableCell>
        <TableCell>{done ? "Co-signed" : "Due"}</TableCell>
        {!resident && !done && <TableCell />}
      </TableRow>
    </TableHead>
  );

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title={resident ? "Waiting for co-sign" : "To co-sign"}
        subtitle={resident
          ? "Your notes and orders, until the patient's consultant co-signs them (within 24 hours)."
          : "Residents' notes and orders for your patients. Each took effect when written; co-sign within 24 hours."}
        actions={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {!resident && chosen.length > 0 && (
              <Button variant="contained" startIcon={<DoneAllRounded />} disabled={signing} onClick={() => sign(chosen)}>
                Co-sign {chosen.length}
              </Button>
            )}
            <Freshness updatedAt={q.dataUpdatedAt} fetching={q.isFetching} onRefresh={() => q.refetch()} />
          </Box>
        }
      />
      {q.isError ? (
        <ErrorState title="Couldn't load the list" message={apiErrorText(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          {!q.isLoading && !pending.length ? (
            <Paper sx={{ p: 3 }}><Mascot pose="all-caught-up" title={resident ? "Nothing waiting — everything you wrote is co-signed" : "Nothing to co-sign"} /></Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                {head(false)}
                <TableBody>
                  {q.isLoading ? <TableRowsSkeleton rows={4} columns={resident ? 4 : 6} /> : pending.map((p) => row(p, false))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination count={totalPages} page={page} onChange={(_, v) => { setPage(v); setPicked([]); }} color="primary" shape="rounded" />
            </Box>
          )}
          {signedToday.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: "text.secondary" }}>Co-signed in the last 24 hours</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  {head(true)}
                  <TableBody>{signedToday.map((p) => row(p, true))}</TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Box>
  );
}
