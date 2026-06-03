import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from "@mui/material";
import { InfoRounded, SearchRounded, RefreshRounded } from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    moduleName: "",
    actionType: "",
    startDate: "",
    endDate: "",
  });

  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    // Generate samples if needed, then fetch
    const init = async () => {
      try {
        await axiosInstance.post("/hospital/audit-logs/generate-samples");
        fetchLogs();
      } catch (err) {
        fetchLogs();
      }
    };
    init();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.moduleName) params.append("moduleName", filters.moduleName);
      if (filters.actionType) params.append("actionType", filters.actionType);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const res = await axiosInstance.get(`/hospital/audit-logs?${params.toString()}`);
      setLogs(res.data.data);
    } catch (err: any) {
      setError("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return { bg: "rgba(16, 185, 129, 0.1)", text: "#34d399" };
      case "UPDATE": return { bg: "rgba(56, 189, 248, 0.1)", text: "#38bdf8" };
      case "DELETE": return { bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e" };
      default: return { bg: "rgba(255, 255, 255, 0.1)", text: "#cbd5e1" };
    }
  };

  const textFieldProps = {
    fullWidth: true,
    size: "small" as const,
    InputLabelProps: { style: { color: "#94a3b8" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "#f1f5f9",
        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "#94a3b8" }
      },
    },
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
          Audit & Activity Logs
        </Typography>
        <Typography variant="body1" sx={{ color: "#94a3b8" }}>
          Monitor system events, user actions, and security changes.
        </Typography>
      </Box>

      {/* Filters */}
      <Paper component="form" onSubmit={handleSearch} sx={{ p: 3, mb: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Module"
              name="moduleName"
              value={filters.moduleName}
              onChange={handleFilterChange}
              {...textFieldProps}
            >
              <MenuItem value="">All Modules</MenuItem>
              <MenuItem value="Users">Users</MenuItem>
              <MenuItem value="Roles">Roles</MenuItem>
              <MenuItem value="Departments">Departments</MenuItem>
              <MenuItem value="Settings">Settings</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Action Type"
              name="actionType"
              value={filters.actionType}
              onChange={handleFilterChange}
              {...textFieldProps}
            >
              <MenuItem value="">All Actions</MenuItem>
              <MenuItem value="CREATE">Create</MenuItem>
              <MenuItem value="UPDATE">Update</MenuItem>
              <MenuItem value="DELETE">Delete</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              type="date"
              label="Start Date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              {...textFieldProps}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              type="date"
              label="End Date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              {...textFieldProps}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              startIcon={<SearchRounded />}
              sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1 }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "flex-end" }}>
          <Button startIcon={<RefreshRounded />} onClick={fetchLogs} sx={{ color: "#94a3b8" }}>Refresh</Button>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#6366f1" }} />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>Timestamp</TableCell>
                  <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>User</TableCell>
                  <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>Module</TableCell>
                  <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>Action</TableCell>
                  <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: "#94a3b8", borderBottom: "none" }}>
                      No audit logs found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const actionColors = getActionColor(log.actionType);
                    return (
                      <TableRow key={log.auditLogId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f8fafc", fontWeight: 500 }}>
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                          {log.moduleName} ({log.tableName})
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <Chip label={log.actionType} size="small" sx={{ bgcolor: actionColors.bg, color: actionColors.text, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <Tooltip title="View JSON Diff">
                            <IconButton
                              size="small"
                              onClick={() => setSelectedLog(log)}
                              sx={{ color: "#6366f1", "&:hover": { bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                            >
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

      {/* Details Modal */}
      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: "#0f172a", color: "#f1f5f9" } }}>
        <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          Audit Log Details
          <Typography variant="body2" sx={{ color: "#94a3b8" }}>ID: {selectedLog?.auditLogId}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", p: 3, gap: 4, bgcolor: "#1e293b" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b" }}>User ID</Typography>
              <Typography sx={{ color: "#f1f5f9" }}>{selectedLog?.userId}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b" }}>Module</Typography>
              <Typography sx={{ color: "#f1f5f9" }}>{selectedLog?.moduleName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b" }}>Action</Typography>
              <Typography sx={{ color: "#f1f5f9" }}>{selectedLog?.actionType}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b" }}>Timestamp</Typography>
              <Typography sx={{ color: "#f1f5f9" }}>{selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : ""}</Typography>
            </Box>
          </Box>
          
          <Grid container sx={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ p: 3, borderRight: { md: "1px solid rgba(255,255,255,0.05)" }, borderBottom: { xs: "1px solid rgba(255,255,255,0.05)", md: "none" } }}>
              <Typography variant="subtitle2" sx={{ color: "#f87171", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f87171" }} /> Old Value
              </Typography>
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "#0f172a", borderRadius: 1, overflowX: "auto", fontSize: "0.85rem", color: "#cbd5e1" }}>
                {JSON.stringify(selectedLog?.oldValueJson, null, 2)}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ color: "#34d399", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#34d399" }} /> New Value
              </Typography>
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "#0f172a", borderRadius: 1, overflowX: "auto", fontSize: "0.85rem", color: "#cbd5e1" }}>
                {JSON.stringify(selectedLog?.newValueJson, null, 2)}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <Button onClick={() => setSelectedLog(null)} sx={{ color: "#94a3b8" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
