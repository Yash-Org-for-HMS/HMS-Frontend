import { Box, Paper, Skeleton, Stack } from "@mui/material";

/**
 * Placeholder for a dashboard/landing page while its KPIs + panels load: a
 * header, a row of stat tiles, then a couple of larger content blocks (charts
 * / lists). Matches the stat-row-then-panels shape shared by the panel
 * dashboards so the layout doesn't jump when real data lands.
 */
export default function DashboardSkeleton({ stats = 4, panels = 2 }: { stats?: number; panels?: number }) {
  return (
    <Box sx={{ p: { xs: 0, md: 1 }, width: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={220} sx={{ fontSize: "1.75rem" }} />
          <Skeleton variant="text" width={300} sx={{ fontSize: "0.9rem" }} />
        </Box>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: `repeat(${stats}, 1fr)` }, gap: 2, mb: 3 }}>
        {Array.from({ length: stats }).map((_, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="rounded" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" sx={{ fontSize: "1.4rem" }} />
                <Skeleton variant="text" width="80%" sx={{ fontSize: "0.75rem" }} />
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: panels > 1 ? "1.6fr 1fr" : "1fr" }, gap: 2 }}>
        {Array.from({ length: panels }).map((_, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Skeleton variant="text" width={160} sx={{ fontSize: "1rem", mb: 2 }} />
            <Skeleton variant="rounded" height={260} />
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
