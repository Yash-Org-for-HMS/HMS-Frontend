import { Skeleton, TableRow, TableCell, Box, Paper } from "@mui/material";

/**
 * Shimmering placeholder rows to drop straight inside an existing <TableBody>
 * while the first page of data loads — reads as "instant + loading" instead of
 * a centred spinner. Uses MUI <Skeleton> (theme-aware shimmer) so it's visible
 * in light mode (unlike the old hardcoded translucent-white placeholders).
 *
 *   <TableBody>
 *     {loading ? <TableRowsSkeleton rows={6} columns={7} /> : rows.map(...)}
 *   </TableBody>
 */
export function TableRowsSkeleton({ rows = 6, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton variant="text" width={j === 0 ? "75%" : "55%"} sx={{ fontSize: "0.9rem" }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Card-grid placeholder for pages that show a grid of cards (directories,
 * dashboards) rather than a table.
 */
export function CardGridSkeleton({
  count = 6,
  height = 120,
  minWidth = 260,
}: {
  count?: number;
  height?: number;
  minWidth?: number;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: 2,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} />
      ))}
    </Box>
  );
}

/**
 * Standalone bordered list placeholder for pages that currently swap their whole
 * content area for a centred spinner (no pre-rendered table header to slot into).
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <Skeleton variant="rectangular" height={48} />
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            px: 3,
            py: 1.75,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" sx={{ flex: 1 }} />
          <Skeleton variant="text" width={90} />
          <Skeleton variant="text" width={64} />
        </Box>
      ))}
    </Paper>
  );
}
