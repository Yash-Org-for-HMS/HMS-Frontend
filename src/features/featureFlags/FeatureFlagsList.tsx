import { useState, useEffect } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Pagination,
} from "@mui/material";
import {
  AddRounded,
  MoreVertRounded,
  EditRounded,
  DeleteRounded,
  SearchRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ActionButton from "@/components/layout/ActionButton";
import FilterBar from "@/components/layout/FilterBar";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useServerSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";

// Keep the admin list's existing sentence-case header look (the SortableHeadCell
// default is the reception-panel uppercase style).
const adminHeadSx = { fontWeight: 600, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", bgcolor: "background.paper", color: "text.secondary" } as const;

export default function FeatureFlagsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["feature-flags", page, search, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/feature-flags", { params: { page, limit: 10, search, sortBy: orderBy || undefined, sortOrder: order } })).data,
  });
  const flags: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  // Reset to the first page whenever the sort changes.
  useEffect(() => {
    setPage(1);
  }, [orderBy, order]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/feature-flags/${deleteId}`);
      setDeleteId(null);
      refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete feature flag"));
    }
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, flagId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedFlagId(flagId);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("flags.title", "Feature Flags")}
        subtitle={t("flags.subtitle", "Manage hospital-specific feature toggles and overrides")}
        actions={
          <ActionButton
            accentFrom="#f59e0b"
            accentTo="#d97706"
            startIcon={<AddRounded />}
            onClick={() => navigate("/feature-flags/new")}
          >
            {t("flags.addFlag", "Add Flag")}
          </ActionButton>
        }
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("flags.searchPlaceholder", "Search flags by name or key...")}
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
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("flags.hospitalName", "Hospital")}</TableCell>
                <SortableHeadCell label={t("flags.featureName", "Feature")} sortKey="featureName" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <SortableHeadCell label={t("flags.featureKey", "Key")} sortKey="featureKey" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <SortableHeadCell label={t("flags.scope", "Scope")} sortKey="scope" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <SortableHeadCell label={t("flags.status", "Status")} sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={adminHeadSx} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : flags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                flags.map((flag) => (
                  <TableRow key={flag.featureFlagId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      {flag.isGlobal ? <span style={{color: "#60a5fa"}}>Global / All Hospitals</span> : flag.hospital?.hospitalName}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      {flag.featureName}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", fontFamily: "monospace" }}>
                      {flag.featureKey}
                    </TableCell>
                    <TableCell>
                      <Chip label={flag.isGlobal ? "Global" : "Tenant"} size="small" sx={{ bgcolor: flag.isGlobal ? "rgba(59, 130, 246, 0.1)" : "rgba(245, 158, 11, 0.1)", color: flag.isGlobal ? "#60a5fa" : "#fbbf24", fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={flag.isEnabled ? "Enabled" : "Disabled"} size="small" sx={{ bgcolor: flag.isEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: flag.isEnabled ? "#34d399" : "#f87171", fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, flag.featureFlagId)} sx={{ color: "text.secondary" }}>
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
                "& .Mui-selected": { bgcolor: "rgba(245, 158, 11, 0.2) !important", color: "#fbbf24" }
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
        <MenuItem onClick={() => { navigate(`/feature-flags/${selectedFlagId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }} /> {t("common.edit", "Edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedFlagId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete", "Delete")}
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle>{t("flags.deleteFlag", "Delete Flag")}</DialogTitle>
        <DialogContent sx={{ color: "text.primary" }}>
          {t("flags.deleteConfirm", "Are you sure you want to delete this feature flag? This will revert the hospital's access to this feature to the default specified by their plan.")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "text.secondary" }}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete", "Delete")}</Button>
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
    "&.Mui-focused fieldset": { borderColor: "#f59e0b" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#f59e0b" },
  "& .MuiSvgIcon-root": { color: "text.secondary" },
};
