import { useState, useEffect } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { trialStatusColor } from "../../utils/statusColors";
import { useQuery } from "@tanstack/react-query";
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
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AddRounded,
  SearchRounded,
  MoreVertRounded,
  FilterAltRounded,
  CalendarMonthRounded,
  TimerOffRounded,
  RocketLaunchRounded,
  CancelRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useToast } from "../../contexts/ToastContext";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { useServerSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";

// Keep the admin list's existing sentence-case header look (the SortableHeadCell
// default is the reception-panel uppercase style).
const adminHeadSx = { fontWeight: 600, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", bgcolor: "background.paper", color: "text.secondary" } as const;

export default function TrialsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Action Menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTrial, setSelectedTrial] = useState<any | null>(null);
  const confirm = useConfirm();

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  const { data: trialsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trials", page, search, statusFilter, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/trials", { params: { page, limit: 10, search, status: statusFilter, sortBy: orderBy || undefined, sortOrder: order } })).data,
  });
  const trials: any[] = trialsData?.data ?? [];
  const totalPages: number = trialsData?.pagination?.totalPages ?? 1;

  // Reset to the first page whenever the sort changes.
  useEffect(() => {
    setPage(1);
  }, [orderBy, order]);

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, trial: any) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedTrial(trial);
  };

  const handleExpireTrial = async () => {
    const trial = selectedTrial;
    setAnchorEl(null);
    if (!trial) return;
    if (!(await confirm({ title: "Expire trial?", message: `End the trial for ${trial.lead?.hospitalName || "this prospect"} now?`, confirmText: "Expire" }))) return;
    try {
      await axiosInstance.patch(`/trials/${trial.hospitalTrialId}/expire`);
      toast.success("Trial expired");
      refetch();
    } catch (error) {
      toast.error(getApiErrorMessage((error as any), "Failed to expire trial"));
    }
  };

  const handleExtendTrial = async () => {
    const trial = selectedTrial;
    setAnchorEl(null);
    if (!trial) return;
    const newEndDate = new Date(new Date(trial.trialEndDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await axiosInstance.patch(`/trials/${trial.hospitalTrialId}/extend`, { newEndDate });
      toast.success("Trial extended by 14 days");
      refetch();
    } catch (error) {
      toast.error(getApiErrorMessage((error as any), "Failed to extend trial"));
    }
  };

  // Cancel the trial and move the lead to "Lost".
  const handleMarkLost = async () => {
    const trial = selectedTrial;
    setAnchorEl(null);
    if (!trial?.hospitalLeadId) return;
    if (!(await confirm({ title: "Cancel this trial?", message: `Mark ${trial.lead?.hospitalName || "this prospect"} as Lost? The trial ends and the lead moves to Lost.`, confirmText: "Mark as lost" }))) return;
    try {
      await axiosInstance.patch(`/leads/${trial.hospitalLeadId}/status`, { status: "lost" });
      if (trial.trialStatus === "active") {
        await axiosInstance.patch(`/trials/${trial.hospitalTrialId}/expire`).catch(() => {});
      }
      toast.success("Marked as lost");
      refetch();
    } catch (error) {
      toast.error(getApiErrorMessage((error as any), "Failed to update"));
    }
  };

  // Convert through the single "Add Organization" flow, in trial-convert mode —
  // the hospital form opens prefilled from this trial and finalizes the convert.
  const openConvert = () => {
    const trial = selectedTrial;
    setAnchorEl(null);
    if (!trial) return;
    navigate(`/hospitals/new?trialId=${trial.hospitalTrialId}`);
  };


  const calculateDaysRemaining = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("trials.title")}
        subtitle={t("trials.subtitle")}
        actions={
          <ActionButton
            accentFrom="#ec4899"
            accentTo="#db2777"
            startIcon={<AddRounded />}
            onClick={() => navigate("/trials/new")}
          >
            {t("trials.addTrial")}
          </ActionButton>
        }
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("trials.searchPlaceholder")}
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
        <TextField
          select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltRounded sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="active">{t("trials.statusActive")}</MenuItem>
          <MenuItem value="expired">{t("trials.statusExpired")}</MenuItem>
          <MenuItem value="converted">{t("trials.statusConverted")}</MenuItem>
        </TextField>
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
        <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("trials.hospitalName")}</TableCell>
                <SortableHeadCell label={t("trials.startDate")} sortKey="startDate" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <SortableHeadCell label={t("trials.endDate")} sortKey="endDate" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("trials.daysRemaining")}</TableCell>
                <SortableHeadCell label={t("trials.status")} sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : trials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                trials.map((trial) => (
                  <TableRow key={trial.hospitalTrialId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      {trial.lead?.hospitalName || "Unknown"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      {new Date(trial.trialStartDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      {new Date(trial.trialEndDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", fontWeight: 600 }}>
                      {trial.trialStatus === "active" ? calculateDaysRemaining(trial.trialEndDate) : "-"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`trials.status${trial.trialStatus.charAt(0).toUpperCase() + trial.trialStatus.slice(1)}`)}
                        color={trialStatusColor(trial.trialStatus) as any}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, trial)} sx={{ color: "text.secondary" }}>
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "text.primary" },
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
        PaperProps={{ sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", color: "text.primary" } }}
      >
        {selectedTrial?.trialStatus === "converted"
          ? [<MenuItem key="done" disabled>Already converted to a hospital</MenuItem>]
          : [
              <MenuItem key="convert" onClick={openConvert}>
                <RocketLaunchRounded sx={{ mr: 1.5, fontSize: 20, color: "#34d399" }} /> Convert to hospital &amp; assign plan
              </MenuItem>,
              <MenuItem key="extend" onClick={handleExtendTrial}>
                <CalendarMonthRounded sx={{ mr: 1.5, fontSize: 20, color: "#60a5fa" }} /> {t("trials.extendTrial")} (14 Days)
              </MenuItem>,
              selectedTrial?.trialStatus === "active" ? (
                <MenuItem key="expire" onClick={handleExpireTrial}>
                  <TimerOffRounded sx={{ mr: 1.5, fontSize: 20, color: "#f59e0b" }} /> {t("trials.expireTrial")}
                </MenuItem>
              ) : null,
              <MenuItem key="lost" onClick={handleMarkLost} sx={{ color: "#f87171" }}>
                <CancelRounded sx={{ mr: 1.5, fontSize: 20 }} /> Cancel (mark as lost)
              </MenuItem>,
            ]}
      </Menu>

    </PageContainer>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#ec4899" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#ec4899" },
  "& .MuiSvgIcon-root": { color: "text.secondary" },
};
