import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import type { ReactNode } from "react";
import type {
  HospitalOverviewData, OverviewBranch, OverviewUser, SubscriptionInvoiceRow,
  HospitalTrialRow, PlanRow,
} from "./hospitalOverview.types";
import { getApiErrorMessage } from "@/utils/apiError";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  Avatar,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Alert,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  ArrowBackRounded,
  PeopleRounded,
  MedicalServicesRounded,
  AccountCircleRounded,
  ApartmentRounded,
  BadgeRounded,
  CardMembershipRounded,
  HandshakeRounded,
  PersonRounded,
  EditRounded,
  WidgetsRounded,
  CheckCircleRounded,
  CancelRounded, FactCheckRounded,
  LockResetRounded,
  ContentCopyRounded,
  SwapHorizRounded,
  PrintRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import StatCard from "@/components/StatCard";
import { assetUrl } from "@/utils/assetUrl";
import { formatINR, formatDate } from "@/utils/format";

const ACCENT = BRAND.action;

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <Grid size={{ xs: 12, sm: 6 }}>
    <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
    <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 500, wordBreak: "break-word" }}>
      {value === 0 ? 0 : value || "—"}
    </Typography>
  </Grid>
);

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, mt: 1, mb: 1.5 }}>
    {children}
  </Typography>
);

const Panel = ({ value, index, children }: { value: number; index: number; children: ReactNode }) =>
  value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;

