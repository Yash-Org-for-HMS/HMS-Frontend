import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Pagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { SearchRounded, VisibilityRounded, CloseRounded } from "@mui/icons-material";
import Grid from "@mui/material/Grid";
import { axiosInstance } from "../../api/axios";

export default function AuditLogsList() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/audit-logs", {
        params: { page, limit: 15, search }
      });
      setLogs(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, search]);

  const getActionColor = (action: string) => {
    switch(action) {
      case "CREATE": return { bg: "rgba(16, 185, 129, 0.1)", text: "#34d399" };
      case "UPDATE": return { bg: "rgba(59, 130, 246, 0.1)", text: "#60a5fa" };
      case "DELETE": return { bg: "rgba(239, 68, 68, 0.1)", text: "#f87171" };
      case "LOGIN": return { bg: "rgba(20, 184, 166, 0.1)", text: "#2dd4bf" };
      case "LOGOUT": return { bg: "rgba(100, 116, 139, 0.1)", text: "#94a3b8" };
      default: return { bg: "rgba(245, 158, 11, 0.1)", text: "#fbbf24" };
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("auditLogs.title", "System Audit Logs")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("auditLogs.subtitle", "Track all sensitive actions across the platform")}
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("auditLogs.searchPlaceholder", "Search by user or table...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={textFieldSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "#64748b" }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          bgcolor: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.6)" }}>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.timestamp", "Timestamp")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.hospital", "Hospital")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.user", "User ID")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.action", "Action")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.module", "Module")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("auditLogs.ip", "IP Address")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.details", "Details")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#3b82f6" }} />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const colors = getActionColor(log.actionType);
                  return (
                    <TableRow key={log.auditLogId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                      <TableCell sx={{ color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: "#f8fafc" }}>
                        {log.hospitalId === "PLATFORM" ? (
                          <Chip label="Platform" size="small" sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#c4b5fd" }} />
                        ) : (
                          <Typography variant="body2">{log.hospital?.hospitalName || log.hospitalId}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {log.userId.split("-")[0]}...
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.actionType} 
                          size="small" 
                          sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 700, fontSize: "0.7rem" }} 
                        />
                      </TableCell>
                      <TableCell sx={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                        {log.moduleName} <br />
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b" }}>{log.tableName}</span>
                      </TableCell>
                      <TableCell sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {log.ipAddress || "—"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => setSelectedLog(log)} sx={{ color: "#94a3b8" }} size="small">
                          <VisibilityRounded fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "#cbd5e1" },
                "& .Mui-selected": { bgcolor: "rgba(59, 130, 246, 0.2) !important", color: "#60a5fa" }
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Detail Dialog */}
      <Dialog 
        open={Boolean(selectedLog)} 
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "#1e293b",
            color: "#f8fafc",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)"
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Audit Log Details
          <IconButton onClick={() => setSelectedLog(null)} sx={{ color: "#94a3b8" }}><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, mt: 2 }}>
          {selectedLog && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: "#94a3b8" }}>Module / Table</Typography>
                <Typography sx={{ mb: 2 }}>{selectedLog.moduleName} / {selectedLog.tableName}</Typography>
                
                <Typography variant="overline" sx={{ color: "#94a3b8" }}>Action Type</Typography>
                <Typography sx={{ mb: 2 }}>{selectedLog.actionType}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: "#94a3b8" }}>User ID</Typography>
                <Typography sx={{ mb: 2, fontFamily: "monospace", color: "#cbd5e1" }}>{selectedLog.userId}</Typography>
                
                <Typography variant="overline" sx={{ color: "#94a3b8" }}>Device Info</Typography>
                <Typography sx={{ mb: 2, fontSize: "0.85rem", color: "#94a3b8" }}>{selectedLog.deviceInfo || "—"}</Typography>
              </Grid>
              
              {(selectedLog.oldValueJson || selectedLog.newValueJson) && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
                    {selectedLog.oldValueJson && (
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" sx={{ color: "#f87171" }}>Old Value</Typography>
                        <Box sx={{ p: 2, bgcolor: "rgba(15,23,42,0.5)", borderRadius: 2, border: "1px solid rgba(239,68,68,0.2)", overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem" }}>
                            {JSON.stringify(selectedLog.oldValueJson, null, 2)}
                          </pre>
                        </Box>
                      </Box>
                    )}
                    {selectedLog.newValueJson && (
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" sx={{ color: "#34d399" }}>New Value</Typography>
                        <Box sx={{ p: 2, bgcolor: "rgba(15,23,42,0.5)", borderRadius: 2, border: "1px solid rgba(16,185,129,0.2)", overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem" }}>
                            {JSON.stringify(selectedLog.newValueJson, null, 2)}
                          </pre>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid rgba(255,255,255,0.1)", p: 2 }}>
          <Button onClick={() => setSelectedLog(null)} sx={{ color: "#cbd5e1" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
};
