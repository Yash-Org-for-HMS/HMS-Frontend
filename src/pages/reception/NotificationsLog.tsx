import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  Pagination,
  Alert,
  Tooltip,
} from "@mui/material";
import { EmailRounded, SmsRounded, CheckCircleRounded, SearchRounded, ScienceRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import PageHeader from "../../components/layout/PageHeader";
import { useServerSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";

// Match this list's existing sentence-case header look.
const headSx = { bgcolor: "background.paper", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider", textTransform: "none", letterSpacing: "normal", fontSize: "0.875rem" } as const;

const PAGE_SIZE = 20;

export default function NotificationsLog() {
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

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  // Reset to the first page whenever the sort changes.
  useEffect(() => {
    setPage(1);
  }, [orderBy, order]);

  const { data, isLoading: loading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["reception-notifications", search, page, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/reception/notifications", {
        params: { search, page, limit: PAGE_SIZE, sortBy: orderBy || undefined, sortOrder: order },
      })).data,
    placeholderData: keepPreviousData, // keep the current page visible while the next loads
  });

  const notifications: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number } | undefined;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <PageHeader
        title="Notifications Log"
        subtitle="History of SMS and Email notifications sent to patients."
        actions={
          <Tooltip title="These notifications are logged for the record but are not yet delivered as real SMS/email.">
            <Chip
              icon={<ScienceRounded sx={{ fontSize: "16px !important" }} />}
              label="Simulated"
              size="small"
              sx={{ bgcolor: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700, border: "1px solid rgba(245,158,11,0.3)" }}
            />
          </Tooltip>
        }
      />

      <Alert severity="info" icon={<ScienceRounded />} sx={{ mb: 3 }}>
        Notifications are <strong>simulated</strong> — they're recorded here but not actually delivered yet. Wire up an SMS/email provider to send for real.
      </Alert>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by title, message, or channel…"
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

      <Paper sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Channel" sortKey="channel" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label="Title" sortKey="title" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label="Message" sortKey="message" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label="Sent At" sortKey="sentAt" orderBy={orderBy} order={order} onSort={onSort} align="right" sx={headSx} />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton rows={6} columns={5} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, borderBottom: "none" }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle={search ? "No notifications match your search." : "No notifications sent yet."} size={130} />
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notif) => (
                  <TableRow key={notif.notificationId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip
                        icon={notif.channel === "SMS" ? <SmsRounded fontSize="small" /> : <EmailRounded fontSize="small" />}
                        label={notif.channel}
                        size="small"
                        sx={{
                          bgcolor: notif.channel === "SMS" ? "rgba(56, 189, 248, 0.15)" : "rgba(244, 63, 94, 0.15)",
                          color: notif.channel === "SMS" ? "#38bdf8" : "#f43f5e",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 500 }}>
                      {notif.title}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {notif.message}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                        <Chip
                          icon={<CheckCircleRounded fontSize="small" />}
                          label={notif.status}
                          size="small"
                          sx={{ bgcolor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 600 }}
                        />
                        <Chip
                          label="Simulated"
                          size="small"
                          variant="outlined"
                          sx={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.4)", fontWeight: 600, fontSize: "0.75rem", height: 20 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {notif.sentAt ? new Date(notif.sentAt).toLocaleString() : "N/A"}
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
              {meta.total} notification{meta.total === 1 ? "" : "s"}
            </Typography>
            <Pagination
              count={meta.totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
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