const cardSx = { p: { xs: 2.5, md: 4 }, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" };

export default function HospitalOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [resetCreds, setResetCreds] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const toast = useToast();

  const { data, isLoading: loading, isError, error, refetch } = useQuery<HospitalOverviewData>({
    queryKey: ["hospital-overview", id],
    queryFn: async () => (await axiosInstance.get(`/hospitals/${id}/overview`)).data.data,
    enabled: !!id,
  });

  const resetPassword = useMutation({
    mutationFn: async () => (await axiosInstance.post(`/hospitals/${id}/reset-admin-password`)).data.data,
    onSuccess: (creds) => {
      setResetCreds(creds);
      queryClient.invalidateQueries({ queryKey: ["hospital-overview", id] });
    },
  });

  const { data: plans = [] } = useQuery<PlanRow[]>({
    queryKey: ["plans", "change-plan-options"],
    queryFn: async () => (await axiosInstance.get("/plans", { params: { limit: 100 } })).data.data,
    enabled: changePlanOpen,
  });

  const changePlan = useMutation({
    mutationFn: async (newPlanId: string) => (await axiosInstance.post(`/hospitals/${id}/change-plan`, { newPlanId })).data.data,
    onSuccess: (res: { message?: string } | null) => {
      toast.success(res?.message || "Plan updated");
      setChangePlanOpen(false);
      setSelectedPlanId("");
      queryClient.invalidateQueries({ queryKey: ["hospital-overview", id] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to change plan")),
  });

  if (loading) {
    return <DetailSkeleton />;
  }
  if (isError || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <ErrorState title="Couldn't load hospital" message={getApiErrorMessage(error, "Hospital not found")} onRetry={() => refetch()} />
      </Container>
    );
  }

  const onboarding = data.onboarding?.[0];
  const activeTrial = data.lead?.trials?.find((t) => t.trialStatus === "active");
  const trials: HospitalTrialRow[] = data.lead?.trials ?? [];
  const users: OverviewUser[] = data.users ?? [];
  const activePlan = data.branches?.[0]?.subscriptionPlan?.planName || "No plan assigned";
  const billing = data.billing;
  const quotas = data.quotas;

  const billingState: Record<string, { label: string; color: string }> = {
    active: { label: "Billing current", color: SEMANTIC.success },
    overdue: { label: "Payment overdue", color: SEMANTIC.warning },
    suspended: { label: "Suspended (unpaid)", color: SEMANTIC.danger },
  };
  const PHASE: Record<string, "default" | "success" | "warning" | "error" | "secondary"> = {
    PAID: "success", PENDING: "default", OVERDUE: "warning", SUSPENDED: "error", VOID: "secondary",
  };
  const quotaText = (q: { used: number | null; limit: number | null } | undefined) =>
    !q ? "—" : q.limit != null ? `of ${q.limit} allowed` : "no limit";

  const lifecycle =
    data.status === "suspended" ? { label: "Suspended", color: SEMANTIC.danger }
    : activeTrial ? { label: "On Trial", color: SEMANTIC.warning }
    : data.status === "active" ? { label: "Active", color: SEMANTIC.success }
    : { label: data.status || "Inactive", color: NEUTRAL.muted };

  const initials = (data.hospitalName || "H").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/hospitals")} sx={{ color: "text.secondary", mb: 2 }}>
        Back to hospitals
      </Button>

      {/* ── Header card ── */}
      <Paper sx={{ ...cardSx, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
          <Avatar
            src={data.logoUrl ? assetUrl(data.logoUrl) : undefined}
            sx={{ width: 68, height: 68, borderRadius: 3, fontSize: "1.5rem", fontWeight: 800 }}
            variant="rounded"
          >
            {data.logoUrl ? null : initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} sx={{ color: "text.primary" }} noWrap>{data.hospitalName}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
              <Chip size="small" label={lifecycle.label} sx={{ fontWeight: 700, bgcolor: `${lifecycle.color}22`, color: lifecycle.color }} />
              {billing && billing.state !== "active" && (
                <Chip size="small" label={billingState[billing.state]?.label} sx={{ fontWeight: 700, bgcolor: `${billingState[billing.state]?.color}22`, color: billingState[billing.state]?.color }} />
              )}
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{data.hospitalCode}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>· {activePlan}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>· Joined {formatDate(data.createdAt)}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<WidgetsRounded />} onClick={() => navigate(`/hospitals/${id}/modules`)} sx={{ textTransform: "none", borderColor: "divider", color: "text.primary" }}>Modules</Button>
            <Button variant="contained" startIcon={<EditRounded />} onClick={() => navigate(`/hospitals/${id}/edit`)} sx={{ textTransform: "none", background: `linear-gradient(135deg, ${ACCENT}, ${BRAND.actionDark})` }}>Edit</Button>
          </Box>
        </Box>

        {/* Stat tiles */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid size={{ xs: 6, md: 3 }}><StatCard layout="horizontal" icon={<ApartmentRounded />} label="Branches" value={quotas?.branches?.used ?? data.branches?.length ?? 0} sub={quotaText(quotas?.branches)} color={ACCENT} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard layout="horizontal" icon={<MedicalServicesRounded />} label="Doctors" value={quotas?.doctors?.used ?? data._count?.doctors ?? 0} sub={quotaText(quotas?.doctors)} color={SEMANTIC.success} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard layout="horizontal" icon={<PeopleRounded />} label="Patients" value={data._count?.patients || 0} color={SEMANTIC.warning} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><StatCard layout="horizontal" icon={<AccountCircleRounded />} label="Users" value={data._count?.users || 0} color={SEMANTIC.info} /></Grid>
        </Grid>
      </Paper>

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<PersonRounded fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<ApartmentRounded fontSize="small" />} iconPosition="start" label={`Branches (${data.branches?.length || 0})`} />
          <Tab icon={<BadgeRounded fontSize="small" />} iconPosition="start" label={`Staff & Users (${users.length})`} />
          <Tab icon={<CardMembershipRounded fontSize="small" />} iconPosition="start" label="Subscription" />
          <Tab icon={<HandshakeRounded fontSize="small" />} iconPosition="start" label="Pipeline" />
        </Tabs>
      </Box>

      {/* ── Overview ── */}
      <Panel value={tab} index={0}>
        <Paper sx={{ ...cardSx, mb: 3 }}>
          <SectionTitle>Identity &amp; Compliance</SectionTitle>
          <Grid container spacing={3}>
            <InfoRow label="Legal Business Name" value={data.legalBusinessName} />
            <InfoRow label="Registration Number" value={data.registrationNumber} />
            <InfoRow label="GST Number" value={data.gstNumber} />
            <InfoRow label="Ownership Type" value={data.ownershipType} />
            <InfoRow label="Accreditation" value={data.accreditationType} />
            <InfoRow label="License Expiry" value={data.licenseExpiryDate ? formatDate(data.licenseExpiryDate) : null} />
          </Grid>
          <Divider sx={{ my: 2.5 }} />
          <SectionTitle>Contact</SectionTitle>
          <Grid container spacing={3}>
            <InfoRow label="Official Email" value={data.officialEmail} />
            <InfoRow label="Official Phone" value={data.officialPhone} />
            <InfoRow label="Emergency Phone" value={data.emergencyPhone} />
            <InfoRow label="Support Email" value={data.supportEmail} />
            <InfoRow label="Support Phone" value={data.supportPhone} />
            <InfoRow label="Website" value={data.websiteUrl} />
          </Grid>
          <Divider sx={{ my: 2.5 }} />
          <SectionTitle>Address</SectionTitle>
          <Grid container spacing={3}>
            <InfoRow label="Address Line 1" value={data.addressLine1} />
            <InfoRow label="Address Line 2" value={data.addressLine2} />
            <InfoRow label="Landmark" value={data.landmark} />
            <InfoRow label="Postal Code" value={data.postalCode} />
          </Grid>
          <Divider sx={{ my: 2.5 }} />
          <SectionTitle>Localization</SectionTitle>
          <Grid container spacing={3}>
            <InfoRow label="Currency" value={data.currencyCode} />
            <InfoRow label="Language" value={data.languageCode} />
            <InfoRow label="Timezone" value={data.timezone} />
            <InfoRow label="Bed Capacity" value={data.bedCapacity} />
            <InfoRow label="Custom Domain" value={data.customDomain} />
          </Grid>
        </Paper>

        <Paper sx={cardSx}>
          <SectionTitle>Admin &amp; Access</SectionTitle>
          {data.admin ? (
            <Grid container spacing={3}>
              <InfoRow label="Hospital Admin" value={[data.admin.firstName, data.admin.lastName].filter(Boolean).join(" ")} />
              <InfoRow label="Login Email" value={data.admin.email} />
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  {data.admin.mustChangePassword
                    ? <Chip size="small" label="Password not set yet" sx={{ bgcolor: "rgba(245,158,11,0.12)", color: SEMANTIC.warning, fontWeight: 600 }} />
                    : <Chip size="small" label="Active login" sx={{ bgcolor: "rgba(16,185,129,0.12)", color: SEMANTIC.success, fontWeight: 600 }} />}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LockResetRounded />}
                    disabled={resetPassword.isPending}
                    onClick={() => resetPassword.mutate()}
                    sx={{ textTransform: "none", borderColor: "divider", color: "text.primary" }}
                  >
                    {resetPassword.isPending ? "Resetting…" : "Reset password"}
                  </Button>
                </Box>
                {resetPassword.isError && (
                  <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 1 }}>
                    {getApiErrorMessage(resetPassword.error, "Failed to reset password.")}
                  </Typography>
                )}
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>No admin user found.</Typography>
          )}
          {data.lead && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <SectionTitle>Sales Contact (lead)</SectionTitle>
              <Grid container spacing={3}>
                <InfoRow label="Contact Person" value={data.lead.contactPersonName} />
                <InfoRow label="Email" value={data.lead.email} />
                <InfoRow label="Phone" value={data.lead.phone} />
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Lead Status</Typography>
                  <Box><Chip size="small" label={data.lead.leadStatus} sx={{ textTransform: "capitalize", bgcolor: "rgba(99,102,241,0.1)", color: "#818cf8", fontWeight: 600 }} /></Box>
                </Grid>
              </Grid>
            </>
          )}
        </Paper>
      </Panel>

      {/* ── Branches ── */}
      <Panel value={tab} index={1}>
        <Paper sx={{ ...cardSx, p: 0 }}>
          {data.branches?.length ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Code", "Branch Name", "Location", "Plan", "Status"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.branches.map((b: OverviewBranch) => (
                    <TableRow key={b.branchId} hover>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{b.branchCode}</TableCell>
                      <TableCell>{b.branchName}</TableCell>
                      <TableCell>{[b.city, b.state, b.country].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell><Chip size="small" label={b.subscriptionPlan?.planName || "None"} sx={{ bgcolor: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 600 }} /></TableCell>
                      <TableCell><Chip size="small" label={b.status} color={b.status === "active" ? "success" : "default"} sx={{ fontWeight: 600, textTransform: "capitalize" }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Box sx={{ p: 4 }}><Typography color="text.secondary">No branches found.</Typography></Box>}
        </Paper>
      </Panel>

      {/* ── Staff & Users ── */}
      <Panel value={tab} index={2}>
        <Paper sx={{ ...cardSx, p: 0 }}>
          {users.length ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Name", "Email", "Role", "Status"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.userId} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{u.email}</TableCell>
                      <TableCell>{u.role?.roleName || u.role?.roleCode || "—"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.isActive && u.status === "active" ? "Active" : "Inactive"} color={u.isActive && u.status === "active" ? "success" : "default"} sx={{ fontWeight: 600 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Box sx={{ p: 4 }}><Typography color="text.secondary">No users yet.</Typography></Box>}
        </Paper>
      </Panel>

      {/* ── Subscription ── */}
      <Panel value={tab} index={3}>
        {billing && (
          <Paper sx={{ ...cardSx, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
              <SectionTitle>Subscription Billing</SectionTitle>
              <Chip size="small" label={billingState[billing.state]?.label} sx={{ fontWeight: 700, bgcolor: `${billingState[billing.state]?.color}22`, color: billingState[billing.state]?.color }} />
              {billing.pendingPlanName && (
                <Chip size="small" label={`Downgrade → ${billing.pendingPlanName} (next cycle)`} sx={{ fontWeight: 600, bgcolor: "rgba(245,158,11,0.12)", color: SEMANTIC.warning }} />
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" startIcon={<SwapHorizRounded />} onClick={() => setChangePlanOpen(true)} sx={{ textTransform: "none", borderColor: "divider", color: "text.primary" }}>
                Change plan
              </Button>
            </Box>
            <Grid container spacing={3}>
              <InfoRow label="Billing cycle" value={billing.cycle === "ANNUAL" ? "Annual" : "Monthly"} />
              <InfoRow label={billing.cycle === "ANNUAL" ? "Amount / year" : "Amount / month"} value={formatINR(billing.cycleAmount)} />
              <InfoRow label="MRR (this tenant)" value={formatINR(billing.mrr)} />
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Outstanding</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: Number(billing.outstanding) > 0 ? SEMANTIC.danger : SEMANTIC.success }}>
                  {formatINR(billing.outstanding)}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />
            <SectionTitle>Invoice history</SectionTitle>
            {billing.invoices?.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Invoice #", "Period", "Amount", "Status", "Due", ""].map((h, i) => (
                        <TableCell key={h || i} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {billing.invoices.map((inv: SubscriptionInvoiceRow) => (
                      <TableRow key={inv.subscriptionInvoiceId} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{inv.invoiceNumber}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{formatINR(inv.amount)}</TableCell>
                        <TableCell><Chip size="small" label={inv.phase.charAt(0) + inv.phase.slice(1).toLowerCase()} color={PHASE[inv.phase] || "default"} /></TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{formatDate(inv.dueDate)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Print / download invoice">
                            <IconButton size="small" onClick={() => window.open(`/subscription-billing/invoices/${inv.subscriptionInvoiceId}/print`, "_blank")}><PrintRounded sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                No invoices yet. Run “Generate Due Invoices” on the Billing page to bill this tenant.
              </Typography>
            )}
          </Paper>
        )}

        <Paper sx={{ ...cardSx, mb: 3 }}>
          <SectionTitle>Plans by branch</SectionTitle>
          <Grid container spacing={2}>
            {data.branches?.length ? data.branches.map((b: OverviewBranch) => (
              <Grid size={{ xs: 12, sm: 6 }} key={b.branchId}>
                <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="body2" fontWeight={700}>{b.branchName}</Typography>
                  <Chip size="small" label={b.subscriptionPlan?.planName || "No Plan"} sx={{ mt: 0.5, bgcolor: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 600 }} />
                </Box>
              </Grid>
            )) : <Grid size={{ xs: 12 }}><Typography color="text.secondary">No branches/plans.</Typography></Grid>}
          </Grid>
        </Paper>
        <Paper sx={cardSx}>
          <SectionTitle>Onboarding</SectionTitle>
          {onboarding ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { label: "Tenant setup completed", ok: onboarding.tenantSetupCompleted },
                { label: "Default roles seeded", ok: onboarding.defaultRolesSeeded },
                { label: "Payment verified", ok: onboarding.paymentVerified },
              ].map((row) => (
                <Box key={row.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {row.ok ? <CheckCircleRounded sx={{ color: SEMANTIC.success, fontSize: 20 }} /> : <CancelRounded sx={{ color: "text.disabled", fontSize: 20 }} />}
                  <Typography variant="body2" sx={{ color: "text.primary" }}>{row.label}</Typography>
                </Box>
              ))}

              {/* This checklist is where an unverified payment is SEEN, and it used
                  to be the end of the road — the toggle that clears it lives on the
                  onboarding record, which you had to know to go and find. */}
              {onboarding.hospitalOnboardingId && (
                <Button
                  size="small"
                  variant={onboarding.paymentVerified ? "text" : "outlined"}
                  startIcon={<FactCheckRounded />}
                  onClick={() => navigate(`/onboarding/${onboarding.hospitalOnboardingId}/edit`)}
                  sx={{ alignSelf: "flex-start", mt: 1, textTransform: "none", fontWeight: 700 }}
                >
                  {onboarding.paymentVerified ? "Review onboarding checklist" : "Verify payment & onboarding"}
                </Button>
              )}
              <Chip size="small" label={(onboarding.onboardingStatus || "pending").replace("_", " ")} sx={{ mt: 1, alignSelf: "flex-start", textTransform: "capitalize", fontWeight: 600 }} />
            </Box>
          ) : <Typography color="text.secondary">No onboarding record.</Typography>}
        </Paper>
      </Panel>

      {/* ── Pipeline ── */}
      <Panel value={tab} index={4}>
        <Paper sx={{ ...cardSx, mb: 3 }}>
          <SectionTitle>Lead</SectionTitle>
          {data.lead ? (
            <Grid container spacing={3}>
              <InfoRow label="Hospital Name (lead)" value={data.lead.hospitalName} />
              <InfoRow label="Contact Person" value={data.lead.contactPersonName} />
              <InfoRow label="Email" value={data.lead.email} />
              <InfoRow label="Phone" value={data.lead.phone} />
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Status</Typography>
                <Box><Chip size="small" label={data.lead.leadStatus} sx={{ textTransform: "capitalize", fontWeight: 600 }} /></Box>
              </Grid>
            </Grid>
          ) : <Typography color="text.secondary">This hospital wasn't created from a lead.</Typography>}
        </Paper>
        <Paper sx={cardSx}>
          <SectionTitle>Trials</SectionTitle>
          {trials.length ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Start", "End", "Auto-expire", "Status"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trials.map((t) => (
                    <TableRow key={t.hospitalTrialId} hover>
                      <TableCell>{formatDate(t.trialStartDate)}</TableCell>
                      <TableCell>{formatDate(t.trialEndDate)}</TableCell>
                      <TableCell>{t.autoExpire ? "Yes" : "No"}</TableCell>
                      <TableCell><Chip size="small" label={t.trialStatus} sx={{ textTransform: "capitalize", fontWeight: 600 }} color={t.trialStatus === "active" ? "primary" : t.trialStatus === "converted" ? "success" : "default"} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Typography color="text.secondary">No trials for this hospital.</Typography>}
        </Paper>
      </Panel>

      {/* ── Change plan ── */}
      <Dialog open={changePlanOpen} onClose={() => setChangePlanOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Change subscription plan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Current: <strong>{activePlan}</strong> · {billing?.cycle === "ANNUAL" ? "Annual" : "Monthly"} billing
          </Typography>
          <TextField select fullWidth size="small" label="New plan" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
            {plans.length === 0 ? (
              <MenuItem value="" disabled>Loading plans…</MenuItem>
            ) : (
              plans.map((p) => (
                <MenuItem key={p.planId} value={p.planId} disabled={p.planId === billing?.currentPlanId}>
                  {p.planName} — ₹{billing?.cycle === "ANNUAL" ? `${p.annualPrice}/yr` : `${p.monthlyPrice}/mo`}
                  {p.planId === billing?.currentPlanId ? " (current)" : ""}
                </MenuItem>
              ))
            )}
          </TextField>
          <Alert severity="info" sx={{ mt: 2 }}>
            Upgrades apply immediately with a prorated charge for the rest of this period. Downgrades take effect at the next billing cycle (the tenant keeps its current plan until then).
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setChangePlanOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" disabled={!selectedPlanId || changePlan.isPending} onClick={() => changePlan.mutate(selectedPlanId)} sx={{ textTransform: "none" }}>
            {changePlan.isPending ? "Applying…" : "Change plan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── New admin credentials (shown once after a reset) ── */}
      <Dialog open={!!resetCreds} onClose={() => setResetCreds(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New admin credentials</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This password is shown only once. Copy it and hand it to the hospital admin — they'll be asked to change it on first login.
          </Alert>
          {resetCreds && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[
                { label: "Login email", value: resetCreds.email },
                { label: "Temporary password", value: resetCreds.temporaryPassword, mono: true },
              ].map((f) => (
                <Box key={f.label}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{f.label}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontFamily: f.mono ? "monospace" : undefined, fontWeight: 600, wordBreak: "break-all" }}>
                      {f.value}
                    </Typography>
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={() => navigator.clipboard?.writeText(f.value)}>
                        <ContentCopyRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetCreds(null)} variant="contained" sx={{ textTransform: "none" }}>Done</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
