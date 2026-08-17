import { ACCENTS, SEMANTIC, BRAND } from "@/styles/accents";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, TextField, InputAdornment, Pagination, Tabs, Tab,
  IconButton, Button, Tooltip, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from "@mui/material";
import {
  SearchRounded, CloseRounded,
  WarningAmberRounded, BiotechRounded, MonitorHeartRounded, OpenInNewRounded, PersonRounded, VerifiedRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { assetUrl } from "@/utils/assetUrl";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useServerSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";

// Match this page's existing table-head styling so SortableHeadCell blends in.
const HEAD_SX = { bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" } as const;

const DOCTOR_BLUE = BRAND.action;
const PAGE_SIZE = 20;

const TABS = [
  { key: "ready", label: "Ready to review" },
  { key: "pending", label: "Awaiting results" },
  { key: "all", label: "All" },
];

export default function DoctorResults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);

  // Opening the inbox marks results as seen, clearing the sidebar "new results"
  // badge. Fire-and-forget; refresh the badge count afterwards.
  useEffect(() => {
    axiosInstance
      .post("/doctor/badges/results-seen")
      .then(() => queryClient.invalidateQueries({ queryKey: ["doctor-badges"] }))
      .catch(() => {});
  }, []);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);

  // Server-side column sorting (the list is paginated, so sorting happens server-side).
  const { orderBy, order, onSort } = useServerSort();

  const status = TABS[tab].key;

  // Reset to page 1 whenever the (debounced) search term changes.
  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => { setPage(1); setSelected(null); }, [tab]);

  // Jump back to the first page whenever the sort changes.
  useEffect(() => { setPage(1); }, [orderBy, order]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["doctor-results", status, search, page, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/doctor/results", {
        params: { status, search, page, limit: PAGE_SIZE, sortBy: orderBy || undefined, sortOrder: order },
      })).data,
    placeholderData: keepPreviousData,
  });

  const rows: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number; readyCount: number; pendingCount: number } | undefined;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Results"
        subtitle="Lab and radiology results for tests you've ordered — including those that came back after the visit."
      />

      <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 48 }}>
            {TABS.map((t, i) => (
              <Tab
                key={t.key}
                sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {t.label}
                    {i === 0 && meta?.readyCount ? (
                      <Chip label={meta.readyCount} size="small" color="primary" sx={{ height: 18, fontSize: "0.75rem" }} />
                    ) : null}
                    {i === 1 && meta?.pendingCount ? (
                      <Chip label={meta.pendingCount} size="small" sx={{ height: 18, fontSize: "0.75rem" }} />
                    ) : null}
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by patient, UHID, or test…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ maxWidth: 420 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
              endAdornment: isFetching ? <HeartbeatLoader size={22} /> : undefined,
            }}
          />
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Type" sortKey="type" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Test / Scan" sortKey="title" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Ordered" sortKey="ordered" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell sx={HEAD_SX} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, borderBottom: "none" }}>
                    <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle={search ? "No results match your search." : status === "ready" ? "No results waiting for review." : "Nothing here yet."} size={130} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const key = `${r.type}-${r.orderId}`;
                  return (
                      <TableRow
                        key={key}
                        hover
                        onClick={() => setSelected(r)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Chip
                            icon={r.type === "LAB" ? <BiotechRounded sx={{ fontSize: "16px !important" }} /> : <MonitorHeartRounded sx={{ fontSize: "16px !important" }} />}
                            label={r.type === "LAB" ? "Lab" : "Radiology"}
                            size="small"
                            sx={{ bgcolor: r.type === "LAB" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)", color: r.type === "LAB" ? DOCTOR_BLUE : "#8b5cf6", fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{r.patientName}</Typography>
                          {r.uhidNumber && <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{r.uhidNumber}</Typography>}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary", maxWidth: 280 }}>
                          <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {r.title}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{fmt(r.orderDate)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            {r.status === "READY" ? (
                              <Chip label="Ready" size="small" sx={{ bgcolor: "rgba(16,185,129,0.15)", color: "#16a34a", fontWeight: 700 }} />
                            ) : (
                              <Chip label={r.type === "LAB" && r.progress ? `Pending ${r.progress}` : "Pending"} size="small" sx={{ bgcolor: "rgba(245,158,11,0.15)", color: SEMANTIC.warningDark, fontWeight: 600 }} />
                            )}
                            {(r.type === "LAB" || r.type === "RADIOLOGY") && r.status === "READY" && (
                              r.verified ? (
                                <Chip icon={<VerifiedRounded sx={{ fontSize: "14px !important" }} />} label="Verified" size="small" sx={{ height: 20, bgcolor: "rgba(16,185,129,0.12)", color: "#0f9d78", fontWeight: 700 }} />
                              ) : (
                                <Tooltip title="Results not yet verified by a pathologist">
                                  <Chip label="Unverified" size="small" sx={{ height: 20, bgcolor: "rgba(148,163,184,0.2)", color: SEMANTIC.warningDark, fontWeight: 600 }} />
                                </Tooltip>
                              )
                            )}
                            {r.isCritical && (
                              <Tooltip title="Critical value flagged">
                                <WarningAmberRounded sx={{ color: SEMANTIC.danger, fontSize: 18 }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Open patient record">
                            <IconButton size="small" sx={{ color: DOCTOR_BLUE }} onClick={(e) => { e.stopPropagation(); navigate(`/doctor/patients/${r.patientId}`); }}>
                              <PersonRounded fontSize="small" />
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

        {meta && meta.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{meta.total} result{meta.total === 1 ? "" : "s"}</Typography>
            <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" size="small" />
          </Box>
        )}
      </Paper>

      {/* Results popup — opens on row click */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selected && (
          <>
            <DialogTitle sx={{ pb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75, flexWrap: "wrap" }}>
                    <Chip
                      icon={selected.type === "LAB" ? <BiotechRounded sx={{ fontSize: "16px !important" }} /> : <MonitorHeartRounded sx={{ fontSize: "16px !important" }} />}
                      label={selected.type === "LAB" ? "Lab" : "Radiology"}
                      size="small"
                      sx={{ bgcolor: selected.type === "LAB" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)", color: selected.type === "LAB" ? DOCTOR_BLUE : "#8b5cf6", fontWeight: 600 }}
                    />
                    {selected.status === "READY" ? (
                      <Chip label="Ready" size="small" sx={{ bgcolor: "rgba(16,185,129,0.15)", color: "#16a34a", fontWeight: 700 }} />
                    ) : (
                      <Chip label={selected.type === "LAB" && selected.progress ? `Pending ${selected.progress}` : "Pending"} size="small" sx={{ bgcolor: "rgba(245,158,11,0.15)", color: SEMANTIC.warningDark, fontWeight: 600 }} />
                    )}
                    {(selected.type === "LAB" || selected.type === "RADIOLOGY") && selected.status === "READY" && (
                      selected.verified ? (
                        <Chip icon={<VerifiedRounded sx={{ fontSize: "14px !important" }} />} label="Verified" size="small" sx={{ height: 20, bgcolor: "rgba(16,185,129,0.12)", color: "#0f9d78", fontWeight: 700 }} />
                      ) : (
                        <Chip label="Unverified" size="small" sx={{ height: 20, bgcolor: "rgba(148,163,184,0.2)", color: SEMANTIC.warningDark, fontWeight: 600 }} />
                      )
                    )}
                    {selected.isCritical && (
                      <Chip icon={<WarningAmberRounded sx={{ fontSize: "14px !important" }} />} label="Critical" size="small" color="error" sx={{ height: 20, fontWeight: 700 }} />
                    )}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>{selected.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {selected.patientName}{selected.uhidNumber ? ` · ${selected.uhidNumber}` : ""} · Ordered {fmt(selected.orderDate)}
                  </Typography>
                </Box>
                <IconButton onClick={() => setSelected(null)} size="small"><CloseRounded /></IconButton>
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2.5 }}>
              {selected.type === "LAB" ? <LabDetail reports={selected.reports} /> : <RadiologyDetail item={selected} />}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button startIcon={<PersonRounded />} onClick={() => navigate(`/doctor/patients/${selected.patientId}`)} sx={{ textTransform: "none", mr: "auto" }}>
                Open patient record
              </Button>
              <Button variant="contained" onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

// Closed-loop acknowledgement of a critical result by the ordering clinician.
function AckButton({ report }: { report: any }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  if (report.acknowledgedAt) {
    return <Chip label="Acknowledged" size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: "rgba(16,185,129,0.14)", color: "#0f9d78", ml: 0.5 }} />;
  }
  const ack = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/lab/reports/${report.labReportId}/acknowledge`);
      toast.success("Critical result acknowledged");
      qc.invalidateQueries({ queryKey: ["doctor-results"] });
    } catch (e) { toast.error(getApiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return (
    <Button size="small" variant="outlined" color="error" disabled={saving} onClick={ack}
      sx={{ textTransform: "none", py: 0, px: 1, minWidth: 0, fontSize: "0.65rem", ml: 0.5 }}>
      {saving ? "…" : "Acknowledge"}
    </Button>
  );
}

function LabDetail({ reports }: { reports: any[] }) {
  if (!reports || reports.length === 0) {
    return <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>No test lines on this order.</Typography>;
  }
  return (
    <Grid container spacing={1.5}>
      {reports.map((rep: any) => {
        const critical = rep.isCritical && !rep.pending;
        return (
          <Grid key={rep.labReportId} size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{
              p: 1.75, borderRadius: 2, height: "100%",
              border: "1px solid",
              borderColor: critical ? SEMANTIC.danger : "divider",
              borderLeftWidth: critical ? 3 : 1,
              borderLeftColor: critical ? SEMANTIC.danger : "divider",
              bgcolor: critical ? "rgba(239,68,68,0.04)" : "background.paper",
            }}>
              {/* Test name + prominent result value */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{rep.testName || "Test"}</Typography>
                  {rep.testCode && <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{rep.testCode}</Typography>}
                </Box>
                {rep.pending ? (
                  <Chip label="Pending" size="small" sx={{ bgcolor: "rgba(245,158,11,0.15)", color: SEMANTIC.warningDark, fontWeight: 600, height: 22 }} />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    {critical && <WarningAmberRounded sx={{ color: SEMANTIC.danger, fontSize: 18 }} />}
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, color: critical ? SEMANTIC.danger : "text.primary" }}>
                      {rep.resultValue}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Reference range + acknowledge */}
              {!rep.pending && (
                <Box sx={{ mt: 1.25, pt: 1, borderTop: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Normal range: <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{rep.normalRange || "—"}</Box>
                  </Typography>
                  {critical && <AckButton report={rep} />}
                </Box>
              )}

              {rep.remarks && (
                <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "text.secondary" }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>Remarks:</Box> {rep.remarks}
                </Typography>
              )}
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

function RadiologyDetail({ item }: { item: any }) {
  const url = item.reportUrl ? assetUrl(item.reportUrl) : "";
  const hasReport = item.findings || item.impression || url;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {item.radiologistNotes && (
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Clinical notes (to radiologist)</Typography>
          <Typography variant="body2">{item.radiologistNotes}</Typography>
        </Box>
      )}
      {!hasReport ? (
        <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>Report not available yet.</Typography>
      ) : (
        <>
          {item.findings && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Findings</Typography>
              <Typography variant="body2">{item.findings}</Typography>
            </Box>
          )}
          {item.impression && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Impression</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.impression}</Typography>
            </Box>
          )}
          {url && (
            <Button size="small" variant="outlined" startIcon={<OpenInNewRounded />} href={url} target="_blank" rel="noopener" sx={{ alignSelf: "flex-start", textTransform: "none" }}>
              Open report file
            </Button>
          )}
        </>
      )}
    </Box>
  );
}
