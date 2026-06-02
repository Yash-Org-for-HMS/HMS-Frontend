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
import { axiosInstance } from "../../api/axios";

export default function FeatureFlagsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/feature-flags", {
        params: { page, limit: 10, search }
      });
      setFlags(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch flags", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [page, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/feature-flags/${deleteId}`);
      setDeleteId(null);
      fetchFlags();
    } catch (error) {
      console.error("Failed to delete feature flag", error);
    }
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, flagId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedFlagId(flagId);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("flags.title", "Feature Flags")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("flags.subtitle", "Manage hospital-specific feature toggles and overrides")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/feature-flags/new")}
          sx={{
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            boxShadow: "0 4px 14px 0 rgba(245, 158, 11, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("flags.addFlag", "Add Flag")}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("flags.searchPlaceholder", "Search flags by name or key...")}
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
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("flags.hospitalName", "Hospital")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("flags.featureName", "Feature")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("flags.featureKey", "Key")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("flags.scope", "Scope")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("flags.status", "Status")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#f59e0b" }} />
                  </TableCell>
                </TableRow>
              ) : flags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                flags.map((flag) => (
                  <TableRow key={flag.featureFlagId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      {flag.isGlobal ? <span style={{color: "#60a5fa"}}>Global / All Hospitals</span> : flag.hospital?.hospitalName}
                    </TableCell>
                    <TableCell sx={{ color: "#f8fafc" }}>
                      {flag.featureName}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                      {flag.featureKey}
                    </TableCell>
                    <TableCell>
                      <Chip label={flag.isGlobal ? "Global" : "Tenant"} size="small" sx={{ bgcolor: flag.isGlobal ? "rgba(59, 130, 246, 0.1)" : "rgba(245, 158, 11, 0.1)", color: flag.isGlobal ? "#60a5fa" : "#fbbf24", fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={flag.isEnabled ? "Enabled" : "Disabled"} size="small" sx={{ bgcolor: flag.isEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: flag.isEnabled ? "#34d399" : "#f87171", fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, flag.featureFlagId)} sx={{ color: "#94a3b8" }}>
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
        PaperProps={{ sx: { bgcolor: "#1e293b", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#f8fafc" } }}
      >
        <MenuItem onClick={() => { navigate(`/feature-flags/${selectedFlagId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "#94a3b8" }} /> {t("common.edit", "Edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedFlagId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete", "Delete")}
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "#1e293b", color: "#f8fafc", borderRadius: 3 } }}>
        <DialogTitle>{t("flags.deleteFlag", "Delete Flag")}</DialogTitle>
        <DialogContent sx={{ color: "#cbd5e1" }}>
          {t("flags.deleteConfirm", "Are you sure you want to delete this feature flag? This will revert the hospital's access to this feature to the default specified by their plan.")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "#94a3b8" }}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete", "Delete")}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#f59e0b" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#f59e0b" },
  "& .MuiSvgIcon-root": { color: "#64748b" },
};
