import { useState, type ReactNode } from "react";
import { Box, Pagination } from "@mui/material";

/**
 * Pages a list that is already held in full in the browser (search and counts
 * still run over every row). `resetKey` is anything that changes when the list
 * is re-filtered — search text, a tab, a category — and sends the view back to
 * page 1. A list that shrinks under the current page shows its last page.
 */
export function useClientPage<T>(list: T[], { size = 25, resetKey }: { size?: number; resetKey?: unknown } = {}): {
  shown: T[];
  pager: ReactNode;
  page: number;
  totalPages: number;
} {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(resetKey ?? null);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) { setLastKey(key); setPage(1); }

  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(page, totalPages);
  return {
    shown: list.slice((current - 1) * size, current * size),
    page: current,
    totalPages,
    pager: totalPages > 1 && (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Pagination count={totalPages} page={current} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
      </Box>
    ),
  };
}
