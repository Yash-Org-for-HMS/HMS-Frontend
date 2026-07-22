import { Box, Typography, Chip } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";

/**
 * Sidebar quick-search launcher. Opens the command palette (also reachable via
 * ⌘K / Ctrl+K). Shared across every panel's sidebar so search is discoverable
 * everywhere, not just Reception. Purely a trigger — it dispatches the global
 * `open-command-palette` event; the palette itself owns all data access and
 * permission/module gating, so this adds no new capability or exposure.
 */
export default function SidebarSearch() {
  const open = () => window.dispatchEvent(new Event("open-command-palette"));
  return (
    <Box sx={{ px: 1.5, pt: 1.5 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-label="Open search (Ctrl+K)"
        onClick={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: 2, cursor: "pointer",
          border: "1px solid", borderColor: "divider", bgcolor: "background.default", color: "text.secondary",
          "&:hover": { borderColor: "primary.main", color: "text.primary" }, transition: "all 0.15s ease",
        }}
      >
        <SearchRounded sx={{ fontSize: 18 }} />
        <Typography variant="body2" sx={{ flex: 1 }}>Search…</Typography>
        <Chip label="⌘K" size="small" sx={{ height: 20, fontSize: "0.75rem", fontWeight: 700, bgcolor: "action.hover", color: "text.secondary" }} />
      </Box>
    </Box>
  );
}
