import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  FormControlLabel,
  Switch,
} from "@mui/material";
import { SearchRounded, VisibilityRounded, CloseRounded } from "@mui/icons-material";
import Grid from "@mui/material/Grid";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";
import { useAuth } from "../../contexts/AuthContext";

export default function AuditLogsList() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showMyActions, setShowMyActions] = useState(false);

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["audit-logs", page, search, showMyActions, user?.id],
    queryFn: async () => {
      const params: any = { page, limit: 15, search };
      if (showMyActions && user?.id) params.userId = user.id;
      return (await axiosInstance.get("/audit-logs", { params })).data;
    },
  });
  const logs: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

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
    <PageContainer>
      <PageHeader
        title={t("auditLogs.title", "System Audit Logs")}
        subtitle={t("auditLogs.subtitle", "Track all sensitive actions across the platform")}
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("auditLogs.searchPlaceholder", "Search by user or table...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        />
        
        <FormControlLabel
          control={
            <Switch 
              checked={showMyActions} 
              onChange={(e) => setShowMyActions(e.target.checked)} 
              color="primary"
            />
          }
          label={<Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>My Actions Only</Typography>}
          sx={{ ml: 2 }}
        />
      </FilterBar>

      <Paper
        elevation={2}
        sx={{
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
          border: "1px solid", borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.timestamp", "Timestamp")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.hospital", "Hospital")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.user", "User ID")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.action", "Action")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.module", "Module")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("auditLogs.ip", "IP Address")}</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("common.details", "Details")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "primary.main" }} />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const colors = getActionColor(log.actionType);
                  return (
                    <TableRow key={log.auditLogId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                      <TableCell sx={{ color: "text.primary", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: "text.primary" }}>
                        {log.hospitalId === "PLATFORM" ? (
                          <Chip label="Platform" size="small" sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#c4b5fd" }} />
                        ) : (
                          <Typography variant="body2">{log.hospital?.hospitalName || log.hospitalId}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {log.userId.split("-")[0]}...
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.actionType} 
                          size="small" 
                          sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 700, fontSize: "0.7rem" }} 
                        />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                        {log.moduleName} <br />
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>{log.tableName}</span>
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {log.ipAddress || "—"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => setSelectedLog(log)} sx={{ color: "text.secondary" }} size="small">
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "text.primary" },
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
            bgcolor: "background.paper",
            color: "text.primary",
            borderRadius: 3,
            border: "1px solid", borderColor: "divider"
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Audit Log Details
          <IconButton onClick={() => setSelectedLog(null)} sx={{ color: "text.secondary" }}><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, mt: 2 }}>
          {selectedLog && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: "text.secondary" }}>Module / Table</Typography>
                <Typography sx={{ mb: 2 }}>{selectedLog.moduleName} / {selectedLog.tableName}</Typography>
                
                <Typography variant="overline" sx={{ color: "text.secondary" }}>Action Type</Typography>
                <Typography sx={{ mb: 2 }}>{selectedLog.actionType}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: "text.secondary" }}>User ID</Typography>
                <Typography sx={{ mb: 2, fontFamily: "monospace", color: "text.primary" }}>{selectedLog.userId}</Typography>
                
                <Typography variant="overline" sx={{ color: "text.secondary" }}>Device Info</Typography>
                <Typography sx={{ mb: 2, fontSize: "0.85rem", color: "text.secondary" }}>{selectedLog.deviceInfo || "—"}</Typography>
              </Grid>
              
              {(selectedLog.oldValueJson || selectedLog.newValueJson) && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
                    {selectedLog.oldValueJson && (
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" sx={{ color: "#f87171" }}>Old Value</Typography>
                        <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2, border: "1px solid rgba(239,68,68,0.2)", overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: "text.primary", fontSize: "0.85rem" }}>
                            {JSON.stringify(selectedLog.oldValueJson, null, 2)}
                          </pre>
                        </Box>
                      </Box>
                    )}
                    {selectedLog.newValueJson && (
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" sx={{ color: "#34d399" }}>New Value</Typography>
                        <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2, border: "1px solid rgba(16,185,129,0.2)", overflowX: "auto" }}>
                          <pre style={{ margin: 0, color: "text.primary", fontSize: "0.85rem" }}>
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
        <DialogActions sx={{ borderTop: "1px solid", borderColor: "divider", p: 2 }}>
          <Button onClick={() => setSelectedLog(null)} sx={{ color: "text.primary" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
