import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Avatar,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Skeleton,
} from "@mui/material";
import {
  EditRounded,
  ArrowBackRounded,
  BadgeRounded,
  CakeRounded,
  LocalPhoneRounded,
  EmailRounded,
  LocationOnRounded,
  WcRounded,
  BloodtypeRounded,
  ContactPhoneRounded,
  WarningAmberRounded,
  CalendarTodayRounded,
  PersonRounded,
  NotificationsActiveRounded,
  EventAvailableRounded,
  LoginRounded,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PatientDocumentsSection from "./PatientDocumentsSection";
import { useToast } from "../../contexts/ToastContext";

interface Patient {
  patientId: string;
  uhidNumber: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string;
  phone: string;
  email: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  genderId: number;
  bloodGroupId: number;
  genderLabel: string;
  bloodGroupLabel: string;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  age: number | null;
  createdAt: string;
}

// ── Info Row component ──────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, py: 1.5 }}>
      <Box sx={{ color: "#334155", mt: 0.2, flexShrink: 0, width: 20 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: value ? "#e2e8f0" : "#1e3a5f", mt: 0.2 }}>
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid", borderColor: "divider",
        bgcolor: "background.paper",
        height: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ color: "#06b6d4" }}>{icon}</Box>
        <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.08)", mb: 1.5 }} />
      {children}
    </Paper>
  );
}

