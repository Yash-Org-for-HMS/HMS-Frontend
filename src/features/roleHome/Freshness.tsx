import { useEffect, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { RefreshRounded } from "@mui/icons-material";

/** "Updated 3 min ago" and a Refresh button, for a home screen's header. */
export default function Freshness({ updatedAt, fetching, onRefresh }: { updatedAt: number; fetching: boolean; onRefresh: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.floor((Math.max(now, updatedAt) - updatedAt) / 60_000);
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {updatedAt > 0 && <Typography variant="caption" sx={{ color: "text.secondary" }}>Updated {ago}</Typography>}
      <Tooltip title="Refresh">
        <span>
          <IconButton size="small" aria-label="Refresh" onClick={onRefresh} disabled={fetching}>
            <RefreshRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
