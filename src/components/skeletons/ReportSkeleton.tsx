import { Box, Paper, Skeleton, Stack } from "@mui/material";

/**
 * Placeholder for a report view while its data is fetched: an optional row of
 * summary KPIs, then a chart block beside a table block. Used in place of the
 * "Crunching numbers…" spinner on the report pages so the switch between
 * date ranges/reports reads as content refreshing rather than stalling.
 */
export default function ReportSkeleton({ kpis = 4, chart = true }: { kpis?: number; chart?: boolean }) {
  return (
    <Box sx={{ width: "100%" }}>
      {kpis > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: `repeat(${kpis},1fr)` }, gap: 1.5, mb: 2 }}>
          {Array.from({ length: kpis }).map((_, i) => (
            <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Skeleton variant="rounded" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="55%" sx={{ fontSize: "1.4rem" }} />
                  <Skeleton variant="text" width="75%" sx={{ fontSize: "0.72rem" }} />
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: chart ? "1.6fr 1fr" : "1fr" }, gap: 2 }}>
        {chart && (
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Skeleton variant="text" width={180} sx={{ fontSize: "1rem", mb: 2 }} />
            <Skeleton variant="rounded" height={280} />
          </Paper>
        )}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="text" width={140} sx={{ fontSize: "1rem", mb: 2 }} />
          <Stack spacing={1}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={34} />
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
