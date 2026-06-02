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

export default function OnboardingList() {
  const { t } = useTranslation();
  const [onboardings, setOnboardings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchOnboardings = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/onboarding", {
        params: { page, limit: 10, search }
      });
      setOnboardings(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch onboarding records", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnboardings();
  }, [page, search]);

  const handleInlineUpdate = async (onboardingId: string, updatedFields: any) => {
    try {
      const record = onboardings.find(o => o.hospitalOnboardingId === onboardingId);
      if (!record) return;

      const payload = {
        tenantSetupCompleted: record.tenantSetupCompleted,
        defaultRolesSeeded: record.defaultRolesSeeded,
        paymentVerified: record.paymentVerified,
        onboardingStatus: record.onboardingStatus,
        ...updatedFields
      };

      setOnboardings(prev =>
        prev.map(o =>
          o.hospitalOnboardingId === onboardingId
            ? { ...o, ...payload }
            : o
        )
      );

      await axiosInstance.put(`/onboarding/${onboardingId}`, payload);
      
      const response = await axiosInstance.get("/onboarding", {
        params: { page, limit: 10, search }
      });
      setOnboardings(response.data.data);
    } catch (error) {
      console.error("Failed to update onboarding inline", error);
      fetchOnboardings();
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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("onboarding.title", "Hospital Onboarding Tracker")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("onboarding.subtitle", "Track setup and provisioning progress for new tenants")}
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("onboarding.searchPlaceholder", "Search by hospital name...")}
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
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.6)" }}>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("onboarding.hospital", "Hospital")}</TableCell>
                <TableCell align="center" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("onboarding.tenantSetup", "Tenant Setup")}</TableCell>
                <TableCell align="center" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("onboarding.rolesSeeded", "Roles Seeded")}</TableCell>
                <TableCell align="center" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("onboarding.paymentVerified", "Payment Verified")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("onboarding.status", "Overall Status")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#10b981" }} />
                  </TableCell>
                </TableRow>
              ) : onboardings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                onboardings.map((record) => (
                  <TableRow key={record.hospitalOnboardingId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      {record.hospital?.hospitalName}
                      <Typography variant="caption" sx={{ display: "block", color: "#94a3b8", fontFamily: "monospace" }}>
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
                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                            "&.Mui-focused fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                          },
                          "& .MuiSvgIcon-root": { color: getStatusTextColor(record.onboardingStatus) }
                        }}
                        SelectProps={{
                          MenuProps: {
                            sx: {
                              "& .MuiPaper-root": {
                                bgcolor: "#1e293b",
                                color: "#f8fafc",
                                border: "1px solid rgba(255, 255, 255, 0.1)"
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "#cbd5e1" },
                "& .Mui-selected": { bgcolor: "rgba(16, 185, 129, 0.2) !important", color: "#10b981" }
              }}
            />
          </Box>
        )}
      </Paper>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#10b981" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
};
