import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR, getInitials } from "@/utils/format";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Chip, Avatar, Button, Alert,
  Divider, Skeleton, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TablePagination, Menu, MenuItem, IconButton, Stack, Tooltip,
  ListItemIcon, ListItemText,
} from "@mui/material";
import {
  EditRounded, ArrowBackRounded, BadgeRounded, CakeRounded, LocalPhoneRounded,
  EmailRounded, LocationOnRounded, WcRounded, BloodtypeRounded, ContactPhoneRounded,
  WarningAmberRounded, CalendarTodayRounded, PersonRounded, NotificationsActiveRounded,
  EventAvailableRounded, EventRepeatRounded, CallSplitRounded, LoginRounded,
  QrCode2Rounded, ReceiptLongRounded, MoreVertRounded, EventRounded,
  PaymentsRounded, AccountBalanceWalletRounded, VaccinesRounded, MedicalServicesRounded,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import StatCard from "@/components/StatCard";
import StatusChip from "@/components/StatusChip";
import PatientDocumentsSection from "./PatientDocumentsSection";
import IdCardModal from "@/components/reception/IdCardModal";
import ReferralDialog from "@/components/reception/ReferralDialog";
import ClinicalRecordsSection from "@/components/reception/ClinicalRecordsSection";
import ConsentFormsSection from "@/components/reception/ConsentFormsSection";
import VaccinationsSection from "@/components/reception/VaccinationsSection";
import SurgeriesSection from "@/components/reception/SurgeriesSection";
import InvoiceViewDialog from "@/components/reception/InvoiceViewDialog";
import { useToast } from "@/providers/ToastContext";
import { useEnabledModules } from "@/hooks/useEnabledModules";

const ACCENT = ACCENTS.reception;

import type { Patient as PatientBase } from "@/types";

interface Patient extends PatientBase {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  genderId: number;
  bloodGroupId: number;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  referredByType: string | null;
  referredByName: string | null;
  createdAt: string;
}


// ── Info row inside the overview cards ───────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, py: 1.1 }}>
      <Box sx={{ color: ACCENT, mt: 0.3, flexShrink: 0, display: "flex" }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: value ? "text.primary" : "text.disabled", mt: 0.3, wordBreak: "break-word" }}>
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

function SectionCard({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ color: ACCENT, display: "flex" }}>{icon}</Box>
          <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>{title}</Typography>
        </Box>
        {action}
      </Box>
      <Divider sx={{ borderColor: "divider", mb: 0.5 }} />
      {children}
    </Paper>
  );
}

