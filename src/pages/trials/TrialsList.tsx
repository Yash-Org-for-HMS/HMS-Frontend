import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  CircularProgress,
  Pagination,
} from "@mui/material";
import {
  AddRounded,
  SearchRounded,
  MoreVertRounded,
  FilterAltRounded,
  CalendarMonthRounded,
  TimerOffRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function TrialsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trials, setTrials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Action Menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);

  const fetchTrials = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/trials", {
        params: { page, limit: 10, search, status: statusFilter }
      });
      setTrials(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch trials", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrials();
  }, [page, search, statusFilter]);

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, trialId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedTrialId(trialId);
  };

  const handleExpireTrial = async () => {
    if (!selectedTrialId) return;
    try {
      await axiosInstance.patch(`/trials/${selectedTrialId}/expire`);
      setAnchorEl(null);
      fetchTrials();
    } catch (error) {
      console.error("Failed to expire trial", error);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedTrialId) return;
    const trial = trials.find(t => t.hospitalTrialId === selectedTrialId);
    if (!trial) return;
    const newEndDate = new Date(new Date(trial.trialEndDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await axiosInstance.patch(`/trials/${selectedTrialId}/extend`, { newEndDate });
      setAnchorEl(null);
      fetchTrials();
    } catch (error) {
      console.error("Failed to extend trial", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "primary";
      case "expired": return "error";
      case "converted": return "success";
      default: return "default";
    }
  };

  const calculateDaysRemaining = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("trials.title")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("trials.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/trials/new")}
          sx={{
            background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            boxShadow: "0 4px 14px 0 rgba(236, 72, 153, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("trials.addTrial")}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("trials.searchPlaceholder")}
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
        <TextField
          select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ ...textFieldSx, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltRounded sx={{ color: "#64748b" }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="active">{t("trials.statusActive")}</MenuItem>
          <MenuItem value="expired">{t("trials.statusExpired")}</MenuItem>
          <MenuItem value="converted">{t("trials.statusConverted")}</MenuItem>
        </TextField>
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
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.6)" }}>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("trials.hospitalName")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("trials.startDate")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("trials.endDate")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("trials.daysRemaining")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("trials.status")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#ec4899" }} />
                  </TableCell>
                </TableRow>
              ) : trials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                trials.map((trial) => (
                  <TableRow key={trial.hospitalTrialId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      {trial.lead?.hospitalName || "Unknown"}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
                      {new Date(trial.trialStartDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
                      {new Date(trial.trialEndDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", fontWeight: 600 }}>
                      {trial.trialStatus === "active" ? calculateDaysRemaining(trial.trialEndDate) : "-"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`trials.status${trial.trialStatus.charAt(0).toUpperCase() + trial.trialStatus.slice(1)}`)}
                        color={getStatusColor(trial.trialStatus) as any}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, trial.hospitalTrialId)} sx={{ color: "#94a3b8" }}>
                        <MoreVertRounded />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "#cbd5e1" },
                "& .Mui-selected": { bgcolor: "rgba(236, 72, 153, 0.2) !important", color: "#f472b6" }
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: "#1e293b", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#f8fafc" } }}
      >
        <MenuItem onClick={handleExtendTrial}>
          <CalendarMonthRounded sx={{ mr: 1.5, fontSize: 20, color: "#60a5fa" }} /> {t("trials.extendTrial")} (14 Days)
        </MenuItem>
        <MenuItem onClick={handleExpireTrial}>
          <TimerOffRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("trials.expireTrial")}
        </MenuItem>
      </Menu>

    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#ec4899" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#ec4899" },
  "& .MuiSvgIcon-root": { color: "#64748b" },
};
