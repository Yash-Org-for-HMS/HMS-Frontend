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
  Avatar,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  SearchRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function SuperAdminsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/super-admins", {
        params: { page, limit: 10, search }
      });
      setAdmins(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch super admins", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [page, search]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("superAdmins.title", "Super Admins")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("superAdmins.subtitle", "Manage global system administrators")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/super-admins/new")}
          sx={{
            background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
            boxShadow: "0 4px 14px 0 rgba(139, 92, 246, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("superAdmins.addAdmin", "Add Admin")}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("superAdmins.searchPlaceholder", "Search by name or email...")}
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
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("superAdmins.name", "Admin")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("superAdmins.phone", "Phone")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("superAdmins.status", "Status")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#8b5cf6" }} />
                  </TableCell>
                </TableRow>
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.superAdminId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar sx={{ bgcolor: "rgba(139, 92, 246, 0.2)", color: "#c4b5fd" }}>
                          {admin.firstName[0]}{admin.lastName[0]}
                        </Avatar>
                        <Box>
                          {admin.firstName} {admin.lastName}
                          <Typography variant="caption" sx={{ display: "block", color: "#94a3b8" }}>
                            {admin.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
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
                      <IconButton onClick={() => navigate(`/super-admins/${admin.superAdminId}/edit`)} sx={{ color: "#94a3b8" }}>
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
                "& .Mui-selected": { bgcolor: "rgba(139, 92, 246, 0.2) !important", color: "#c4b5fd" }
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
    "&.Mui-focused fieldset": { borderColor: "#8b5cf6" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
};
