import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Grid,
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
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import PageHeader from "../../../components/layout/PageHeader";
import { ListSkeleton } from "../../../components/TableRowsSkeleton";

const EMPTY_FILTERS = { moduleName: "", actionType: "", startDate: "", endDate: "" };

export default function AuditLogs() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Filters are applied only on explicit "Search" (not as-you-type), so the
  // query keys off a separate "applied" snapshot.
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["hospital-audit-logs", appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedFilters.moduleName) params.append("moduleName", appliedFilters.moduleName);
      if (appliedFilters.actionType) params.append("actionType", appliedFilters.actionType);
      if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
      return (await axiosInstance.get(`/hospital/audit-logs?${params.toString()}`)).data.data;
    },
  });

  // Seed sample logs once (dev convenience), then refresh.
  useEffect(() => {
    axiosInstance.post("/hospital/audit-logs/generate-samples").finally(() => refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters(filters);
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
    InputLabelProps: { style: { color: "text.secondary" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "text.primary",
        "& fieldset": { borderColor: "divider" },
        "&:hover fieldset": { borderColor: "divider" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "text.secondary" }
      },
    },
  };

  return (
    <Box>
      <PageHeader
        title="Audit & Activity Logs"
        subtitle="Monitor system events, user actions, and security changes."
      />

      {/* Filters */}
      <Paper component="form" onSubmit={handleSearch} sx={{ p: 3, mb: 4, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
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
<Paper sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "flex-end" }}>
          <Button startIcon={<RefreshRounded />} onClick={() => refetch()} sx={{ color: "text.secondary" }}>Refresh</Button>
        </Box>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <ListSkeleton rows={6} />
          </Box>
        ) : isError ? (
          <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Timestamp</TableCell>
                  <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>User</TableCell>
                  <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Module</TableCell>
                  <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Action</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 3, borderBottom: "none" }}>
                      <Mascot pose="no-matches" subtitle="No audit logs found matching criteria." size={120} />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const actionColors = getActionColor(log.actionType);
                    return (
                      <TableRow key={log.auditLogId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 500 }}>
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary" }}>
                          {log.moduleName} ({log.tableName})
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Chip label={log.actionType} size="small" sx={{ bgcolor: actionColors.bg, color: actionColors.text, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary" } }}>
        <DialogTitle sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          Audit Log Details
          <Typography variant="body2" sx={{ color: "text.secondary" }}>ID: {selectedLog?.auditLogId}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", p: 3, gap: 4, bgcolor: "background.paper" }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>User ID</Typography>
              <Typography sx={{ color: "text.primary" }}>{selectedLog?.userId}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Module</Typography>
              <Typography sx={{ color: "text.primary" }}>{selectedLog?.moduleName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Action</Typography>
              <Typography sx={{ color: "text.primary" }}>{selectedLog?.actionType}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Timestamp</Typography>
              <Typography sx={{ color: "text.primary" }}>{selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : ""}</Typography>
            </Box>
          </Box>
          
          <Grid container sx={{ borderTop: "1px solid", borderColor: "divider" }}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ p: 3, borderRight: { md: "1px solid rgba(255,255,255,0.05)" }, borderBottom: { xs: "1px solid rgba(255,255,255,0.05)", md: "none" } }}>
              <Typography variant="subtitle2" sx={{ color: "#f87171", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f87171" }} /> Old Value
              </Typography>
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "background.paper", borderRadius: 1, overflowX: "auto", fontSize: "0.85rem", color: "text.primary" }}>
                {JSON.stringify(selectedLog?.oldValueJson, null, 2)}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ color: "#34d399", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#34d399" }} /> New Value
              </Typography>
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "background.paper", borderRadius: 1, overflowX: "auto", fontSize: "0.85rem", color: "text.primary" }}>
                {JSON.stringify(selectedLog?.newValueJson, null, 2)}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setSelectedLog(null)} sx={{ color: "text.secondary" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
