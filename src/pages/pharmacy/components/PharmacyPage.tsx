import { type ReactNode } from "react";
import { Box, Typography, Pagination } from "@mui/material";

// Shared page size for every paginated pharmacy table.
export const ROWS_PER_PAGE = 10;

interface PharmacyPageProps {
  /** Page title shown in the gradient header. */
  title: string;
  /** Optional one-line description under the title. */
  subtitle?: string;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Optional right-aligned action(s), e.g. an "Add" button. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Uniform shell for all pharmacy pages. Keeps the container width, padding,
 * and header layout identical across the panel so that navigating between
 * pages only swaps the title and the content — structure stays put.
 */
export default function PharmacyPage({ title, subtitle, icon, action, children }: PharmacyPageProps) {
  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 4,
          gap: 2,
          minHeight: 64,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            {icon}
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
      {children}
    </Box>
  );
}

interface PaginationBarProps {
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Total number of records across all pages (for the "Showing X–Y of Z" label). */
  total: number;
  onChange: (page: number) => void;
}

/**
 * Consistent table footer: a "Showing X–Y of Z" summary on the left and the
 * page selector on the right. Renders nothing when there is only one page.
 */
export function PaginationBar({ page, pageCount, total, onChange }: PaginationBarProps) {
  if (pageCount <= 1) return null;
  const from = Math.min((page - 1) * ROWS_PER_PAGE + 1, total);
  const to = Math.min(page * ROWS_PER_PAGE, total);
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        px: 3,
        py: 2,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Showing {from}–{to} of {total}
      </Typography>
      <Pagination
        count={pageCount}
        page={page}
        onChange={(_, v) => onChange(v)}
        color="primary"
        shape="rounded"
        size="small"
      />
    </Box>
  );
}
