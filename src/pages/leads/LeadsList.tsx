import { useState } from "react";
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
  FormControlLabel,
  Switch,
  Alert,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  DeleteRounded,
  SearchRounded,
  MoreVertRounded,
  FilterAltRounded,
  AssignmentIndRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

export default function LeadsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<any | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadStatus, setSelectedLeadStatus] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Conversion (lead → live hospital tenant)
  const [convertForm, setConvertForm] = useState({ planId: "", adminFirstName: "", adminLastName: "", adminEmail: "" });
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string; hospitalName: string } | null>(null);

  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["plans", "convert-options"],
    queryFn: async () => (await axiosInstance.get("/plans", { params: { limit: 100 } })).data.data || [],
  });

  const {
    data: leadsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["leads", page, search, statusFilter, myLeadsOnly, user?.id],
    queryFn: async () => {
      const params: any = { page, limit: 10, search, status: statusFilter };
      if (myLeadsOnly && user?.id) params.assignedTo = user.id;
      return (await axiosInstance.get("/leads", { params })).data; // { data, pagination }
    },
  });
  const leads: any[] = leadsData?.data ?? [];
  const totalPages: number = leadsData?.pagination?.totalPages ?? 1;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/leads/${deleteId}`);
      setDeleteId(null);
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to delete lead");
    }
  };

  const openConvert = (lead: any) => {
    const parts = (lead?.contactPersonName || "").trim().split(/\s+/).filter(Boolean);
    setConvertForm({
      planId: "",
      adminFirstName: parts[0] || "",
      adminLastName: parts.slice(1).join(" ") || "",
      adminEmail: lead?.email || "",
    });
    setConvertError(null);
    setConvertId(lead);
  };

  const handleConvert = async () => {
    if (!convertId) return;
    if (!convertForm.planId) {
      setConvertError("Please select a subscription plan.");
      return;
    }
    setConverting(true);
    setConvertError(null);
    try {
      const res = await axiosInstance.post(`/leads/${convertId.hospitalLeadId}/convert`, convertForm);
      const admin = res.data?.data?.admin;
      const convertedName = convertId.hospitalName;
      setConvertId(null);
      if (admin) {
        setCredentials({ email: admin.email, temporaryPassword: admin.temporaryPassword, hospitalName: convertedName });
      }
      refetch();
    } catch (error: any) {
      setConvertError(error.response?.data?.message || "Failed to convert lead");
    } finally {
      setConverting(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await axiosInstance.patch(`/leads/${leadId}/status`, { status: newStatus });
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to update status");
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedLeadId || !user?.id) return;
    try {
      await axiosInstance.patch(`/leads/${selectedLeadId}/assign`, { assignedToUserId: user.id });
      setAnchorEl(null);
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to assign lead");
    }
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, lead: any) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedLeadId(lead.hospitalLeadId);
    setSelectedLeadStatus(lead.leadStatus);
    setSelectedLead(lead);
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
    <PageContainer>
      <PageHeader
        title={t("leads.title")}
        subtitle={t("leads.subtitle")}
        actions={
          <ActionButton
            accentFrom="#6366f1"
            accentTo="#8b5cf6"
            startIcon={<AddRounded />}
            onClick={() => navigate("/leads/new")}
          >
            {t("leads.addLead")}
          </ActionButton>
        }
      />

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("leads.searchPlaceholder")}
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
        <TextField
          select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltRounded sx={{ color: "text.secondary" }} />
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
        
        <FormControlLabel
          control={
            <Switch 
              checked={myLeadsOnly} 
              onChange={(e) => setMyLeadsOnly(e.target.checked)} 
              color="primary"
            />
          }
          label={<Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>My Leads Only</Typography>}
          sx={{ ml: 2 }}
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
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("leads.hospitalName")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("leads.contactDetails")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("leads.assignedTo")}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>{t("leads.status")}</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600 }}>{t("common.actions")}</TableCell>
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
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.hospitalLeadId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>
                      {lead.hospitalName}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "text.primary" }}>{lead.contactPersonName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{lead.email}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{lead.phone}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
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
                            "&:hover fieldset": { borderColor: "divider" },
                            "&.Mui-focused fieldset": { borderColor: "divider" },
                          },
                          "& .MuiSvgIcon-root": { color: getStatusTextColor(lead.leadStatus) }
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
                        <MenuItem value="new" sx={{ fontWeight: 600, color: "#38bdf8" }}>{t("leads.statusNew")}</MenuItem>
                        <MenuItem value="contacted" sx={{ fontWeight: 600, color: "#fbbf24" }}>{t("leads.statusContacted")}</MenuItem>
                        <MenuItem value="qualified" sx={{ fontWeight: 600, color: "#c084fc" }}>{t("leads.statusQualified")}</MenuItem>
                        <MenuItem value="demo_done" sx={{ fontWeight: 600, color: "#60a5fa" }}>{t("leads.statusDemoDone")}</MenuItem>
                        <MenuItem value="converted" sx={{ fontWeight: 600, color: "#34d399" }}>{t("leads.statusConverted")}</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, lead)} sx={{ color: "text.secondary" }}>
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
        PaperProps={{ sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", color: "text.primary" } }}
      >
        {selectedLeadStatus !== "converted" && (
          <MenuItem onClick={() => { openConvert(selectedLead); setAnchorEl(null); }}>
            <AddRounded sx={{ mr: 1.5, fontSize: 20, color: "#10b981" }} /> Convert to Hospital
          </MenuItem>
        )}
        {selectedLead && selectedLead.assignedSalesAdminId !== user?.id && (
          <MenuItem onClick={handleAssignToMe}>
            <AssignmentIndRounded sx={{ mr: 1.5, fontSize: 20, color: "#6366f1" }} /> Assign to Me
          </MenuItem>
        )}
        <MenuItem onClick={() => { navigate(`/leads/${selectedLeadId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }} /> {t("common.edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedLeadId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete")}
        </MenuItem>
      </Menu>

      {/* Convert Dialog — pick a plan + the first admin */}
      <Dialog open={Boolean(convertId)} onClose={() => !converting && setConvertId(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Convert Lead to Hospital</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Provisioning <strong>{convertId?.hospitalName}</strong> creates the hospital (pending activation), a Main Branch on the chosen plan, default roles, and the first Hospital Admin login. Activate it later by completing onboarding.
          </Typography>
          {convertError && <Alert severity="error" sx={{ mb: 2 }}>{convertError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              select
              required
              label="Subscription Plan"
              value={convertForm.planId}
              onChange={(e) => setConvertForm((f) => ({ ...f, planId: e.target.value }))}
            >
              {plans.length === 0 && <MenuItem value="" disabled>No plans available — create one first</MenuItem>}
              {plans.map((p) => (
                <MenuItem key={p.planId} value={p.planId}>{p.planName}</MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                fullWidth
                label="Admin First Name"
                value={convertForm.adminFirstName}
                onChange={(e) => setConvertForm((f) => ({ ...f, adminFirstName: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Admin Last Name"
                value={convertForm.adminLastName}
                onChange={(e) => setConvertForm((f) => ({ ...f, adminLastName: e.target.value }))}
              />
            </Box>
            <TextField
              fullWidth
              type="email"
              label="Admin Login Email"
              helperText="This is the email the Hospital Admin will sign in with."
              value={convertForm.adminEmail}
              onChange={(e) => setConvertForm((f) => ({ ...f, adminEmail: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConvertId(null)} disabled={converting} sx={{ color: "text.secondary" }}>{t("common.cancel")}</Button>
          <Button onClick={handleConvert} variant="contained" disabled={converting || !convertForm.planId} sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}>
            {converting ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Convert to Hospital"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credentials Dialog — shown once after conversion */}
      <Dialog open={Boolean(credentials)} onClose={() => setCredentials(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: "#10b981" }}>Hospital Provisioned</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            <strong>{credentials?.hospitalName}</strong> was created. Share these one-time admin credentials securely — the password is shown only now and must be changed on first login. The hospital becomes active once you complete its onboarding.
          </Typography>
          <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Login Email</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>{credentials?.email}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Temporary Password</Typography>
            <Typography variant="h6" sx={{ fontFamily: "monospace", letterSpacing: 1 }}>{credentials?.temporaryPassword}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { navigator.clipboard?.writeText(`${credentials?.email} / ${credentials?.temporaryPassword}`); }}
            sx={{ color: "text.secondary" }}
          >
            Copy
          </Button>
          <Button onClick={() => setCredentials(null)} variant="contained" sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle>{t("leads.deleteLead")}</DialogTitle>
        <DialogContent sx={{ color: "text.primary" }}>
          {t("leads.deleteConfirm")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "text.secondary" }}>{t("common.cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete")}</Button>
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
    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
  "& .MuiSvgIcon-root": { color: "text.secondary" },
};
