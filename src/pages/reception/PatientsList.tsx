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
} from "@mui/material";
import {
  PersonAddRounded,
  EditRounded,
  SearchRounded,
  VisibilityRounded,
  DeleteRounded,
  CloseRounded,
  WarningAmberRounded,
  BadgeRounded,
  CakeRounded,
  LocalPhoneRounded,
  WcRounded,
  CalendarMonthRounded,
  QueuePlayNextRounded,
  ContentCopyRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import { useToast } from "../../contexts/ToastContext";

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
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
              Patient Search & Registry
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {meta.total} patient{meta.total !== 1 ? "s" : ""} registered
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
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
          </Box>
        </Box>

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
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 2 }}>
                          <Box sx={{ height: 20, borderRadius: 1, bgcolor: "rgba(255,255,255,0.04)" }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
                            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                              {patient.firstName} {patient.lastName}
                            </Typography>
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
                      {/* Actions */}
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="View Profile">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/reception/patients/${patient.patientId}`)}
                            sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4", bgcolor: "rgba(6,182,212,0.08)" } }}
                          >
                            <VisibilityRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Book Appointment">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/reception/appointments/new?patientId=${patient.patientId}`);
                            }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#3b82f6", bgcolor: "rgba(59,130,246,0.08)" } }}
                          >
                            <CalendarMonthRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Create Visit">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/reception/queue/new?patientId=${patient.patientId}`);
                            }}
                            sx={{ color: "text.secondary", "&:hover": { color: "#10b981", bgcolor: "rgba(16,185,129,0.08)" } }}
                          >
                            <QueuePlayNextRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Patient">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/reception/patients/${patient.patientId}/edit`)}
                            sx={{ color: "text.secondary", "&:hover": { color: "#a78bfa", bgcolor: "rgba(139,92,246,0.08)" } }}
                          >
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteDialog({ open: true, patient })}
                            sx={{ color: "text.secondary", "&:hover": { color: "#f87171", bgcolor: "rgba(239,68,68,0.08)" } }}
                          >
                            <DeleteRounded fontSize="small" />
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
    </>
  );
}