export default function PatientProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();

  let userRole = "";
  try {
    const hospitalUserStr = sessionStorage.getItem("hospitalUser");
    if (hospitalUserStr) userRole = JSON.parse(hospitalUserStr).role?.toLowerCase() || "";
  } catch (e) {}
  const canEdit = userRole.includes("reception") || userRole.includes("admin");

  const { data: patient, isLoading: loading, isError, error, refetch } = useQuery<Patient>({
    queryKey: ["patient", id],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${id}`)).data.data,
    enabled: !!id,
  });

  const [notifProcessing, setNotifProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);

  // This patient's appointments (most recent first), for the history section
  // and the inline same-day check-in.
  const { data: appointments = [], refetch: refetchAppts } = useQuery<any[]>({
    queryKey: ["patient-appointments", id],
    queryFn: async () => (await axiosInstance.get("/reception/appointments", { params: { patientId: id } })).data.data || [],
    enabled: !!id,
  });

  const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();

  const handleCheckIn = async (apptId: string) => {
    try {
      setCheckinId(apptId);
      await axiosInstance.put(`/reception/appointments/${apptId}/checkin`);
      toast.success("Patient checked in");
      refetchAppts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to check in");
    } finally {
      setCheckinId(null);
    }
  };

  const handleSendWelcome = async () => {
    try {
      setNotifProcessing(true);
      setSuccessMsg(null);
      const res = await axiosInstance.post(`/reception/notifications/patients/${id}/registration`);
      setSuccessMsg(res.data.message || "Welcome notification sent");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send notification");
    } finally {
      setNotifProcessing(false);
    }
  };

  const avatarColors = ["#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb"];
  const getColor = (pid: string) => avatarColors[pid.charCodeAt(0) % avatarColors.length];
  const getInitials = (p: Patient) =>
    ((p.firstName?.charAt(0) || "") + (p.lastName?.charAt(0) || "")).toUpperCase() || "P";

  const formatAddress = (p: Patient) => {
    const parts = [p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean);
    return parts.join(", ") || null;
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Skeleton height={40} width={200} sx={{ bgcolor: "action.hover", mb: 3 }} />
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
            <Skeleton variant="circular" width={80} height={80} sx={{ bgcolor: "action.hover" }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="50%" height={32} sx={{ bgcolor: "action.hover", mb: 1 }} />
              <Skeleton width="30%" height={24} sx={{ bgcolor: "action.hover" }} />
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (isError || !patient) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <ErrorState
          title="Couldn't load patient"
          message={(error as any)?.response?.data?.message || "Patient not found"}
          onRetry={() => refetch()}
        />
        <Box sx={{ textAlign: "center" }}>
          <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ mt: 2, color: "#06b6d4" }}>
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* Back + Edit */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate(-1)}
          sx={{ color: "text.secondary", textTransform: "none" }}
        >
          Back
        </Button>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<EventAvailableRounded />}
              onClick={() => navigate(`/reception/appointments/new?patientId=${id}`)}
              sx={{
                color: "#06b6d4",
                borderColor: "rgba(6,182,212,0.3)",
                textTransform: "none",
                borderRadius: 2,
                px: 3,
                "&:hover": { bgcolor: "rgba(6,182,212,0.1)", borderColor: "#06b6d4" }
              }}
            >
              Book Appointment
            </Button>
          )}
          {canEdit && (
          <Button
            variant="outlined"
            startIcon={notifProcessing ? <CircularProgress size={20} color="inherit" /> : <NotificationsActiveRounded />}
            onClick={handleSendWelcome}
            disabled={notifProcessing}
            sx={{
              color: "#8b5cf6",
              borderColor: "rgba(139,92,246,0.3)",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              "&:hover": { bgcolor: "rgba(139,92,246,0.1)", borderColor: "#8b5cf6" }
            }}
          >
            Send Welcome
          </Button>
          )}
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<EditRounded />}
              onClick={() => navigate(`/reception/patients/${id}/edit`)}
              sx={{
                background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 2,
                px: 3,
              }}
            >
              Edit Patient
            </Button>
          )}
        </Box>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* ── Patient Header Card ── */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 3,
          borderRadius: 3,
          border: "1px solid", borderColor: "divider",
          bgcolor: "background.paper",
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, #0891b2, #06b6d4, #38bdf8)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: getColor(patient.patientId),
              fontSize: "1.6rem",
              fontWeight: 800,
              boxShadow: "0 0 20px rgba(6, 182, 212, 0.2)",
            }}
          >
            {getInitials(patient)}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Chip
                icon={<BadgeRounded sx={{ fontSize: "14px !important" }} />}
                label={patient.uhidNumber}
                size="small"
                sx={{
                  bgcolor: "rgba(6, 182, 212, 0.1)",
                  color: "#06b6d4",
                  border: "1px solid", borderColor: "divider",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              />
              <Chip
                label={patient.genderLabel}
                size="small"
                sx={{ bgcolor: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)", fontWeight: 600 }}
              />
              <Chip
                icon={<BloodtypeRounded sx={{ fontSize: "14px !important" }} />}
                label={patient.bloodGroupLabel}
                size="small"
                sx={{ bgcolor: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", fontWeight: 700 }}
              />
              {patient.age !== null && (
                <Chip
                  label={`${patient.age} years`}
                  size="small"
                  sx={{ bgcolor: "rgba(16,185,129,0.08)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)", fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" sx={{ color: "#334155" }}>
              Registered on
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {new Date(patient.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ── Detail Sections ── */}
      <Grid container spacing={3}>
        {/* Personal Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Personal Information" icon={<PersonRounded fontSize="small" />}>
            <InfoRow icon={<CakeRounded sx={{ fontSize: 16 }} />} label="Date of Birth" value={new Date(patient.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<WcRounded sx={{ fontSize: 16 }} />} label="Gender" value={patient.genderLabel} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<BloodtypeRounded sx={{ fontSize: 16 }} />} label="Blood Group" value={`${patient.bloodGroupLabel}`} />
          </SectionCard>
        </Grid>

        {/* Contact Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Contact Details" icon={<LocalPhoneRounded fontSize="small" />}>
            <InfoRow icon={<LocalPhoneRounded sx={{ fontSize: 16 }} />} label="Phone" value={patient.phone} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<EmailRounded sx={{ fontSize: 16 }} />} label="Email" value={patient.email} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<LocationOnRounded sx={{ fontSize: 16 }} />} label="Address" value={formatAddress(patient)} />
          </SectionCard>
        </Grid>

        {/* Emergency Contact */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Emergency Contact" icon={<ContactPhoneRounded fontSize="small" />}>
            {patient.emergencyContactName ? (
              <>
                <InfoRow icon={<PersonRounded sx={{ fontSize: 16 }} />} label="Name" value={patient.emergencyContactName} />
                <Divider sx={{ borderColor: "divider" }} />
                <InfoRow icon={<LocalPhoneRounded sx={{ fontSize: 16 }} />} label="Phone" value={patient.emergencyContactPhone} />
                <Divider sx={{ borderColor: "divider" }} />
                <InfoRow icon={<WcRounded sx={{ fontSize: 16 }} />} label="Relationship" value={patient.emergencyContactRelation} />
              </>
            ) : (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <ContactPhoneRounded sx={{ fontSize: 32, color: "#1e3a5f", mb: 1 }} />
                <Typography variant="body2" sx={{ color: "#334155" }}>
                  No emergency contact on file
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate(`/reception/patients/${id}/edit`)}
                  sx={{ color: "#06b6d4", textTransform: "none", mt: 0.5 }}
                >
                  Add now
                </Button>
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Allergies / Medical Notes */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Allergies & Medical Notes" icon={<WarningAmberRounded fontSize="small" />}>
            {patient.allergies ? (
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
                <Typography variant="body2" sx={{ color: "#d97706", lineHeight: 1.7 }}>
                  {patient.allergies}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <WarningAmberRounded sx={{ fontSize: 32, color: "#1e3a5f", mb: 1 }} />
                <Typography variant="body2" sx={{ color: "#334155" }}>
                  No known allergies recorded
                </Typography>
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Appointments */}
        <Grid size={{ xs: 12 }}>
          <SectionCard title="Appointments" icon={<CalendarTodayRounded fontSize="small" />}>
            {appointments.length === 0 ? (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <CalendarTodayRounded sx={{ fontSize: 32, color: "#1e3a5f", mb: 1 }} />
                <Typography variant="body2" sx={{ color: "#334155", mb: 1 }}>No appointments yet</Typography>
                {canEdit && (
                  <Button size="small" startIcon={<EventAvailableRounded />} onClick={() => navigate(`/reception/appointments/new?patientId=${id}`)} sx={{ color: "#06b6d4", textTransform: "none" }}>
                    Book the first appointment
                  </Button>
                )}
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {appointments.slice(0, 6).map((appt: any, idx: number) => {
                  const canCheckIn = canEdit && appt.statusLabel === "Scheduled" && isToday(appt.appointmentDate);
                  return (
                    <Box key={appt.appointmentId}>
                      {idx > 0 && <Divider sx={{ borderColor: "divider" }} />}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, flexWrap: "wrap" }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                            {new Date(appt.appointmentDate).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {appt.doctorName || "Unassigned"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={appt.statusLabel || "—"}
                            size="small"
                            sx={{ bgcolor: `${appt.statusColor || "#64748b"}20`, color: appt.statusColor || "#64748b", fontWeight: 700 }}
                          />
                          {canCheckIn && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={checkinId === appt.appointmentId ? <CircularProgress size={16} color="inherit" /> : <LoginRounded />}
                              disabled={checkinId === appt.appointmentId}
                              onClick={() => handleCheckIn(appt.appointmentId)}
                              sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, textTransform: "none" }}
                            >
                              Check in
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Patient Documents Section */}
        <Grid size={{ xs: 12 }}>
          <PatientDocumentsSection patientId={patient.patientId} />
        </Grid>
      </Grid>
    </Box>
  );
}
