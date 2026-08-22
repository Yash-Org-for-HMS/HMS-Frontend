import { useState, useEffect, useMemo } from "react";
import { formatDateTime } from "@/utils/format";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, MenuItem, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Pagination, Alert,
} from "@mui/material";
import { InfoRounded, SearchRounded, RefreshRounded, DownloadRounded, LockRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";

const EMPTY_FILTERS = { moduleName: "", actionType: "", userId: "", branchId: "", startDate: "", endDate: "" };

/** Plain-language labels — an admin should not have to decode SCREAMING_CASE. */
const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  STATUS_CHANGE: "Status changed",
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  LOGIN_FAILED: "Failed sign-in",
  PASSWORD_CHANGE: "Password changed",
};

/**
 * Colour by what the action means, not by how it is spelled. The old version
 * knew only CREATE/UPDATE/DELETE, so every sign-in and every failed sign-in
 * rendered in the same flat grey as an unrecognised value.
 */
const ACTION_TONE: Record<string, string> = {
  CREATE: SEMANTIC.success,
  UPDATE: SEMANTIC.info,
  DELETE: SEMANTIC.danger,
  STATUS_CHANGE: SEMANTIC.warning,
  LOGIN: NEUTRAL.muted,
  LOGOUT: NEUTRAL.muted,
  LOGIN_FAILED: SEMANTIC.danger,
  PASSWORD_CHANGE: SEMANTIC.warning,
};

const toneOf = (action: string) => ACTION_TONE[action] ?? NEUTRAL.muted;
const labelOf = (action: string) => ACTION_LABEL[action] ?? action;

const pretty = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** "sellingPrice" / "selling_price" → "Selling price". */
const fieldLabel = (k: string) =>
  k.replace(/[_-]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

interface ChangeRow { field: string; before: unknown; after: unknown }

/**
 * Turn the stored JSON into something a person can read.
 *
 * Two shapes arrive: entries written by a service carry real before/after
 * values, and entries written by the router middleware carry the request that
 * was made. Both are rendered as a field list rather than as raw JSON — the old
 * dialog printed two JSON blobs side by side and called it a diff.
 */
function describeChange(log: any): { rows: ChangeRow[]; note?: string } {
  const oldV = log?.oldValueJson ?? null;
  const newV = log?.newValueJson ?? null;

  // Middleware shape: { method, path, params, request }
  if (newV && typeof newV === "object" && "path" in newV && "method" in newV) {
    const request = (newV as any).request;
    const rows: ChangeRow[] =
      request && typeof request === "object" && !Array.isArray(request)
        ? Object.entries(request).map(([k, v]) => ({ field: fieldLabel(k), before: undefined, after: v }))
        : request != null
          ? [{ field: "Submitted", before: undefined, after: request }]
          : [];
    return { rows, note: `${(newV as any).method} ${(newV as any).path}` };
  }

  const oldObj = oldV && typeof oldV === "object" && !Array.isArray(oldV) ? (oldV as Record<string, unknown>) : null;
  const newObj = newV && typeof newV === "object" && !Array.isArray(newV) ? (newV as Record<string, unknown>) : null;
  const keys = [...new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})])];

  if (!keys.length) return { rows: [] };
  return {
    rows: keys.map((k) => ({ field: fieldLabel(k), before: oldObj?.[k], after: newObj?.[k] })),
  };
}

