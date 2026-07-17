import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
} from "@mui/material";
import {
  HourglassBottomRounded,
  TimerOffRounded,
  BlockRounded,
  EditNoteRounded,
  RocketLaunchRounded,
  VisibilityRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import PageSkeleton from "../../components/PageSkeleton";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import { apiErrorText } from "../../utils/apiError";

// How soon (in days) an active trial counts as "expiring soon".
const EXPIRY_WINDOW_DAYS = 7;

function Section({
  icon, title, color, items, children,
}: { icon: any; title: string; color: string; items: number; children: any }) {
  if (items === 0) return null;
  return (
    <Paper elevation={2} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${color}22`, color }}>{icon}</Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "text.primary" }}>{title}</Typography>
        <Chip size="small" label={items} sx={{ ml: "auto", fontWeight: 700, bgcolor: `${color}22`, color }} />
      </Box>
      <Box>{children}</Box>
    </Paper>
  );
}

function Row({ primary, secondary, actions }: { primary: any; secondary?: any; actions: any }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none" } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "text.primary" }}>{primary}</Typography>
        {secondary && <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block" }}>{secondary}</Typography>}
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>{actions}</Box>
    </Box>
  );
}

export default function OnboardingList() {
  const navigate = useNavigate();

  const hq = useQuery({
    queryKey: ["action-hospitals"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 1000 } })).data,
  });
  const tq = useQuery({
    queryKey: ["action-trials"],
    queryFn: async () => (await axiosInstance.get("/trials", { params: { limit: 1000 } })).data,
  });

  const loading = hq.isLoading || tq.isLoading;
  const isError = hq.isError || tq.isError;

  const hospitals: any[] = hq.data?.data ?? [];
  const trials: any[] = tq.data?.data ?? [];

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

  // ── The buckets that actually need a human to act ──
  const expiring = trials
    .filter((t) => t.trialStatus === "active" && daysUntil(t.trialEndDate) <= EXPIRY_WINDOW_DAYS)
    .sort((a, b) => daysUntil(a.trialEndDate) - daysUntil(b.trialEndDate));
  const expired = trials.filter((t) => t.trialStatus === "expired");
  const suspended = hospitals.filter((h) => h.status === "suspended");
  const incomplete = hospitals.filter(
    (h) => h.status === "active" && (!h.officialPhone || !h.addressLine1 || !h.registrationNumber),
  );

  const total = expiring.length + expired.length + suspended.length + incomplete.length;

  if (loading) {
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          message={apiErrorText(hq.error) || apiErrorText(tq.error)}
          onRetry={() => { hq.refetch(); tq.refetch(); }}
        />
      </PageContainer>
    );
  }

  const summary = [
    { label: "Trials expiring", value: expiring.length, color: "#f59e0b" },
    { label: "Expired trials", value: expired.length, color: "#ef4444" },
    { label: "Suspended", value: suspended.length, color: "#ef4444" },
    { label: "Incomplete profiles", value: incomplete.length, color: "#3b82f6" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Action Needed"
        subtitle="Tenants and trials that need your attention right now."
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summary.map((s) => (
          <Grid size={{ xs: 6, md: 3 }} key={s.label}>
            <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ py: 2.5 }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: s.value ? s.color : "text.disabled" }}>{s.value}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {total === 0 ? (
        <Paper sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, p: 6, textAlign: "center" }}>
          <CheckCircleRounded sx={{ fontSize: 56, color: "#10b981", mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: "text.primary" }}>All clear</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing needs attention across your tenants right now.</Typography>
        </Paper>
      ) : (
        <>
          <Section icon={<HourglassBottomRounded />} title="Trials expiring soon" color="#f59e0b" items={expiring.length}>
            {expiring.map((t) => {
              const d = daysUntil(t.trialEndDate);
              return (
                <Row
                  key={t.hospitalTrialId}
                  primary={t.lead?.hospitalName || "Unknown"}
                  secondary={d <= 0 ? "Expires today" : `Expires in ${d} day${d === 1 ? "" : "s"} · ${new Date(t.trialEndDate).toLocaleDateString()}`}
                  actions={
                    <>
                      <Button size="small" variant="outlined" onClick={() => navigate("/trials")} sx={{ textTransform: "none" }}>Manage</Button>
                      <Button size="small" variant="contained" startIcon={<RocketLaunchRounded />} onClick={() => navigate(`/hospitals/new?trialId=${t.hospitalTrialId}`)} sx={{ textTransform: "none", background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)" }}>Convert</Button>
                    </>
                  }
                />
              );
            })}
          </Section>

          <Section icon={<TimerOffRounded />} title="Expired trials — convert or cancel" color="#ef4444" items={expired.length}>
            {expired.map((t) => (
              <Row
                key={t.hospitalTrialId}
                primary={t.lead?.hospitalName || "Unknown"}
                secondary={`Trial ended ${new Date(t.trialEndDate).toLocaleDateString()}`}
                actions={
                  <>
                    <Button size="small" variant="outlined" onClick={() => navigate("/trials")} sx={{ textTransform: "none" }}>Manage</Button>
                    <Button size="small" variant="contained" startIcon={<RocketLaunchRounded />} onClick={() => navigate(`/hospitals/new?trialId=${t.hospitalTrialId}`)} sx={{ textTransform: "none", background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)" }}>Convert</Button>
                  </>
                }
              />
            ))}
          </Section>

          <Section icon={<BlockRounded />} title="Suspended hospitals" color="#ef4444" items={suspended.length}>
            {suspended.map((h) => (
              <Row
                key={h.hospitalId}
                primary={h.hospitalName}
                secondary={`Code ${h.hospitalCode} · logins blocked`}
                actions={<Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => navigate(`/hospitals/${h.hospitalId}/overview`)} sx={{ textTransform: "none" }}>View</Button>}
              />
            ))}
          </Section>

          <Section icon={<EditNoteRounded />} title="Incomplete hospital profiles" color="#3b82f6" items={incomplete.length}>
            {incomplete.map((h) => (
              <Row
                key={h.hospitalId}
                primary={h.hospitalName}
                secondary="Admin hasn't completed the required profile details yet"
                actions={<Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => navigate(`/hospitals/${h.hospitalId}/overview`)} sx={{ textTransform: "none" }}>View</Button>}
              />
            ))}
          </Section>
        </>
      )}
    </PageContainer>
  );
}
