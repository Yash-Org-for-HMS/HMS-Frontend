import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HeartbeatLoader from "../../components/HeartbeatLoader";
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
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  Tooltip,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  WidgetsRounded,
  SearchRounded,
  DeleteOutlineRounded,
  RestoreRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
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
const adminHeadSx = { fontWeight: 600, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal" } as const;

export default function HospitalsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0); // 0 = Active, 1 = Deleted

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; hospital: any | null }>({
    open: false,
    hospital: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["hospitals", page, search, activeTab, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/hospitals", {
        params: {
          page, limit: 10, search,
          sortBy: orderBy || undefined, sortOrder: order,
          ...(activeTab === 1 ? { showDeleted: "true" } : {}),
        },
      })).data,
  });
  const hospitals: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  // Reset to the first page whenever the tab or sort changes.
  useEffect(() => {
    setPage(1);
  }, [activeTab, orderBy, order]);

  const handleDelete = async () => {
    if (!deleteDialog.hospital) return;
    setActionLoading(true);
    try {
      await axiosInstance.delete(`/hospitals/${deleteDialog.hospital.hospitalId}`);
      setDeleteDialog({ open: false, hospital: null });
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to delete hospital");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (hospitalId: string) => {
    setActionLoading(true);
    try {
      await axiosInstance.put(`/hospitals/${hospitalId}/restore`);
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to restore hospital");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("hospitals.title", "Hospitals Directory")}
        subtitle={t("hospitals.subtitle", "Manage all hospital tenants and their subscriptions")}
        actions={
          <ActionButton
            accentFrom="#3b82f6"
            accentTo="#2563eb"
            startIcon={<AddRounded />}
            onClick={() => navigate("/hospitals/new")}
          >
            {t("hospitals.addHospital", "Add Hospital")}
          </ActionButton>
        }
      />

      {/* Tabs: Active / Deleted */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, color: "text.secondary" },
            "& .Mui-selected": { color: "primary.main" },
          }}
        >
          <Tab label="Active Hospitals" />
          <Tab label="Deleted Hospitals" />
        </Tabs>
      </Box>

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("hospitals.searchPlaceholder", "Search by name, code, or email...")}
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
                <SortableHeadCell label={t("hospitals.code", "Code")} sortKey="code" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <SortableHeadCell label={t("hospitals.name", "Hospital Name")} sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("hospitals.plan", "Plan")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("hospitals.branches", "Branches")}</TableCell>
                <SortableHeadCell label={t("hospitals.status", "Status")} sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {activeTab === 1 ? "No deleted hospitals found" : t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((hospital) => (
                  <TableRow key={hospital.hospitalId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontWeight: 600 }}>
                      {hospital.hospitalCode}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      <Box>
                        {hospital.hospitalName}
                        <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                          {hospital.officialEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {hospital.branches && hospital.branches.length > 0 ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          {hospital.branches.map((b: any) => (
                            <Box key={b.branchId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600 }}>
                                {b.branchName}:
                              </Typography>
                              <Chip
                                label={b.subscriptionPlan?.planName || "No Plan"}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: "0.75rem",
                                  bgcolor: "rgba(59, 130, 246, 0.1)",
                                  color: "#60a5fa"
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          No Branches / Plans
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "text.primary" }}>{hospital._count?.branches || 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={hospital.isDeleted ? "Deleted" : hospital.status} 
                        size="small" 
                        sx={{ 
                          bgcolor: hospital.isDeleted
                            ? "rgba(239, 68, 68, 0.1)"
                            : hospital.status === "active"
                              ? "rgba(16, 185, 129, 0.1)"
                              : "rgba(245, 158, 11, 0.1)",
                          color: hospital.isDeleted
                            ? "#f87171"
                            : hospital.status === "active"
                              ? "#34d399"
                              : "#fbbf24",
                          textTransform: "capitalize",
                          fontWeight: 600 
                        }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      {activeTab === 0 ? (
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                          <Tooltip title="View Overview">
                            <IconButton
                              onClick={() => navigate(`/hospitals/${hospital.hospitalId}/overview`)}
                              sx={{ color: "#3b82f6" }}
                            >
                              <VisibilityRounded />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Module Access">
                            <IconButton
                              onClick={() => navigate(`/hospitals/${hospital.hospitalId}/modules`)}
                              sx={{ color: "#8b5cf6" }}
                            >
                              <WidgetsRounded />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              onClick={() => navigate(`/hospitals/${hospital.hospitalId}/edit`)}
                              sx={{ color: "text.secondary" }}
                            >
                              <EditRounded />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              onClick={() => setDeleteDialog({ open: true, hospital })}
                              sx={{ color: "#ef4444", "&:hover": { bgcolor: "rgba(239, 68, 68, 0.08)" } }}
                            >
                              <DeleteOutlineRounded />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Tooltip title="Restore Hospital">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RestoreRounded />}
                            onClick={() => handleRestore(hospital.hospitalId)}
                            disabled={actionLoading}
                            sx={{
                              color: "#10b981",
                              borderColor: "rgba(16, 185, 129, 0.4)",
                              textTransform: "none",
                              fontWeight: 600,
                              "&:hover": { borderColor: "#10b981", bgcolor: "rgba(16, 185, 129, 0.08)" },
                            }}
                          >
                            Restore
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, hospital: null })}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            minWidth: 420,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "text.primary", pb: 1 }}>
          Delete Hospital
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary" }}>
            Are you sure you want to delete{" "}
            <strong style={{ color: "#ef4444" }}>
              {deleteDialog.hospital?.hospitalName}
            </strong>
            ? The hospital will be marked as inactive and hidden from the active list. You can restore it later from the "Deleted Hospitals" tab.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, hospital: null })}
            disabled={actionLoading}
            sx={{ color: "text.secondary", textTransform: "none", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={actionLoading}
            variant="contained"
            startIcon={actionLoading ? <HeartbeatLoader size={22} /> : <DeleteOutlineRounded />}
            sx={{
              bgcolor: "#ef4444",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#dc2626" },
            }}
          >
            {actionLoading ? "Deleting..." : "Delete Hospital"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