export default function AuditLogs() {
  const toast = useToast();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Filters apply on explicit "Search", not as-you-type, so the query keys off a
  // separate "applied" snapshot.
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setPage(1); }, [appliedFilters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([k, v]) => { if (v) params.append(k, String(v)); });
    return params;
  }, [appliedFilters]);

  const { data: resp, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["hospital-audit-logs", appliedFilters, page],
    queryFn: async () => {
      const params = new URLSearchParams(queryString);
      params.append("page", String(page));
      params.append("limit", "20");
      return (await axiosInstance.get(`/hospital/audit-logs?${params.toString()}`)).data;
    },
  });

  // Dropdowns built from what has actually been recorded. They used to be
  // hardcoded to four module names invented by the old sample generator, so once
  // real recording started they matched nothing at all.
  const { data: options } = useQuery({
    queryKey: ["hospital-audit-filter-options"],
    queryFn: async () => (await axiosInstance.get("/hospital/audit-logs/filter-options")).data.data,
    staleTime: 60_000,
  });

  const logs: any[] = resp?.data ?? [];
  const totalPages: number = resp?.pagination?.totalPages ?? 1;
  const total: number = resp?.pagination?.total ?? 0;
  // "No results" and "nothing has happened yet" are different things to be told.
  const hasFilters = Object.values(appliedFilters).some((v) => Boolean(v));

  const { sorted, orderBy, order, onSort } = useTableSort(logs, {
    timestamp: (l) => (l.createdAt ? new Date(l.createdAt) : null),
    user: (l) => (l.user ? `${l.user.firstName} ${l.user.lastName}` : l.userId),
    module: (l) => l.moduleName,
    action: (l) => l.actionType,
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setAppliedFilters(filters); };
  const handleReset = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };

  // Exported server-side so it covers everything matching the filters, not the
  // 20 rows this page happens to be holding.
  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await axiosInstance.get(`/hospital/audit-logs/export?${queryString.toString()}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const selectProps = { fullWidth: true, size: "small" as const };
  const dateProps = { ...selectProps, type: "date", InputLabelProps: { shrink: true } };

  const change = selectedLog ? describeChange(selectedLog) : { rows: [] as ChangeRow[] };

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Audit & Activity Logs"
        subtitle="Every change made in this hospital, by whom, and when."
        actions={
          <Button
            variant="outlined" startIcon={<DownloadRounded />} onClick={handleExport}
            disabled={exporting || total === 0} sx={{ textTransform: "none" }}
          >
            {exporting ? "Preparing…" : "Export CSV"}
          </Button>
        }
      />

      {/* Say plainly what this page is, and what it deliberately cannot do. */}
      <Alert
        severity="info" icon={<LockRounded fontSize="inherit" />}
        sx={{ mb: 2.5, borderRadius: 2 }}
      >
        This record is <strong>read-only</strong>. Entries are written automatically when something
        changes and cannot be edited or deleted from anywhere in the application — including here.
      </Alert>

      <Paper component="form" onSubmit={handleSearch} elevation={0}
        sx={{ p: 2.5, mb: 2.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField select label="Module" name="moduleName" value={filters.moduleName} onChange={handleFilterChange} {...selectProps}>
              <MenuItem value="">All modules</MenuItem>
              {(options?.modules ?? []).map((m: string) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField select label="Action" name="actionType" value={filters.actionType} onChange={handleFilterChange} {...selectProps}>
              <MenuItem value="">All actions</MenuItem>
              {(options?.actions ?? []).map((a: string) => <MenuItem key={a} value={a}>{labelOf(a)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField select label="Staff member" name="userId" value={filters.userId} onChange={handleFilterChange} {...selectProps}>
              <MenuItem value="">Anyone</MenuItem>
              {(options?.users ?? []).map((u: any) => <MenuItem key={u.userId} value={u.userId}>{u.name}</MenuItem>)}
            </TextField>
          </Grid>
          {(options?.branches ?? []).length > 1 && (
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField select label="Branch" name="branchId" value={filters.branchId} onChange={handleFilterChange} {...selectProps}>
                <MenuItem value="">All branches</MenuItem>
                {(options?.branches ?? []).map((b: any) => <MenuItem key={b.branchId} value={b.branchId}>{b.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
            <TextField label="From" name="startDate" value={filters.startDate} onChange={handleFilterChange} {...dateProps} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
            <TextField label="To" name="endDate" value={filters.endDate} onChange={handleFilterChange} {...dateProps} />
          </Grid>
          <Grid size={{ xs: 12, md: "auto" }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button type="submit" variant="contained" startIcon={<SearchRounded />} sx={{ textTransform: "none" }}>Search</Button>
              {hasFilters && <Button onClick={handleReset} sx={{ textTransform: "none" }}>Clear</Button>}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {total === 0 ? "No entries" : `${total.toLocaleString()} entr${total === 1 ? "y" : "ies"}${hasFilters ? " matching these filters" : ""}`}
          </Typography>
          <Button size="small" startIcon={<RefreshRounded />} onClick={() => refetch()} disabled={isFetching} sx={{ textTransform: "none" }}>
            Refresh
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ p: 3 }}><ListSkeleton rows={8} /></Box>
        ) : isError ? (
          <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <SortableHeadCell sortKey="timestamp" label="When" orderBy={orderBy} order={order} onSort={onSort} />
                  <SortableHeadCell sortKey="user" label="Who" orderBy={orderBy} order={order} onSort={onSort} />
                  <SortableHeadCell sortKey="module" label="Where" orderBy={orderBy} order={order} onSort={onSort} />
                  <SortableHeadCell sortKey="action" label="What" orderBy={orderBy} order={order} onSort={onSort} />
                  <TableCell sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>From</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 5, border: 0 }}>
                      <Mascot pose="no-matches" subtitle={hasFilters ? "No activity matches these filters." : "No activity recorded yet."} size={120} />
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((log: any) => {
                    const tone = toneOf(log.actionType);
                    return (
                      <TableRow key={log.auditLogId} hover>
                        <TableCell sx={{ borderColor: "divider", color: "text.secondary", whiteSpace: "nowrap" }}>
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell sx={{ borderColor: "divider", color: "text.primary", fontWeight: 600 }}>
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId}
                        </TableCell>
                        <TableCell sx={{ borderColor: "divider" }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{log.moduleName}</Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>{log.tableName}</Typography>
                        </TableCell>
                        <TableCell sx={{ borderColor: "divider" }}>
                          <Chip
                            label={labelOf(log.actionType)} size="small"
                            sx={{ bgcolor: alpha(tone, 0.12), color: tone, fontWeight: 700, borderRadius: 1.5 }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: "divider", color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {log.ipAddress || "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ borderColor: "divider" }}>
                          <Tooltip title="What changed">
                            <IconButton size="small" onClick={() => setSelectedLog(log)} sx={{ color: BRAND.action }}>
                              <InfoRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}

      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="md" fullWidth>
        {/* component="div": DialogTitle renders an <h2>, so a Typography h6
            inside it nests a heading in a heading. */}
        <DialogTitle component="div" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {selectedLog ? `${labelOf(selectedLog.actionType)} — ${selectedLog.moduleName}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {selectedLog && `${selectedLog.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : selectedLog.userId} · ${formatDateTime(selectedLog.createdAt)}`}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, px: 3, py: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
            {[
              ["Record type", selectedLog?.tableName],
              ["IP address", selectedLog?.ipAddress || "—"],
              ["Device", selectedLog?.deviceInfo || "—"],
              ["Entry id", selectedLog?.auditLogId],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label}</Typography>
                <Typography variant="body2" sx={{ color: "text.primary", wordBreak: "break-all", maxWidth: 340 }}>{value}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ px: 3, py: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>What changed</Typography>
            {change.note && (
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", display: "block", mb: 1.5 }}>{change.note}</Typography>
            )}
            {change.rows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No field-level detail was captured for this entry.</Typography>
            ) : (
              <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", color: "text.secondary" }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", color: "text.secondary" }}>Before</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", color: "text.secondary" }}>After</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {change.rows.map((r) => {
                      const changed = r.before !== undefined && pretty(r.before) !== pretty(r.after);
                      return (
                        <TableRow key={r.field}>
                          <TableCell sx={{ fontWeight: 600, color: "text.primary", whiteSpace: "nowrap" }}>{r.field}</TableCell>
                          <TableCell sx={{ color: changed ? SEMANTIC.danger : "text.secondary", wordBreak: "break-word" }}>
                            {r.before === undefined ? "" : pretty(r.before)}
                          </TableCell>
                          <TableCell sx={{ color: changed ? SEMANTIC.success : "text.primary", fontWeight: changed ? 600 : 400, wordBreak: "break-word" }}>
                            {pretty(r.after)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setSelectedLog(null)} sx={{ textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
