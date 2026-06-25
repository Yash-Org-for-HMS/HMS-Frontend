import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Avatar,
  CircularProgress,
  Pagination,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  PersonAddRounded,
  EditRounded,
  SearchRounded,
  VisibilityRounded,
  DeleteRounded,
  WarningAmberRounded,
  BadgeRounded,
  CalendarMonthRounded,
  QueuePlayNextRounded,
  ContentCopyRounded,
  QrCode2Rounded,
  ReceiptLongRounded,
  LocalHotelRounded,
  MoreVertRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import IdCardModal from "../../components/reception/IdCardModal";
import AdmitDialog from "../../components/ipd/AdmitDialog";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

interface Patient {
  patientId: string;
  uhidNumber: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string;
  phone: string;
  email: string;
  city: string;
  genderId: number;
  bloodGroupId: number;
  genderLabel: string;
  bloodGroupLabel: string;
  age: number | null;
  createdAt: string;
  outstandingDues?: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PatientsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [errorMsg, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; patient: Patient | null }>({
    open: false,
    patient: null,
  });
  const [idCardPatient, setIdCardPatient] = useState<Patient | null>(null);
  const [admitPatient, setAdmitPatient] = useState<Patient | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; patient: Patient | null }>({ anchor: null, patient: null });

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["patients", search, page],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/patients", {
        params: { search, page, limit: 20 },
      });
      return res.data;
    },
    staleTime: 60000,
  });

  const patients = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const deleteMutation = useMutation({
    mutationFn: async (patientId: string) => {
      await axiosInstance.delete(`/reception/patients/${patientId}`);
    },
    onSuccess: () => {
      setDeleteDialog({ open: false, patient: null });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete patient");
    }
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  const handleDelete = () => {
    if (!deleteDialog.patient) return;
    deleteMutation.mutate(deleteDialog.patient.patientId);
  };

  const getInitials = (p: Patient) => {
    const f = p.firstName?.charAt(0) || "";
    const l = p.lastName?.charAt(0) || "";
    return (f + l).toUpperCase() || "P";
  };

  const avatarColors = [
    "#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706",
    "#2563eb", "#db2777", "#65a30d",
  ];

  const getAvatarColor = (id: string) =>
    avatarColors[id.charCodeAt(0) % avatarColors.length];

  return (
    <>
      <Box>
        {/* ── Header ── */}
        <PageHeader
          title="Patient Search & Registry"
          subtitle={`${meta.total} patient${meta.total !== 1 ? "s" : ""} registered`}
          actions={
            <Button
              variant="contained"
              startIcon={<PersonAddRounded />}
              onClick={() => navigate("/reception/patients/new")}
              sx={{
                background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
                fontWeight: 600,
                px: 3,
                py: 1.2,
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "0 4px 14px rgba(6, 182, 212, 0.4)",
              }}
            >
              Register New Patient
            </Button>
          }
        />

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {errorMsg}
          </Alert>
        )}


        {/* ── Search ── */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by name, MRN, phone, or email..."
            defaultValue={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} sx={{ color: "#06b6d4" }} />
                </InputAdornment>
              ) : null,
            }}
            sx={{
              maxWidth: 520,
              "& .MuiOutlinedInput-root": {
                color: "text.primary",
                bgcolor: "background.default",
                borderRadius: 2,
                "& fieldset": { borderColor: "rgba(6, 182, 212, 0.15)" },
                "&:hover fieldset": { borderColor: "rgba(6, 182, 212, 0.3)" },
                "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
              },
              "& .MuiInputBase-input::placeholder": { color: "#334155" },
            }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
            {(error as any)?.response?.data?.message || "Failed to load patients"}
          </Alert>
        )}

        {/* ── Table ── */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid", borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {["Patient", "MRN / UHID", "Age / DOB", "Gender", "Blood Group", "Phone", "Actions"].map((h, i) => (
                    <TableCell
                      key={h}
                      align={i === 6 ? "right" : "left"}
                      sx={{
                        color: "text.secondary",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        borderBottom: "1px solid", borderColor: "divider",
                        py: 2,
                        bgcolor: "background.default",
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && patients.length === 0 ? (
                  <TableRowsSkeleton rows={6} columns={7} />
                ) : patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                      <Mascot
                        pose={search ? "no-matches" : "nothing-here-yet"}
                        title={search ? "No matches" : "No patients yet"}
                        subtitle={search ? "No patients found matching your search." : "No patients registered yet."}
                      />
                      {!search && (
                        <Button
                          variant="contained"
                          startIcon={<PersonAddRounded />}
                          onClick={() => navigate("/reception/patients/new")}
                          sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" }, textTransform: "none", mt: 1 }}
                        >
                          Register First Patient
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient: Patient) => (
                    <TableRow
                      key={patient.patientId}
                      sx={{
                        "&:hover": { bgcolor: "background.default" },
                        transition: "background 0.15s ease",
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/reception/patients/${patient.patientId}`)}
                    >
                      {/* Patient name + email */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: getAvatarColor(patient.patientId),
                              fontSize: "0.8rem",
                              fontWeight: 700,
                            }}
                          >
                            {getInitials(patient)}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                                {patient.firstName} {patient.lastName}
                              </Typography>
                              {(patient.outstandingDues ?? 0) > 0 && (
                                <Chip
                                  label={`Dues ₹${Number(patient.outstandingDues).toFixed(0)}`}
                                  size="small"
                                  sx={{ height: 18, bgcolor: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 700, fontSize: "0.65rem" }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {patient.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {/* MRN */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Chip
                            icon={<BadgeRounded sx={{ fontSize: "14px !important" }} />}
                            label={patient.uhidNumber}
                            size="small"
                            sx={{
                              bgcolor: "rgba(6, 182, 212, 0.08)",
                              color: "#06b6d4",
                              border: "1px solid", borderColor: "divider",
                              fontWeight: 700,
                              fontFamily: "monospace",
                              fontSize: "0.78rem",
                            }}
                          />
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(patient.uhidNumber); }} sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4" } }}>
                            <ContentCopyRounded sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      {/* Age / DOB */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                            {patient.age !== null ? `${patient.age} yrs` : "—"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#334155" }}>
                            {new Date(patient.dateOfBirth).toLocaleDateString("en-IN")}
                          </Typography>
                        </Box>
                      </TableCell>
                      {/* Gender */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5, color: "text.secondary", fontSize: "0.85rem" }}>
                        {patient.genderLabel}
                      </TableCell>
                      {/* Blood Group */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Chip
                          label={patient.bloodGroupLabel}
                          size="small"
                          sx={{
                            bgcolor: "rgba(239, 68, 68, 0.08)",
                            color: "#f87171",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        />
                      </TableCell>
                      {/* Phone */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5, color: "text.secondary", fontSize: "0.85rem" }}>
                        {patient.phone}
                      </TableCell>
                      {/* Actions — primary quick-actions + overflow menu */}
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Book appointment">
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/reception/appointments/new?patientId=${patient.patientId}`); }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#3b82f6", bgcolor: "rgba(59,130,246,0.08)" } }}>
                            <CalendarMonthRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Bill / collect payment">
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/reception/billing?patientId=${patient.patientId}`); }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#f59e0b", bgcolor: "rgba(245,158,11,0.08)" } }}>
                            <ReceiptLongRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Admit (IPD)">
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); setAdmitPatient(patient); }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#0891b2", bgcolor: "rgba(8,145,178,0.08)" } }}>
                            <LocalHotelRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View profile">
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/reception/patients/${patient.patientId}`); }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4", bgcolor: "rgba(6,182,212,0.08)" } }}>
                            <VisibilityRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More">
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, patient }); }}
                            sx={{ color: "text.secondary" }}>
                            <MoreVertRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2.5, borderTop: "1px solid rgba(6,182,212,0.08)" }}>
              <Pagination
                count={meta.totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                sx={{
                  "& .MuiPaginationItem-root": { color: "text.secondary" },
                  "& .Mui-selected": { bgcolor: "rgba(6,182,212,0.15) !important", color: "#06b6d4", fontWeight: 700 },
                }}
              />
            </Box>
          )}
        </Paper>
      </Box>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, patient: null })}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "background.paper", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 3, backgroundImage: "none" },
        }}
      >
        <Box sx={{ height: 4, bgcolor: "#ef4444" }} />
        <DialogContent sx={{ p: 3, textAlign: "center" }}>
          <WarningAmberRounded sx={{ fontSize: 48, color: "#f87171", mb: 2 }} />
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Delete Patient?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            This will permanently remove{" "}
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
              {deleteDialog.patient?.firstName} {deleteDialog.patient?.lastName}
            </Box>{" "}
            ({deleteDialog.patient?.uhidNumber}) from the system.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
          <Button fullWidth variant="outlined" onClick={() => setDeleteDialog({ open: false, patient: null })} sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none" }}>
            Cancel
          </Button>
          <Button fullWidth variant="contained" onClick={handleDelete} disabled={deleteMutation.isPending} sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" }, textTransform: "none", fontWeight: 600 }}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row overflow menu */}
      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, patient: null })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={() => { const p = menu.patient!; setMenu({ anchor: null, patient: null }); navigate(`/reception/queue/new?patientId=${p.patientId}`); }}>
          <ListItemIcon><QueuePlayNextRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Walk-in visit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { const p = menu.patient!; setMenu({ anchor: null, patient: null }); setIdCardPatient(p); }}>
          <ListItemIcon><QrCode2Rounded fontSize="small" /></ListItemIcon>
          <ListItemText>Print ID card</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { const p = menu.patient!; setMenu({ anchor: null, patient: null }); navigator.clipboard.writeText(p.uhidNumber); toast.success("UHID copied"); }}>
          <ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Copy UHID</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { const p = menu.patient!; setMenu({ anchor: null, patient: null }); navigate(`/reception/patients/${p.patientId}/edit`); }}>
          <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Edit patient</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { const p = menu.patient!; setMenu({ anchor: null, patient: null }); setDeleteDialog({ open: true, patient: p }); }} sx={{ color: "#ef4444" }}>
          <ListItemIcon><DeleteRounded fontSize="small" sx={{ color: "#ef4444" }} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <IdCardModal open={!!idCardPatient} onClose={() => setIdCardPatient(null)} patient={idCardPatient} />
      {admitPatient && (
        <AdmitDialog open onClose={() => setAdmitPatient(null)} prefilledPatientId={admitPatient.patientId}
          onAdmitted={() => setAdmitPatient(null)} />
      )}
    </>
  );
}
