import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/utils/format";
import { actionBuckets, daysUntil } from "./actionNeeded";
import { useNavigate } from "react-router-dom";
import { SEMANTIC, BRAND } from "@/styles/accents";
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
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import PageSkeleton from "@/components/PageSkeleton";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";

// How soon (in days) an active trial counts as "expiring soon".

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

  // Bucketing lives in actionNeeded.ts so its two awkward rules — the
  // expiring window bounded at both ends, and counting distinct tenants
  // across overlapping buckets — are covered by tests rather than by eye.
  const {
    expiring, expired, suspended, overdue, incomplete,
    trialCount, hospitalCount, total,
  } = actionBuckets(trials, hospitals);

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
    { label: "Trials expiring", value: expiring.length, color: SEMANTIC.warning },
    { label: "Expired trials", value: expired.length, color: SEMANTIC.danger },
    { label: "Suspended", value: suspended.length, color: SEMANTIC.danger },
    { label: "Payment overdue", value: overdue.length, color: SEMANTIC.warning },
    { label: "Incomplete profiles", value: incomplete.length, color: SEMANTIC.info },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Action Needed"
        subtitle={
          total === 0
            ? "Tenants and trials that need your attention right now."
            : `${hospitalCount} tenant${hospitalCount === 1 ? "" : "s"} and ${trialCount} trial${trialCount === 1 ? "" : "s"} need attention. One tenant can appear under more than one heading.`
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summary.map((s) => (
          <Grid size={{ xs: 6, md: 2.4 }} key={s.label}>
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
          <CheckCircleRounded sx={{ fontSize: 56, color: SEMANTIC.success, mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: "text.primary" }}>All clear</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing needs attention across your tenants right now.</Typography>
        </Paper>
      ) : (
        <>
          <Section icon={<HourglassBottomRounded />} title="Trials expiring soon" color={SEMANTIC.warning} items={expiring.length}>
            {expiring.map((t) => {
              const d = daysUntil(t.trialEndDate);
              return (
                <Row
                  key={t.hospitalTrialId}
                  primary={t.lead?.hospitalName || "Unknown"}
                  secondary={d <= 0 ? "Expires today" : `Expires in ${d} day${d === 1 ? "" : "s"} · ${formatDate(t.trialEndDate)}`}
                  actions={
                    <>
                      <Button size="small" variant="outlined" onClick={() => navigate("/trials")} sx={{ textTransform: "none" }}>Manage</Button>
                      <Button size="small" variant="contained" startIcon={<RocketLaunchRounded />} onClick={() => navigate(`/hospitals/new?trialId=${t.hospitalTrialId}`)} sx={{ textTransform: "none", background: `linear-gradient(135deg, ${BRAND.action} 0%, ${BRAND.actionDark} 100%)` }}>Convert</Button>
                    </>
                  }
                />
              );
            })}
          </Section>

          <Section icon={<TimerOffRounded />} title="Expired trials — convert or cancel" color={SEMANTIC.danger} items={expired.length}>
            {expired.map((t) => (
              <Row
                key={t.hospitalTrialId}
                primary={t.lead?.hospitalName || "Unknown"}
                secondary={`Trial ended ${formatDate(t.trialEndDate)}`}
                actions={
                  <>
                    <Button size="small" variant="outlined" onClick={() => navigate("/trials")} sx={{ textTransform: "none" }}>Manage</Button>
                    <Button size="small" variant="contained" startIcon={<RocketLaunchRounded />} onClick={() => navigate(`/hospitals/new?trialId=${t.hospitalTrialId}`)} sx={{ textTransform: "none", background: `linear-gradient(135deg, ${BRAND.action} 0%, ${BRAND.actionDark} 100%)` }}>Convert</Button>
                  </>
                }
              />
            ))}
          </Section>

          <Section icon={<BlockRounded />} title="Suspended hospitals" color={SEMANTIC.danger} items={suspended.length}>
            {suspended.map((h) => (
              <Row
                key={h.hospitalId}
                primary={h.hospitalName}
                secondary={`Code ${h.hospitalCode} · logins blocked`}
                actions={<Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => navigate(`/hospitals/${h.hospitalId}/overview`)} sx={{ textTransform: "none" }}>View</Button>}
              />
            ))}
          </Section>

          <Section icon={<HourglassBottomRounded />} title="Payment overdue — grace period" color={SEMANTIC.warning} items={overdue.length}>
            {overdue.map((h) => (
              <Row
                key={h.hospitalId}
                primary={h.hospitalName}
                secondary={`Code ${h.hospitalCode} · subscription payment overdue — suspends after the grace period`}
                actions={<Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => navigate(`/hospitals/${h.hospitalId}/overview`)} sx={{ textTransform: "none" }}>View</Button>}
              />
            ))}
          </Section>

          <Section icon={<EditNoteRounded />} title="Incomplete hospital profiles" color={SEMANTIC.info} items={incomplete.length}>
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
