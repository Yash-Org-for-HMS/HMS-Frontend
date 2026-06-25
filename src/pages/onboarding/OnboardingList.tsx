import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  CircularProgress,
  TextField,
  InputAdornment,
  Pagination,
  Switch,
  MenuItem,
} from "@mui/material";
import {
  SearchRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";

export default function OnboardingList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const queryKey = ["onboarding", page, search];
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await axiosInstance.get("/onboarding", { params: { page, limit: 10, search } })).data,
  });
  const onboardings: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  const handleInlineUpdate = async (onboardingId: string, updatedFields: any) => {
    const record = onboardings.find(o => o.hospitalOnboardingId === onboardingId);
    if (!record) return;

    const payload = {
      tenantSetupCompleted: record.tenantSetupCompleted,
      defaultRolesSeeded: record.defaultRolesSeeded,
      paymentVerified: record.paymentVerified,
      onboardingStatus: record.onboardingStatus,
      ...updatedFields
    };

    // Optimistic update in the query cache so the toggle responds instantly.
    qc.setQueryData(queryKey, (old: any) =>
      old
        ? { ...old, data: old.data.map((o: any) => (o.hospitalOnboardingId === onboardingId ? { ...o, ...payload } : o)) }
        : old
    );

    try {
      await axiosInstance.put(`/onboarding/${onboardingId}`, payload);
      qc.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to update onboarding");
      refetch(); // roll back to server truth
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "completed": return "#34d399";
      case "in_progress": return "#60a5fa";
      case "pending": return "#fbbf24";
      case "stalled": return "#f87171";
      default: return "#cbd5e1";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "completed": return "rgba(16, 185, 129, 0.15)";
      case "in_progress": return "rgba(96, 165, 250, 0.15)";
      case "pending": return "rgba(251, 191, 36, 0.15)";
      case "stalled": return "rgba(248, 113, 113, 0.15)";
      default: return "rgba(255, 255, 255, 0.05)";
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("onboarding.title", "Hospital Onboarding Tracker")}
        subtitle={t("onboarding.subtitle", "Track setup and provisioning progress for new tenants")}
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("onboarding.searchPlaceholder", "Search by hospital name...")}
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
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("onboarding.hospital", "Hospital")}</TableCell>
                <TableCell align="center" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("onboarding.tenantSetup", "Tenant Setup")}</TableCell>
                <TableCell align="center" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("onboarding.rolesSeeded", "Roles Seeded")}</TableCell>
                <TableCell align="center" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("onboarding.paymentVerified", "Payment Verified")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("onboarding.status", "Overall Status")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "primary.main" }} />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : onboardings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                onboardings.map((record) => (
                  <TableRow key={record.hospitalOnboardingId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      {record.hospital?.hospitalName}
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontFamily: "monospace" }}>
                        {record.hospital?.hospitalCode}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={record.tenantSetupCompleted}
                        onChange={(e) => handleInlineUpdate(record.hospitalOnboardingId, { tenantSetupCompleted: e.target.checked })}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={record.defaultRolesSeeded}
                        onChange={(e) => handleInlineUpdate(record.hospitalOnboardingId, { defaultRolesSeeded: e.target.checked })}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={record.paymentVerified}
                        onChange={(e) => handleInlineUpdate(record.hospitalOnboardingId, { paymentVerified: e.target.checked })}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={record.onboardingStatus}
                        onChange={(e) => handleInlineUpdate(record.hospitalOnboardingId, { onboardingStatus: e.target.value })}
                        size="small"
                        sx={{
                          minWidth: 130,
                          "& .MuiOutlinedInput-root": {
                            color: getStatusTextColor(record.onboardingStatus),
                            backgroundColor: getStatusBgColor(record.onboardingStatus),
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            "& fieldset": { borderColor: "transparent" },
                            "&:hover fieldset": { borderColor: "divider" },
                            "&.Mui-focused fieldset": { borderColor: "divider" },
                          },
                          "& .MuiSvgIcon-root": { color: getStatusTextColor(record.onboardingStatus) }
                        }}
                        SelectProps={{
                          MenuProps: {
                            sx: {
                              "& .MuiPaper-root": {
                                bgcolor: "background.paper",
                                color: "text.primary",
                                border: "1px solid", borderColor: "divider"
                              }
                            }
                          }
                        }}
                      >
                        <MenuItem value="pending" sx={{ fontWeight: 600, color: "#fbbf24" }}>Pending</MenuItem>
                        <MenuItem value="in_progress" sx={{ fontWeight: 600, color: "#60a5fa" }}>In Progress</MenuItem>
                        <MenuItem value="completed" sx={{ fontWeight: 600, color: "#34d399" }}>Completed</MenuItem>
                        <MenuItem value="stalled" sx={{ fontWeight: 600, color: "#f87171" }}>Stalled</MenuItem>
                      </TextField>
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
                "& .Mui-selected": { bgcolor: "rgba(16, 185, 129, 0.2) !important", color: "#10b981" }
              }}
            />
          </Box>
        )}
      </Paper>
    </PageContainer>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#10b981" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
