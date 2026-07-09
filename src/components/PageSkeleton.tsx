import { Box, Skeleton, Stack } from "@mui/material";

/**
 * Generic page placeholder shown while a lazily-loaded route chunk is fetched.
 * Rendered at the page-content level (inside each layout's <Outlet/>), so the
 * sidebar/nav stays put and only the content area shimmers — which reads as
 * "instant + loading" rather than a blank screen or a full-page spinner.
 */
export default function PageSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      {/* Header: title + primary action */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={240} sx={{ fontSize: "1.75rem" }} />
          <Skeleton variant="text" width={320} sx={{ fontSize: "0.9rem" }} />
        </Box>
        <Skeleton variant="rounded" width={140} height={40} />
      </Stack>

      {/* Stat cards row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Box>

      {/* Table / list area */}
      <Skeleton variant="rounded" height={44} sx={{ mb: 1 }} />
      <Stack spacing={1}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} />
        ))}
      </Stack>
    </Box>
  );
}
