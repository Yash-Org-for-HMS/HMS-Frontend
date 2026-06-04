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
  Alert,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  SearchRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function RolesList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/rbac/roles", {
        params: { page, limit: 10, search }
      });
      setRoles(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [page, search]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "text.primary", mb: 1 }}>
            {t("rbac.title", "Hospital Roles")}
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {t("rbac.subtitle", "Global Support Mode: Manage hospital-level roles across any tenant")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/rbac/roles/new")}
          sx={{
            background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
            boxShadow: "0 4px 14px 0 rgba(20, 184, 166, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("rbac.addRole", "Add Role")}
        </Button>
      </Box>
      
      <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
        <strong>Global Support Mode:</strong> You are viewing roles for all hospitals on the platform. When creating or editing a role, you will be modifying the permissions for that specific hospital's staff.
      </Alert>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("rbac.searchPlaceholder", "Search by role name or code...")}
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
      </Box>

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
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("rbac.roleCode", "Code")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("rbac.roleName", "Role Name")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("rbac.hospital", "Hospital")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("rbac.type", "Type")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("rbac.usersCount", "Users")}</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#14b8a6" }} />
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.roleId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontWeight: 600 }}>
                      {role.roleCode}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      {role.roleName}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>
                      {role.hospital?.hospitalName || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {role.isSystemRole ? (
                        <Chip label="System Role" size="small" sx={{ bgcolor: "rgba(20, 184, 166, 0.1)", color: "#2dd4bf", fontWeight: 600 }} />
                      ) : (
                        <Chip label="Tenant Role" size="small" sx={{ bgcolor: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", fontWeight: 600 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "text.primary" }}>{role._count?.users || 0}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => navigate(`/rbac/roles/${role.roleId}/edit`)} sx={{ color: "text.secondary" }}>
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
                "& .Mui-selected": { bgcolor: "rgba(20, 184, 166, 0.2) !important", color: "#2dd4bf" }
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
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#14b8a6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
