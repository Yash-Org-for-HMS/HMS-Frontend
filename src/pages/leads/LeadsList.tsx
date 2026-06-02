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
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  DeleteRounded,
  SearchRounded,
  MoreVertRounded,
  FilterAltRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function LeadsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/leads", {
        params: { page, limit: 10, search, status: statusFilter }
      });
      setLeads(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/leads/${deleteId}`);
      setDeleteId(null);
      fetchLeads();
    } catch (error) {
      console.error("Failed to delete lead", error);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await axiosInstance.patch(`/leads/${leadId}/status`, { status: newStatus });
      fetchLeads();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, leadId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedLeadId(leadId);
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "new": return "#38bdf8";
      case "contacted": return "#fbbf24";
      case "qualified": return "#c084fc";
      case "demo_done": return "#60a5fa";
      case "converted": return "#34d399";
      default: return "#cbd5e1";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "new": return "rgba(56, 189, 248, 0.15)";
      case "contacted": return "rgba(251, 191, 36, 0.15)";
      case "qualified": return "rgba(192, 132, 252, 0.15)";
      case "demo_done": return "rgba(96, 165, 250, 0.15)";
      case "converted": return "rgba(52, 211, 153, 0.15)";
      default: return "rgba(255, 255, 255, 0.05)";
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("leads.title")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("leads.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/leads/new")}
          sx={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("leads.addLead")}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField
          placeholder={t("leads.searchPlaceholder")}
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
        <TextField
          select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ ...textFieldSx, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltRounded sx={{ color: "#64748b" }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="new">{t("leads.statusNew")}</MenuItem>
          <MenuItem value="contacted">{t("leads.statusContacted")}</MenuItem>
          <MenuItem value="qualified">{t("leads.statusQualified")}</MenuItem>
          <MenuItem value="demo_done">{t("leads.statusDemoDone")}</MenuItem>
          <MenuItem value="converted">{t("leads.statusConverted")}</MenuItem>
        </TextField>
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
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("leads.hospitalName")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("leads.contactDetails")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("leads.assignedTo")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("leads.status")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#6366f1" }} />
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.hospitalLeadId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      {lead.hospitalName}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "#e2e8f0" }}>{lead.contactPersonName}</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>{lead.email}</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>{lead.phone}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
                      {lead.assignedUser ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}` : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={lead.leadStatus}
                        onChange={(e) => handleStatusChange(lead.hospitalLeadId, e.target.value)}
                        size="small"
                        sx={{
                          minWidth: 140,
                          "& .MuiOutlinedInput-root": {
                            color: getStatusTextColor(lead.leadStatus),
                            backgroundColor: getStatusBgColor(lead.leadStatus),
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            "& fieldset": { borderColor: "transparent" },
                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                            "&.Mui-focused fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                          },
                          "& .MuiSvgIcon-root": { color: getStatusTextColor(lead.leadStatus) }
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
                        <MenuItem value="new" sx={{ fontWeight: 600, color: "#38bdf8" }}>{t("leads.statusNew")}</MenuItem>
                        <MenuItem value="contacted" sx={{ fontWeight: 600, color: "#fbbf24" }}>{t("leads.statusContacted")}</MenuItem>
                        <MenuItem value="qualified" sx={{ fontWeight: 600, color: "#c084fc" }}>{t("leads.statusQualified")}</MenuItem>
                        <MenuItem value="demo_done" sx={{ fontWeight: 600, color: "#60a5fa" }}>{t("leads.statusDemoDone")}</MenuItem>
                        <MenuItem value="converted" sx={{ fontWeight: 600, color: "#34d399" }}>{t("leads.statusConverted")}</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, lead.hospitalLeadId)} sx={{ color: "#94a3b8" }}>
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
                "& .Mui-selected": { bgcolor: "rgba(99, 102, 241, 0.2) !important", color: "#818cf8" }
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
        <MenuItem onClick={() => { navigate(`/leads/${selectedLeadId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "#94a3b8" }} /> {t("common.edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedLeadId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete")}
        </MenuItem>
      </Menu>



      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "#1e293b", color: "#f8fafc", borderRadius: 3 } }}>
        <DialogTitle>{t("leads.deleteLead")}</DialogTitle>
        <DialogContent sx={{ color: "#cbd5e1" }}>
          {t("leads.deleteConfirm")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "#94a3b8" }}>{t("common.cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete")}</Button>
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
    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
  "& .MuiSvgIcon-root": { color: "#64748b" },
};
