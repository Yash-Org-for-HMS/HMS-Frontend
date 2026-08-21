import { Box, Grid, Button } from "@mui/material";
import { SEMANTIC } from "@/styles/accents";
import {
  ScienceRounded, CheckCircleRounded, PendingActionsRounded, BiotechRounded,
  AttachMoneyRounded, CrisisAlertRounded, MonitorHeartRounded,
} from "@mui/icons-material";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import { apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";

const inr = (v: number | null | undefined) => formatINR(v, 0);

/** Days when it's been more than one, else hours — an 8-day-old order shouldn't read "208h". */
const ageLabel = (days: number, hours: number) => (days >= 1 ? `${days}d` : `${hours}h`);
/** Anything sitting for a day is late; two days is a problem. */
const ageSeverity = (days: number): "critical" | "warning" | "info" =>
  days >= 2 ? "critical" : days >= 1 ? "warning" : "info";

export default function LabDashboard() {
  const navigate = useNavigate();

  // One server-side aggregate. This page used to GET /lab/orders and
  // /lab/radiology-orders with no paging — which returns the FULL history — and
  // reduce the lot in the browser to produce four numbers.
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["lab-dashboard"],
    queryFn: async () => (await axiosInstance.get("/lab/dashboard-stats")).data.data,
  });

  const lab = data?.lab ?? { pending: 0, completedToday: 0, revenueToday: 0 };
  const rad = data?.radiology ?? { pending: 0, completedToday: 0, revenueToday: 0 };
  const criticals: any[] = data?.criticalUnacknowledged ?? [];
  const pendingLab: any[] = data?.pendingLab ?? [];
  const pendingRad: any[] = data?.pendingRadiology ?? [];

  if (loading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <Box>
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Lab & Radiology Overview"
        subtitle="What's waiting, oldest first, across the laboratory and radiology departments."
        actions={
          // These were a "Quick Actions" panel occupying a full third of the
          // page for two buttons, which squeezed the two data tables until
          // their headings and patient names wrapped onto three lines.
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <Button variant="outlined" onClick={() => navigate("/lab/radiology")} startIcon={<BiotechRounded />} sx={{ borderRadius: 2, textTransform: "none" }}>
              Radiology
            </Button>
            <Button variant="contained" onClick={() => navigate("/lab/orders")} startIcon={<ScienceRounded />} sx={{ borderRadius: 2, textTransform: "none" }}>
              Lab worklist
            </Button>
          </Box>
        }
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Lab pending" value={lab.pending}
            sub={pendingLab[0] ? `oldest ${ageLabel(pendingLab[0].ageDays, pendingLab[0].ageHours)}` : "Nothing waiting"}
            icon={<ScienceRounded sx={{ color: SEMANTIC.info }} />} color={SEMANTIC.info}
            onClick={() => navigate("/lab/orders")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Radiology pending" value={rad.pending}
            sub={pendingRad[0] ? `oldest ${ageLabel(pendingRad[0].ageDays, pendingRad[0].ageHours)}` : "Nothing waiting"}
            icon={<BiotechRounded sx={{ color: SEMANTIC.warning }} />} color={SEMANTIC.warning}
            onClick={() => navigate("/lab/radiology")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Completed today" value={lab.completedToday + rad.completedToday}
            sub={`${lab.completedToday} lab · ${rad.completedToday} radiology`}
            icon={<CheckCircleRounded sx={{ color: SEMANTIC.success }} />} color={SEMANTIC.success}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Paid today" value={inr(lab.revenueToday + rad.revenueToday)}
            sub="On orders raised today"
            icon={<AttachMoneyRounded sx={{ color: SEMANTIC.success }} />} color={SEMANTIC.success}
          />
        </Grid>
      </Grid>

      {/* The one clinically time-critical thing in this department, and the
          dashboard never showed it. Only rendered when there are any. */}
      {criticals.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <AttentionList
            title="Critical results awaiting acknowledgement"
            subtitle="Oldest first — the ordering doctor has not signed these off yet"
            items={criticals.map((c) => ({
              id: c.labReportId,
              primary: `${c.patientName} — ${c.testName}`,
              secondary: `Result: ${c.resultValue ?? "—"}`,
              meta: c.ageHours >= 24 ? `${Math.floor(c.ageHours / 24)}d` : `${c.ageHours}h`,
              severity: "critical" as const,
              icon: <CrisisAlertRounded sx={{ fontSize: 18 }} />,
              onClick: () => navigate("/lab/orders"),
            }))}
            actionLabel="Lab worklist"
            onAction={() => navigate("/lab/orders")}
          />
        </Box>
      )}

      {/* Two columns, not three. Both lists are ranked oldest-first: in a lab
          the oldest pending order is the one that needs chasing, and the old
          layout sorted newest-first with no age shown at all. */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AttentionList
            title="Lab orders waiting"
            subtitle="Longest waiting first"
            emptyText="No pending lab orders — the bench is clear."
            items={pendingLab.map((o) => ({
              id: o.labOrderId,
              primary: o.patientName,
              secondary: [o.status, o.sampleBarcode, o.priority?.label].filter(Boolean).join(" · "),
              meta: ageLabel(o.ageDays, o.ageHours),
              severity: ageSeverity(o.ageDays),
              icon: <PendingActionsRounded sx={{ fontSize: 18 }} />,
              onClick: () => navigate("/lab/orders"),
            }))}
            maxRows={6}
            totalCount={lab.pending}
            actionLabel="Lab worklist"
            onAction={() => navigate("/lab/orders")}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AttentionList
            title="Radiology waiting"
            subtitle="Longest waiting first"
            emptyText="No pending radiology orders."
            items={pendingRad.map((o) => ({
              id: o.radiologyOrderId,
              primary: o.patientName,
              secondary: [o.scanType, o.priority?.label].filter(Boolean).join(" · "),
              meta: ageLabel(o.ageDays, o.ageHours),
              severity: ageSeverity(o.ageDays),
              icon: <MonitorHeartRounded sx={{ fontSize: 18 }} />,
              onClick: () => navigate("/lab/radiology"),
            }))}
            maxRows={6}
            totalCount={rad.pending}
            actionLabel="Radiology orders"
            onAction={() => navigate("/lab/radiology")}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
