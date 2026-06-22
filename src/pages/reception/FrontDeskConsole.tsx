import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Grid, Paper, TextField, InputAdornment,
  CircularProgress, Button, Avatar, Dialog, DialogContent, IconButton, Alert, Chip
} from "@mui/material";
import {
  SearchRounded, PersonAddRounded, CloseRounded, ChevronRightRounded, ContentCopyRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import PatientForm from "./PatientForm";
import AppointmentForm from "./AppointmentForm";
import BillingModal from "./BillingModal";
import { useToast } from "../../contexts/ToastContext";

interface Patient {
  patientId: string;
  uhidNumber: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string;
  phone: string;
  email: string;
  genderLabel: string;
  bloodGroupLabel: string;
  age: number | null;
}

export default function FrontDeskConsole() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [billingDialog, setBillingDialog] = useState({ open: false, apptId: "", patientName: "", apptDate: "" });

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: recentPatients = [] } = useQuery<Patient[]>({
    queryKey: ["frontdesk-recent-patients"],
    queryFn: async () =>
      (await axiosInstance.get("/reception/patients", { params: { search: "", page: 1, limit: 5 } })).data.data,
  });

  const fetchPatients = useCallback(async (q: string) => {
    if (!q) {
      setPatients([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.get("/reception/patients", {
        params: { search: q, page: 1, limit: 10 },
      });
      setPatients(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to search patients");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (val.length > 1) {
      searchRef.current = setTimeout(() => fetchPatients(val), 400);
    } else {
      setPatients([]);
    }
  };

  const getInitials = (p: Patient) => {
    const f = p.firstName?.charAt(0) || "";
    const l = p.lastName?.charAt(0) || "";
    return (f + l).toUpperCase() || "P";
  };
  const getAvatarColor = (id: string) => {
    const avatarColors = ["#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#65a30d"];
    return avatarColors[id.charCodeAt(0) % avatarColors.length];
  };

  const handlePatientSuccess = (patientId: string) => {
    setRegisterModalOpen(false);
    setSelectedPatientId(patientId);
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
{/* Main Split Layout */}
      <Box sx={{ flex: 1, display: "flex", gap: 3, minHeight: 0, flexDirection: { xs: "column", md: "row" } }}>
        {/* Left Panel: Search & Results */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: "100%", md: "40%", lg: "33%" },
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            border: "1px solid", borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1.5 }}>
              <TextField
                id="patient-search-input"
                fullWidth
                placeholder="Search patient name, MRN, phone..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary" }} /></InputAdornment>,
                  endAdornment: loading ? <InputAdornment position="end"><CircularProgress size={18} sx={{ color: "#06b6d4" }} /></InputAdornment> : null,
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary", bgcolor: "background.default", borderRadius: 2,
                    "& fieldset": { borderColor: "rgba(6, 182, 212, 0.15)" },
                    "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={() => setRegisterModalOpen(true)}
                title="Quick Register"
                sx={{
                  minWidth: "auto",
                  px: 2,
                  background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
                  boxShadow: "0 4px 14px rgba(6, 182, 212, 0.3)",
                  borderRadius: 2,
                  "&:hover": { background: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)" },
                }}
              >
                <PersonAddRounded />
              </Button>
            </Box>
            
            <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
              {search.length < 2 ? (
                <Box sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2, px: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700, flex: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Recent Registrations
                    </Typography>
                    {recentPatients.length > 0 && (
                      <Chip label={`${recentPatients.length} Recent`} size="small" sx={{ bgcolor: "rgba(6, 182, 212, 0.1)", color: "#0891b2", fontWeight: 600, borderRadius: 2 }} />
                    )}
                  </Box>

                  {recentPatients.length === 0 ? (
                    <Box sx={{ mx: 1 }}>
                      <Mascot pose="nothing-here-yet" subtitle="No recent patients found." size={120} />
                    </Box>
                  ) : (
                    recentPatients.map(p => (
                      <Box
                        key={p.patientId}
                        onClick={() => setSelectedPatientId(p.patientId)}
                        sx={{
                          display: "flex", alignItems: "center", p: 1.5, mb: 1,
                          borderRadius: 2, cursor: "pointer",
                          bgcolor: selectedPatientId === p.patientId ? "rgba(6, 182, 212, 0.15)" : "transparent",
                          border: "1px solid",
                          borderColor: selectedPatientId === p.patientId ? "rgba(6, 182, 212, 0.3)" : "rgba(0,0,0,0.05)",
                          "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)", borderColor: "rgba(6, 182, 212, 0.3)" },
                          transition: "all 0.2s ease"
                        }}
                      >
                        <Avatar sx={{ width: 40, height: 40, bgcolor: getAvatarColor(p.patientId), mr: 1.5 }}>
                          {getInitials(p)}
                        </Avatar>
                        <Box sx={{ flex: 1, overflow: "hidden" }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }} noWrap>
                            {p.firstName} {p.lastName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center" }} noWrap>
                            MRN: {p.uhidNumber}
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.uhidNumber); }} sx={{ p: 0.2, ml: 0.5, color: "text.secondary", "&:hover": { color: "#06b6d4" } }}>
                              <ContentCopyRounded sx={{ fontSize: "0.9rem" }} />
                            </IconButton>
                          </Typography>
                        </Box>
                        <ChevronRightRounded sx={{ color: selectedPatientId === p.patientId ? "#06b6d4" : "#475569" }} />
                      </Box>
                    ))
                  )}
                </Box>
              ) : patients.length === 0 && !loading ? (
                <Box sx={{ textAlign: "center" }}>
                  <Mascot pose="no-matches" subtitle="No patient found." size={120} />
                  <Button variant="outlined" size="small" onClick={() => setRegisterModalOpen(true)} sx={{ mt: 1, color: "#06b6d4", borderColor: "rgba(6, 182, 212, 0.5)" }}>
                    Register New Patient
                  </Button>
                </Box>
              ) : (
                patients.map(p => (
                  <Box
                    key={p.patientId}
                    onClick={() => setSelectedPatientId(p.patientId)}
                    sx={{
                      display: "flex", alignItems: "center", p: 1.5, mb: 1,
                      borderRadius: 2, cursor: "pointer",
                      bgcolor: selectedPatientId === p.patientId ? "rgba(6, 182, 212, 0.15)" : "transparent",
                      border: "1px solid",
                      borderColor: selectedPatientId === p.patientId ? "rgba(6, 182, 212, 0.3)" : "transparent",
                      "&:hover": { bgcolor: "rgba(6, 182, 212, 0.08)" },
                      transition: "all 0.2s ease"
                    }}
                  >
                    <Avatar sx={{ width: 40, height: 40, bgcolor: getAvatarColor(p.patientId), mr: 1.5 }}>
                      {getInitials(p)}
                    </Avatar>
                    <Box sx={{ flex: 1, overflow: "hidden" }}>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }} noWrap>
                        {p.firstName} {p.lastName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center" }} noWrap>
                        MRN: {p.uhidNumber} • {p.phone}
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.uhidNumber); }} sx={{ p: 0.2, ml: 0.5, color: "text.secondary", "&:hover": { color: "#06b6d4" } }}>
                          <ContentCopyRounded sx={{ fontSize: "0.9rem" }} />
                        </IconButton>
                      </Typography>
                    </Box>
                    <ChevronRightRounded sx={{ color: selectedPatientId === p.patientId ? "#06b6d4" : "#475569" }} />
                  </Box>
                ))
              )}
            </Box>
          </Paper>

        {/* Right Panel: Action & Booking */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            border: "1px solid", borderColor: "divider",
            bgcolor: "background.paper",
            overflowY: "auto",
            position: "relative",
          }}
        >
            {!selectedPatientId ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", p: 4 }}>
                <Box sx={{ 
                  width: 120, height: 120, borderRadius: "50%", 
                  background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(14, 116, 144, 0.05) 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 3 
                }}>
                  <PersonAddRounded sx={{ fontSize: 64, color: "#0891b2", opacity: 0.8 }} />
                </Box>
                <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
                  Front Desk Workspace
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", textAlign: "center", maxWidth: 400, mb: 4 }}>
                  Search for an existing patient to book an appointment, or register a new patient to get started.
                </Typography>
                
                <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, textAlign: "center", bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>Step 1</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>Find or Register Patient</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, textAlign: "center", bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>Step 2</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>Book & Proceed to Billing</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Box sx={{ p: 4 }}>
                <Box sx={{ mb: 3, pb: 3, borderBottom: "1px solid", borderColor: "divider" }}>
                   <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
                     Book Appointment
                   </Typography>
                   {(() => {
                     const sp = patients.find(p => p.patientId === selectedPatientId) || recentPatients.find(p => p.patientId === selectedPatientId);
                     return sp ? (
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         <Chip label={`Selected: ${sp.firstName} ${sp.lastName}`} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", fontWeight: 600 }} />
                         <Chip label={`MRN: ${sp.uhidNumber}`} size="small" variant="outlined" sx={{ color: "text.secondary", borderColor: "divider", fontWeight: 600, fontFamily: "monospace" }} />
                         <IconButton size="small" onClick={() => navigator.clipboard.writeText(sp.uhidNumber)} sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4", bgcolor: "rgba(6, 182, 212, 0.08)" } }}>
                           <ContentCopyRounded fontSize="small" />
                         </IconButton>
                       </Box>
                     ) : (
                       <Chip label="Selected Patient Linked" size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)" }} />
                     );
                   })()}
                </Box>
                <AppointmentForm 
                  isEmbedded={true} 
                  prefilledPatientId={selectedPatientId} 
                  onSuccess={(apptId, pName, apptDate) => {
                     toast.success(`Appointment booked${pName ? ` for ${pName}` : ""}`);
                     if (apptId) {
                        setBillingDialog({ open: true, apptId, patientName: pName || "Patient", apptDate: apptDate || new Date().toISOString() });
                     }
                     setSearch("");
                     setPatients([]);
                     setSelectedPatientId(null);
                  }}
                  onCancel={() => setSelectedPatientId(null)}
                />
              </Box>
            )}
          </Paper>
      </Box>

      {/* Register Modal */}
      <Dialog 
        open={registerModalOpen} 
        onClose={() => setRegisterModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>Quick Registration</Typography>
          <IconButton onClick={() => setRegisterModalOpen(false)} sx={{ color: "text.secondary" }}><CloseRounded /></IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            <PatientForm 
              isModal={true} 
              onSuccess={handlePatientSuccess} 
              onCancel={() => setRegisterModalOpen(false)} 
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Billing Modal */}
      {billingDialog.open && (
        <BillingModal
          open={billingDialog.open}
          onClose={() => setBillingDialog({ open: false, apptId: "", patientName: "", apptDate: "" })}
          appointmentId={billingDialog.apptId}
          patientName={billingDialog.patientName}
          appointmentDate={billingDialog.apptDate}
        />
      )}
    </Box>
  );
}
