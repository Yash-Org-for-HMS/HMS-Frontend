import { Box, Paper, Skeleton, Stack } from "@mui/material";

/**
 * Placeholder for a detail / profile page while its record loads: a back-bar,
 * a header card (avatar + name + chips), and a couple of info cards. Covers
 * patient/hospital/doctor profiles, consultation and admission detail, etc.
 */
export default function DetailSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <Box sx={{ p: { xs: 0, md: 1 }, width: "100%" }}>
      <Skeleton variant="text" width={120} sx={{ fontSize: "0.9rem", mb: 2 }} />

      {/* Header card */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={220} sx={{ fontSize: "1.4rem" }} />
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Skeleton variant="rounded" width={70} height={22} />
              <Skeleton variant="rounded" width={70} height={22} />
              <Skeleton variant="rounded" width={70} height={22} />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Info cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Skeleton variant="text" width={150} sx={{ fontSize: "1rem", mb: 2 }} />
            <Stack spacing={1.5}>
              {Array.from({ length: 4 }).map((_, r) => (
                <Box key={r} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Skeleton variant="text" width={100} />
                  <Skeleton variant="text" width={140} />
                </Box>
              ))}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