// `readOnly` lets the same page render as a pure view when opened from the
// hospital-admin's oversight area (mounted at /hospital/patients/:id) — the
// admin can watch what's happening without being able to act, per the
// Operations section's "staff still do the work; the admin observes" design.
// Every mutating affordance on the page (and the nested tab sections it
// renders) is threaded through this single flag.
export default function PatientProfile({ readOnly = false }: { readOnly?: boolean } = {}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();

  let userRole = "";
  try {
    const hospitalUserStr = sessionStorage.getItem("hospitalUser");
    if (hospitalUserStr) userRole = JSON.parse(hospitalUserStr).role?.toLowerCase() || "";
  } catch (e) { /* ignore */ }
  const canEdit = !readOnly && (userRole.includes("reception") || userRole.includes("admin"));

  const { data: patient, isLoading: loading, isError, error, refetch } = useQuery<Patient>({
    queryKey: ["patient", id],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${id}`)).data.data,
    enabled: !!id,
  });

  const [tab, setTab] = useState(0);
  const { isModuleEnabled } = useEnabledModules();
  const billingEnabled = isModuleEnabled("Billing");
  const [notifProcessing, setNotifProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [invoiceView, setInvoiceView] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const [apptPage, setApptPage] = useState(0);
  const [apptRpp, setApptRpp] = useState(5);
  const [billPage, setBillPage] = useState(0);
  const [billRpp, setBillRpp] = useState(5);

  const { data: appointments = [], refetch: refetchAppts } = useQuery<any[]>({
    queryKey: ["patient-appointments", id],
    queryFn: async () => (await axiosInstance.get("/reception/appointments", { params: { patientId: id } })).data.data || [],
    enabled: !!id,
  });

  const { data: billing, refetch: refetchBilling } = useQuery<{ totals: any; invoices: any[] }>({
    queryKey: ["patient-billing", id],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${id}/billing-summary`)).data.data,
    enabled: !!id && billingEnabled,
  });

  const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = appointments.filter((a) => new Date(a.appointmentDate) >= now && a.statusLabel !== "Cancelled" && a.statusLabel !== "Completed").length;
    const past = [...appointments].filter((a) => a.statusLabel === "Completed").sort((a, b) => +new Date(b.appointmentDate) - +new Date(a.appointmentDate));
    return {
      total: appointments.length,
      upcoming,
      lastVisit: past[0] ? new Date(past[0].appointmentDate) : null,
    };
  }, [appointments]);

  const handleCheckIn = async (apptId: string) => {
    try {
      setCheckinId(apptId);
      await axiosInstance.put(`/reception/appointments/${apptId}/checkin`);
      toast.success("Patient checked in");
      refetchAppts();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to check in"));
    } finally {
      setCheckinId(null);
    }
  };

  const handleSendWelcome = async () => {
    setMenuAnchor(null);
    try {
      setNotifProcessing(true);
      setSuccessMsg(null);
      const res = await axiosInstance.post(`/reception/notifications/patients/${id}/registration`);
      setSuccessMsg(res.data.message || "Welcome notification sent");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to send notification"));
    } finally {
      setNotifProcessing(false);
    }
  };

  const avatarColors = [ACCENTS.reception, "#7c3aed", SEMANTIC.successDark, SEMANTIC.dangerDark, SEMANTIC.warningDark, SEMANTIC.infoDark];
  const getColor = (pid: string) => avatarColors[pid.charCodeAt(0) % avatarColors.length];
  const formatAddress = (p: Patient) => [p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean).join(", ") || null;

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Skeleton height={40} width={200} sx={{ bgcolor: "action.hover", mb: 3 }} />
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
            <Skeleton variant="circular" width={84} height={84} sx={{ bgcolor: "action.hover" }} />
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
        <ErrorState title="Couldn't load patient" message={getApiErrorMessage(error, "Patient not found")} onRetry={() => refetch()} />
        <Box sx={{ textAlign: "center" }}>
          <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ mt: 2, color: ACCENT }}>Back</Button>
        </Box>
      </Box>
    );
  }

  const pagedAppointments = appointments.slice(apptPage * apptRpp, apptPage * apptRpp + apptRpp);
  const invoices = billing?.invoices || [];
  const pagedInvoices = invoices.slice(billPage * billRpp, billPage * billRpp + billRpp);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Back + primary actions */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, gap: 2, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ color: "text.secondary", textTransform: "none" }}>Back to patients</Button>
        <Stack direction="row" spacing={1.5}>
          {canEdit && (
            <Button variant="outlined" startIcon={<EventAvailableRounded />} onClick={() => navigate(`/reception/appointments/new?patientId=${id}`)}
              sx={{ color: ACCENT, borderColor: "rgba(8,145,178,0.3)", textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "rgba(8,145,178,0.08)", borderColor: ACCENT } }}>
              Book Appointment
            </Button>
          )}
          {canEdit && (
            <Button variant="contained" startIcon={<EditRounded />} onClick={() => navigate(`/reception/patients/${id}/edit`)}
              sx={{ background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", fontWeight: 600, textTransform: "none", borderRadius: 2, px: 3 }}>
              Edit
            </Button>
          )}
          <Tooltip title="More actions">
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <MoreVertRounded />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={() => { setMenuAnchor(null); setIdCardOpen(true); }}>
              <ListItemIcon><QrCode2Rounded fontSize="small" /></ListItemIcon>
              <ListItemText>Print ID Card</ListItemText>
            </MenuItem>
            {canEdit && (
              <MenuItem onClick={() => { setMenuAnchor(null); setReferralOpen(true); }}>
                <ListItemIcon><CallSplitRounded fontSize="small" /></ListItemIcon>
                <ListItemText>Refer Patient</ListItemText>
              </MenuItem>
            )}
            {canEdit && (
              <MenuItem onClick={handleSendWelcome} disabled={notifProcessing}>
                <ListItemIcon>{notifProcessing ? <HeartbeatLoader size={22} /> : <NotificationsActiveRounded fontSize="small" />}</ListItemIcon>
                <ListItemText>Send Welcome SMS</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </Stack>
      </Box>

      {readOnly && (
        <Alert severity="info" icon={false} sx={{ mb: 2.5, bgcolor: "rgba(8,145,178,0.06)", border: "1px solid rgba(8,145,178,0.2)", color: "text.secondary" }}>
          Read-only oversight view — you're viewing this patient's record; booking, editing, billing, and other actions happen in the reception/clinical panels.
        </Alert>
      )}

      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* ── Hero ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(8,145,178,0.06) 0%, rgba(56,189,248,0.03) 100%)",
        "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #0891b2, #06b6d4, #38bdf8)" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
          <Avatar sx={{ width: 68, height: 68, bgcolor: getColor(patient.patientId), fontSize: "1.6rem", fontWeight: 800, boxShadow: "0 8px 24px rgba(6,182,212,0.25)" }}>
            {getInitials(patient.firstName, patient.lastName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 800, mb: 0.75 }}>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Chip icon={<BadgeRounded sx={{ fontSize: "14px !important" }} />} label={patient.uhidNumber} size="small"
                sx={{ bgcolor: "rgba(6,182,212,0.12)", color: ACCENT, fontWeight: 700, fontFamily: "monospace" }} />
              <Chip icon={<WcRounded sx={{ fontSize: "14px !important" }} />} label={patient.genderLabel} size="small"
                sx={{ bgcolor: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 600 }} />
              <Chip icon={<BloodtypeRounded sx={{ fontSize: "14px !important" }} />} label={patient.bloodGroupLabel} size="small"
                sx={{ bgcolor: "rgba(239,68,68,0.1)", color: SEMANTIC.danger, fontWeight: 700 }} />
              {patient.age !== null && (
                <Chip label={`${patient.age} yrs`} size="small" sx={{ bgcolor: "rgba(16,185,129,0.1)", color: SEMANTIC.success, fontWeight: 600 }} />
              )}
              {patient.allergies && (
                <Chip icon={<WarningAmberRounded sx={{ fontSize: "14px !important" }} />} label="Allergies" size="small"
                  sx={{ bgcolor: "rgba(245,158,11,0.12)", color: SEMANTIC.warningDark, fontWeight: 700 }} />
              )}
            </Box>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Registered</Typography>
            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
              {new Date(patient.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ── Stat tiles ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>
        <StatCard layout="horizontal" icon={<EventRounded />} label="Appointments" value={String(stats.total)} color={ACCENT}
          sub={stats.upcoming ? `${stats.upcoming} upcoming` : "none upcoming"} />
        <StatCard layout="horizontal" icon={<CalendarTodayRounded />} label="Last visit" color="#8b5cf6"
          value={stats.lastVisit ? stats.lastVisit.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          sub={stats.lastVisit ? stats.lastVisit.getFullYear().toString() : "no visits yet"} />
        {billingEnabled && (
          <StatCard layout="horizontal" icon={<PaymentsRounded />} label="Total billed" value={formatINR(billing?.totals?.totalBilled)} color={SEMANTIC.success}
            sub={`${billing?.totals?.invoiceCount || 0} invoices`} />
        )}
        {billingEnabled && (
          <StatCard layout="horizontal" icon={<AccountBalanceWalletRounded />} label="Outstanding dues" value={formatINR(billing?.totals?.totalDues)}
            color={Number(billing?.totals?.totalDues || 0) > 0 ? SEMANTIC.danger : SEMANTIC.success}
            sub={Number(billing?.totals?.totalDues || 0) > 0 ? "due now" : "all settled"} />
        )}
      </Box>

      {/* ── Tabs ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, borderBottom: "1px solid", borderColor: "divider",
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 },
            "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<PersonRounded fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<CalendarTodayRounded fontSize="small" />} iconPosition="start" label={`Appointments${stats.total ? ` (${stats.total})` : ""}`} />
          <Tab icon={<ReceiptLongRounded fontSize="small" />} iconPosition="start" label={`Billing${invoices.length ? ` (${invoices.length})` : ""}`} disabled={!billingEnabled} />
          <Tab icon={<EventRepeatRounded fontSize="small" />} iconPosition="start" label="Records" />
          <Tab icon={<BadgeRounded fontSize="small" />} iconPosition="start" label="Consent" />
          <Tab icon={<VaccinesRounded fontSize="small" />} iconPosition="start" label="Vaccinations" />
          <Tab icon={<MedicalServicesRounded fontSize="small" />} iconPosition="start" label="Surgeries" />
          <Tab icon={<ContactPhoneRounded fontSize="small" />} iconPosition="start" label="Documents" />
        </Tabs>
      </Paper>

      {/* ── Tab: Overview ── */}
      {tab === 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, alignItems: "start" }}>
          <SectionCard title="Personal Information" icon={<PersonRounded fontSize="small" />}>
            <InfoRow icon={<CakeRounded sx={{ fontSize: 18 }} />} label="Date of Birth" value={new Date(patient.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<WcRounded sx={{ fontSize: 18 }} />} label="Gender" value={patient.genderLabel} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<BloodtypeRounded sx={{ fontSize: 18 }} />} label="Blood Group" value={patient.bloodGroupLabel} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow
              icon={<CallSplitRounded sx={{ fontSize: 18 }} />}
              label="Referred By"
              value={patient.referredByName ? `${patient.referredByName}${patient.referredByType === "INTERNAL" ? " (Internal)" : patient.referredByType === "EXTERNAL" ? " (External)" : ""}` : null}
            />
          </SectionCard>

          <SectionCard title="Contact Details" icon={<LocalPhoneRounded fontSize="small" />}>
            <InfoRow icon={<LocalPhoneRounded sx={{ fontSize: 18 }} />} label="Phone" value={patient.phone} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<EmailRounded sx={{ fontSize: 18 }} />} label="Email" value={patient.email} />
            <Divider sx={{ borderColor: "divider" }} />
            <InfoRow icon={<LocationOnRounded sx={{ fontSize: 18 }} />} label="Address" value={formatAddress(patient)} />
          </SectionCard>

          <SectionCard title="Emergency Contact" icon={<ContactPhoneRounded fontSize="small" />}>
            {patient.emergencyContactName ? (
              <>
                <InfoRow icon={<PersonRounded sx={{ fontSize: 18 }} />} label="Name" value={patient.emergencyContactName} />
                <Divider sx={{ borderColor: "divider" }} />
                <InfoRow icon={<LocalPhoneRounded sx={{ fontSize: 18 }} />} label="Phone" value={patient.emergencyContactPhone} />
                <Divider sx={{ borderColor: "divider" }} />
                <InfoRow icon={<WcRounded sx={{ fontSize: 18 }} />} label="Relationship" value={patient.emergencyContactRelation} />
              </>
            ) : (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <ContactPhoneRounded sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>No emergency contact on file</Typography>
                {canEdit && <Button size="small" onClick={() => navigate(`/reception/patients/${id}/edit`)} sx={{ color: ACCENT, textTransform: "none", mt: 0.5 }}>Add now</Button>}
              </Box>
            )}
          </SectionCard>

          <SectionCard title="Allergies & Medical Notes" icon={<WarningAmberRounded fontSize="small" />}>
            {patient.allergies ? (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Typography variant="body2" sx={{ color: SEMANTIC.warningDark, lineHeight: 1.7, fontWeight: 500 }}>{patient.allergies}</Typography>
              </Box>
            ) : (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <WarningAmberRounded sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>No known allergies recorded</Typography>
              </Box>
            )}
          </SectionCard>
        </Box>
      )}

      {/* ── Tab: Appointments ── */}
      {tab === 1 && (
        <SectionCard title="Appointment History" icon={<CalendarTodayRounded fontSize="small" />}
          action={canEdit ? <Button size="small" startIcon={<EventAvailableRounded />} onClick={() => navigate(`/reception/appointments/new?patientId=${id}`)} sx={{ textTransform: "none", color: ACCENT }}>Book</Button> : undefined}>
          {appointments.length === 0 ? (
            <Box sx={{ py: 2 }}><Mascot pose="all-caught-up" title="No appointments yet" subtitle="This patient has no appointment history." /></Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {["Date & Time", "Doctor", "Status", ""].map((h, i) => (
                        <TableCell key={h || i} align={i === 3 ? "right" : "left"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedAppointments.map((appt) => {
                      const canCheckIn = canEdit && appt.statusLabel === "Scheduled" && isToday(appt.appointmentDate);
                      return (
                        <TableRow key={appt.appointmentId} hover>
                          <TableCell sx={{ borderColor: "divider" }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                              {new Date(appt.appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {new Date(appt.appointmentDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{appt.doctorName || "Unassigned"}</TableCell>
                          <TableCell sx={{ borderColor: "divider" }}>
                            <StatusChip label={appt.statusLabel} color={appt.statusColor} />
                          </TableCell>
                          <TableCell align="right" sx={{ borderColor: "divider" }}>
                            {canCheckIn && (
                              <Button size="small" variant="contained" startIcon={checkinId === appt.appointmentId ? <HeartbeatLoader size={22} /> : <LoginRounded />}
                                disabled={checkinId === appt.appointmentId} onClick={() => handleCheckIn(appt.appointmentId)}
                                sx={{ bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark }, textTransform: "none" }}>Check in</Button>
                            )}
                            {canEdit && appt.statusLabel === "Completed" && (
                              <Button size="small" variant="outlined" startIcon={<EventRepeatRounded />}
                                onClick={() => navigate(`/reception/appointments/new?patientId=${id}&doctorId=${appt.doctorId || ""}&followUpOf=${appt.appointmentId}`)}
                                sx={{ color: ACCENT, borderColor: "rgba(8,145,178,0.4)", textTransform: "none", "&:hover": { borderColor: ACCENT, bgcolor: "rgba(8,145,178,0.06)" } }}>Follow-up</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination component="div" count={appointments.length} page={apptPage} rowsPerPage={apptRpp}
                onPageChange={(_, p) => setApptPage(p)} onRowsPerPageChange={(e) => { setApptRpp(parseInt(e.target.value, 10)); setApptPage(0); }}
                rowsPerPageOptions={[5, 10, 25]} sx={{ borderTop: "1px solid", borderColor: "divider" }} />
            </>
          )}
        </SectionCard>
      )}

      {/* ── Tab: Billing ── */}
      {tab === 2 && billingEnabled && (
        <SectionCard title="Billing & Invoices" icon={<ReceiptLongRounded fontSize="small" />}>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
            <Chip label={`Billed: ${formatINR(billing?.totals?.totalBilled)}`} sx={{ bgcolor: "action.hover", color: "text.primary", fontWeight: 700 }} />
            <Chip label={`Paid: ${formatINR(billing?.totals?.totalPaid)}`} sx={{ bgcolor: "rgba(16,185,129,0.12)", color: SEMANTIC.success, fontWeight: 700 }} />
            <Chip label={`Dues: ${formatINR(billing?.totals?.totalDues)}`}
              sx={{ bgcolor: Number(billing?.totals?.totalDues || 0) > 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: Number(billing?.totals?.totalDues || 0) > 0 ? SEMANTIC.danger : SEMANTIC.success, fontWeight: 700 }} />
            <Chip label={`Deposits: ${formatINR(billing?.totals?.totalDeposit)}`}
              sx={{ bgcolor: "rgba(8,145,178,0.12)", color: ACCENTS.reception, fontWeight: 700 }} />
          </Stack>
          {invoices.length === 0 ? (
            <Box sx={{ py: 2 }}><Mascot pose="all-caught-up" title="No invoices" subtitle="This patient has no invoices yet." /></Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {["Invoice #", "Date", "Amount", "Balance", "Status", ""].map((h, i) => (
                        <TableCell key={h || i} align={i === 5 ? "right" : "left"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedInvoices.map((inv) => (
                      <TableRow key={inv.invoiceId} hover>
                        <TableCell sx={{ borderColor: "divider", fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}>{inv.invoiceNumber}</TableCell>
                        <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                        <TableCell sx={{ borderColor: "divider", color: "text.primary", fontWeight: 600 }}>{formatINR(inv.netAmount)}</TableCell>
                        <TableCell sx={{ borderColor: "divider" }}>
                          {Number(inv.balance) > 0 ? <Typography variant="body2" sx={{ color: SEMANTIC.danger, fontWeight: 700 }}>{formatINR(inv.balance)}</Typography> : <Typography variant="body2" sx={{ color: SEMANTIC.success }}>—</Typography>}
                        </TableCell>
                        <TableCell sx={{ borderColor: "divider" }}>
                          <StatusChip label={inv.statusLabel} color={inv.statusColor} />
                        </TableCell>
                        <TableCell align="right" sx={{ borderColor: "divider" }}>
                          <Button size="small" variant={!readOnly && Number(inv.balance) > 0 ? "contained" : "text"}
                            onClick={() => setInvoiceView(inv.invoiceId)}
                            sx={!readOnly && Number(inv.balance) > 0
                              ? { textTransform: "none", bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark } }
                              : { textTransform: "none", color: ACCENTS.reception }}>
                            {!readOnly && Number(inv.balance) > 0 ? "Pay" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination component="div" count={invoices.length} page={billPage} rowsPerPage={billRpp}
                onPageChange={(_, p) => setBillPage(p)} onRowsPerPageChange={(e) => { setBillRpp(parseInt(e.target.value, 10)); setBillPage(0); }}
                rowsPerPageOptions={[5, 10, 25]} sx={{ borderTop: "1px solid", borderColor: "divider" }} />
            </>
          )}
        </SectionCard>
      )}

      {/* ── Tab: Records ── */}
      {tab === 3 && <ClinicalRecordsSection patientId={patient.patientId} />}

      {/* ── Tab: Consent ── */}
      {tab === 4 && <ConsentFormsSection patientId={patient.patientId} patientName={`${patient.firstName || ""} ${patient.lastName || ""}`.trim()} readOnly={readOnly} />}

      {/* ── Tab: Vaccinations ── */}
      {tab === 5 && (
        <VaccinationsSection
          patientId={patient.patientId}
          patientName={`${patient.firstName || ""} ${patient.lastName || ""}`.trim()}
          patientUhid={patient.uhidNumber}
          patientDob={patient.dateOfBirth}
          readOnly={readOnly}
        />
      )}

      {/* ── Tab: Surgeries ── */}
      {tab === 6 && <SurgeriesSection patientId={patient.patientId} />}

      {/* ── Tab: Documents ── */}
      {tab === 7 && <PatientDocumentsSection patientId={patient.patientId} readOnly={readOnly} />}

      <IdCardModal open={idCardOpen} onClose={() => setIdCardOpen(false)} patient={patient} />

      {invoiceView && (
        <InvoiceViewDialog open invoiceId={invoiceView} onClose={() => setInvoiceView(null)} onChanged={() => refetchBilling()} readOnly={readOnly} />
      )}

      {referralOpen && (
        <ReferralDialog
          open={referralOpen}
          onClose={() => setReferralOpen(false)}
          onCreated={() => setReferralOpen(false)}
          prefilledPatientId={patient.patientId}
          lockPatient
          patientLabel={`${patient.firstName || ""} ${patient.lastName || ""} — ${patient.uhidNumber}`}
        />
      )}
    </Box>
  );
}
