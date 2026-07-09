import { Box, Paper, Skeleton, Stack } from "@mui/material";

/**
 * Placeholder for a form page/dialog while its existing record loads (edit
 * mode, or a form that needs lookups before it can render). Mirrors the
 * common shape: a header, then a card of labelled field rows, then an action
 * bar — so the swap from spinner reads as "the form is arriving", not "stuck".
 */
export default function FormSkeleton({ fields = 6, header = true }: { fields?: number; header?: boolean }) {
  return (
    <Box sx={{ p: { xs: 0, md: 1 }, width: "100%", maxWidth: 900, mx: "auto" }}>
      {header && (
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box>
            <Skeleton variant="text" width={220} sx={{ fontSize: "1.5rem" }} />
            <Skeleton variant="text" width={300} sx={{ fontSize: "0.85rem" }} />
          </Box>
          <Skeleton variant="rounded" width={120} height={38} />
        </Stack>
      )}
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
          {Array.from({ length: fields }).map((_, i) => (
            <Box key={i}>
              <Skeleton variant="text" width={110} sx={{ fontSize: "0.75rem", mb: 0.5 }} />
              <Skeleton variant="rounded" height={40} />
            </Box>
          ))}
        </Box>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Skeleton variant="rounded" width={90} height={38} />
          <Skeleton variant="rounded" width={120} height={38} />
        </Stack>
      </Paper>
    </Box>
  );
}
