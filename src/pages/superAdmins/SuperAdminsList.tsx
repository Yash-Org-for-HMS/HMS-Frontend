import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  Pagination,
  Avatar,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  SearchRounded,
  LockResetRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { useServerSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import CredentialDialog from "../../components/CredentialDialog";

// Keep the admin list's existing sentence-case header look (the SortableHeadCell
// default is the reception-panel uppercase style).
const adminHeadSx = { fontWeight: 600, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal" } as const;

export default function SuperAdminsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [resetCreds, setResetCreds] = useState<{ email: string; temporaryPassword: string; name: string } | null>(null);

  // Server-side column sorting (the list is paginated, so sorting happens in the DB).
  const { orderBy, order, onSort } = useServerSort();

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["super-admins", page, search, orderBy, order],
    queryFn: async () => (await axiosInstance.get("/super-admins", { params: { page, limit: 10, search, sortBy: orderBy || undefined, sortOrder: order } })).data,
  });

  // Reset to the first page whenever the sort changes.
  useEffect(() => {
    setPage(1);
  }, [orderBy, order]);
  const admins: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  // Peer password recovery: any super admin can reset another's password —
  // the platform-realm equivalent of the hospital admin resetting their own
  // staff's passwords in Staff & Users. Immediately invalidates the current
  // password, so confirm before firing.
  const resetPassword = useMutation({
    mutationFn: async (id: string) => (await axiosInstance.post(`/super-admins/${id}/reset-password`)).data.data,
    onSuccess: (creds) => setResetCreds({ email: creds.email, temporaryPassword: creds.temporaryPassword, name: `${creds.firstName} ${creds.lastName}`.trim() }),
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to reset password"),
  });

  const handleResetPassword = async (admin: any) => {
    const ok = await confirm({
      title: "Reset password",
      message: `Reset the password for ${admin.firstName} ${admin.lastName} (${admin.email})? Their current password stops working immediately — you'll get a new one-time password to share with them.`,
      confirmText: "Reset password",
      destructive: true,
    });
    if (ok) resetPassword.mutate(admin.superAdminId);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("superAdmins.title", "Super Admins")}
        subtitle={t("superAdmins.subtitle", "Manage global system administrators")}
        actions={
          <ActionButton
            accentFrom="#8b5cf6"
            accentTo="#6d28d9"
            startIcon={<AddRounded />}
            onClick={() => navigate("/super-admins/new")}
          >
            {t("superAdmins.addAdmin", "Add Admin")}
          </ActionButton>
        }
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("superAdmins.searchPlaceholder", "Search by name or email...")}
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
                <SortableHeadCell label={t("superAdmins.name", "Admin")} sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={{ ...adminHeadSx, bgcolor: "background.paper" }} />
                <SortableHeadCell label={t("superAdmins.phone", "Phone")} sortKey="phone" orderBy={orderBy} order={order} onSort={onSort} sx={{ ...adminHeadSx, bgcolor: "background.paper" }} />
                <SortableHeadCell label={t("superAdmins.status", "Status")} sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={{ ...adminHeadSx, bgcolor: "background.paper" }} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton rows={6} columns={4} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.superAdminId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar sx={{ bgcolor: "rgba(139, 92, 246, 0.2)", color: "#c4b5fd" }}>
                          {admin.firstName[0]}{admin.lastName[0]}
                        </Avatar>
                        <Box>
                          {admin.firstName} {admin.lastName}
                          <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                            {admin.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      {admin.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={admin.status} 
                        size="small" 
                        sx={{ 
                          bgcolor: admin.status === "active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                          color: admin.status === "active" ? "#34d399" : "#f87171",
                          textTransform: "capitalize",
                          fontWeight: 600 
                        }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Reset Password">
                        <IconButton
                          onClick={() => handleResetPassword(admin)}
                          disabled={resetPassword.isPending}
                          sx={{ color: "text.secondary", "&:hover": { color: "#fbbf24", bgcolor: "rgba(234,179,8,0.1)" } }}
                        >
                          <LockResetRounded />
                        </IconButton>
                      </Tooltip>
                      <IconButton onClick={() => navigate(`/super-admins/${admin.superAdminId}/edit`)} sx={{ color: "text.secondary" }}>
                        <EditRounded />
                      </IconButton>
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
                "& .Mui-selected": { bgcolor: "rgba(139, 92, 246, 0.2) !important", color: "#c4b5fd" }
              }}
            />
          </Box>
        )}
      </Paper>

      {resetCreds && (
        <CredentialDialog
          open={!!resetCreds}
          onClose={() => setResetCreds(null)}
          email={resetCreds.email}
          password={resetCreds.temporaryPassword}
          name={resetCreds.name}
          title="Password Reset"
          note="This password is shown only once. Copy it and share it with them securely."
        />
      )}
    </PageContainer>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#8b5cf6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
