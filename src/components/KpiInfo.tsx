import { useState, type ReactNode } from "react";
import { Box, ClickAwayListener, IconButton, Tooltip } from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";

/**
 * The small (i) beside a KPI's label: what the figure counts, in plain words.
 * Opens on hover and on click (a click also keeps it open until clicking away),
 * and never lets the click through to a tile that navigates or links.
 */
export default function KpiInfo({ text, label }: { text: ReactNode; label: string }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <ClickAwayListener onClickAway={() => setPinned(false)}>
      <Box component="span" sx={{ display: "inline-flex" }}>
        <Tooltip
          arrow
          placement="top"
          open={pinned || hover}
          onOpen={() => setHover(true)}
          onClose={() => setHover(false)}
          title={<Box sx={{ fontSize: "0.8rem", lineHeight: 1.5, p: 0.25 }}>{text}</Box>}
          slotProps={{ tooltip: { sx: { maxWidth: 300 } } }}
        >
          <IconButton
            size="small"
            aria-label={`What "${label}" means`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPinned((p) => !p); }}
            sx={{ p: 0.25, ml: 0.25, color: "text.disabled", "&:hover": { color: "text.secondary" } }}
          >
            <InfoOutlined sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
