import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  ArrowBackRounded,
  LocalHospitalRounded,
  PeopleRounded,
  MedicalServicesRounded,
  AccountCircleRounded,
  CheckCircleRounded,
  WarningRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PageHeader from "../../components/layout/PageHeader";

export default function HospitalOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { data, isLoading: loading, isError, error, refetch } = useQuery<any>({
    queryKey: ["hospital-overview", id],
    queryFn: async () => (await axiosInstance.get(`/hospitals/${id}/overview`)).data.data,
    enabled: !!id,
  });

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <ErrorState
          title="Couldn't load hospital"
          message={(error as any)?.response?.data?.message || "Hospital not found"}
          onRetry={() => refetch()}
        />
      </Container>
    );
  }

  const mainBranch = data.branches?.[0];
  const activePlan = mainBranch?.subscriptionPlan?.planName || "No Plan Assigned";
  const onboardingStatus = data.onboarding?.[0]?.onboardingStatus || "unknown";
  const trial = data.lead?.trials?.[0]; // Get most recent trial if exists

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2 }}>
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate("/hospitals")}
          sx={{ color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}
        >
          Back
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <PageHeader title={`${data.hospitalName} Overview`} />
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Profile Card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", mb: 4 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
              <Box>
                <Typography variant="h5" fontWeight="700" sx={{ color: "text.primary", mb: 1 }}>
                  Profile Information
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Code: {data.hospitalCode} • Created: {new Date(data.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Chip 
                label={data.status === "active" ? "Active" : "Inactive"} 
                color={data.status === "active" ? "success" : "default"}
                sx={{ fontWeight: 600, borderRadius: 2 }}
              />
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Official Email</Typography>
                <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 500 }}>{data.officialEmail || "N/A"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Official Phone</Typography>
                <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 500 }}>{data.officialPhone || "N/A"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Legal Business Name</Typography>
                <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 500 }}>{data.legalBusinessName || "N/A"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Subscription Plan</Typography>
                <Typography variant="body1" sx={{ color: "#8b5cf6", fontWeight: 700 }}>{activePlan}</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Metrics Row */}
          <Grid container spacing={3}>
            {[
              { label: "Total Branches", value: data.branches?.length || 0, icon: <LocalHospitalRounded sx={{ fontSize: 40, color: "#6366f1" }}/>, color: "rgba(99, 102, 241, 0.1)" },
              { label: "Registered Doctors", value: data._count?.doctors || 0, icon: <MedicalServicesRounded sx={{ fontSize: 40, color: "#10b981" }}/>, color: "rgba(16, 185, 129, 0.1)" },
              { label: "Registered Patients", value: data._count?.patients || 0, icon: <PeopleRounded sx={{ fontSize: 40, color: "#f59e0b" }}/>, color: "rgba(245, 158, 11, 0.1)" },
              { label: "Active Users", value: data._count?.users || 0, icon: <AccountCircleRounded sx={{ fontSize: 40, color: "#3b82f6" }}/>, color: "rgba(59, 130, 246, 0.1)" },
            ].map((stat, idx) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                <Card sx={{ bgcolor: "background.paper", borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
                  <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <Box sx={{ p: 2, borderRadius: "50%", bgcolor: stat.color, mb: 2 }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="h4" fontWeight="800" sx={{ color: "text.primary", mb: 0.5 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                      {stat.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Branches Table */}
        <Box sx={{ mt: 4 }}>
          <Paper sx={{ p: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", mt: 4 }}>
            <Typography variant="h6" fontWeight="700" sx={{ color: "text.primary", mb: 3 }}>
              Branches
            </Typography>
            {data.branches && data.branches.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Branch Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Plan</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.branches.map((branch: any) => (
                      <TableRow key={branch.branchId} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{branch.branchCode}</TableCell>
                        <TableCell>{branch.branchName}</TableCell>
                        <TableCell>
                          {[branch.city, branch.state, branch.country].filter(Boolean).join(", ") || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={branch.subscriptionPlan?.planName || "None"} 
                            sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6", fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small"
                            label={branch.status} 
                            color={branch.status === "active" ? "success" : "default"}
                            sx={{ fontWeight: 600, textTransform: "capitalize" }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No branches found.</Typography>
            )}
          </Paper>
        </Box>

        {/* Status Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", mb: 4 }}>
            <Typography variant="h6" fontWeight="700" sx={{ color: "text.primary", mb: 3 }}>
              Onboarding Status
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {onboardingStatus === "completed" ? (
                <CheckCircleRounded sx={{ color: "#10b981", fontSize: 32 }} />
              ) : (
                <WarningRounded sx={{ color: "#f59e0b", fontSize: 32 }} />
              )}
              <Box>
                <Typography variant="body1" fontWeight="600" sx={{ color: "text.primary", textTransform: "capitalize" }}>
                  {onboardingStatus.replace("_", " ")}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {onboardingStatus === "completed" ? "Hospital is fully operational" : "Setup is currently pending"}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Paper sx={{ p: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" fontWeight="700" sx={{ color: "text.primary", mb: 3 }}>
              Trial Details
            </Typography>
            {trial ? (
              <Box>
                <Chip 
                  label={trial.trialStatus} 
                  sx={{ 
                    mb: 2, 
                    fontWeight: 600, 
                    borderRadius: 2,
                    color: trial.trialStatus === "active" ? "#10b981" : "#ef4444",
                    bgcolor: trial.trialStatus === "active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                  }} 
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Start Date</Typography>
                    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>
                      {new Date(trial.trialStartDate).toLocaleDateString()}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>End Date</Typography>
                    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>
                      {new Date(trial.trialEndDate).toLocaleDateString()}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                No trial associated with this hospital account.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
