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
  CircularProgress,
  TextField,
  InputAdornment,
  Pagination,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  SearchRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function HospitalsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/hospitals", {
        params: { page, limit: 10, search }
      });
      setHospitals(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch hospitals", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, [page, search]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("hospitals.title", "Hospitals Directory")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("hospitals.subtitle", "Manage all hospital tenants and their subscriptions")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/hospitals/new")}
          sx={{
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("hospitals.addHospital", "Add Hospital")}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("hospitals.searchPlaceholder", "Search by name, code, or email...")}
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
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("hospitals.code", "Code")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("hospitals.name", "Hospital Name")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("hospitals.plan", "Plan")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("hospitals.branches", "Branches")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("hospitals.status", "Status")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#3b82f6" }} />
                  </TableCell>
                </TableRow>
              ) : hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((hospital) => (
                  <TableRow key={hospital.hospitalId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#cbd5e1", fontFamily: "monospace", fontWeight: 600 }}>
                      {hospital.hospitalCode}
                    </TableCell>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      <Box>
                        {hospital.hospitalName}
                        <Typography variant="caption" sx={{ display: "block", color: "#94a3b8" }}>
                          {hospital.officialEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {hospital.branches && hospital.branches.length > 0 ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          {hospital.branches.map((b: any) => (
                            <Box key={b.branchId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="caption" sx={{ color: "#cbd5e1", fontWeight: 600 }}>
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
                        <Typography variant="caption" sx={{ color: "#64748b" }}>
                          No Branches / Plans
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#cbd5e1" }}>{hospital._count?.branches || 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={hospital.status} 
                        size="small" 
                        sx={{ 
                          bgcolor: hospital.status === "active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                          color: hospital.status === "active" ? "#34d399" : "#f87171",
                          textTransform: "capitalize",
                          fontWeight: 600 
                        }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => navigate(`/hospitals/${hospital.hospitalId}/edit`)} sx={{ color: "#94a3b8" }}>
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, value) => setPage(value)} 
              color="primary"
              sx={{
                "& .MuiPaginationItem-root": { color: "#cbd5e1" },
                "& .Mui-selected": { bgcolor: "rgba(59, 130, 246, 0.2) !important", color: "#60a5fa" }
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
    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
};
