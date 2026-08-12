import type { ReactNode } from "react";
import { Box, Paper, Typography, Button, Skeleton, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded, CheckCircleRounded } from "@mui/icons-material";
import { SEMANTIC, BRAND } from "@/styles/accents";

/**
 * How urgent a row is. Drives the left stripe and the meta chip, so severity
 * reads before the text does — and is always paired with the meta text, never
 * carried by colour alone.
 */
export type AttentionSeverity = "critical" | "warning" | "info";

const SEVERITY_COLOR: Record<AttentionSeverity, string> = {
  critical: SEMANTIC.danger,
  warning: SEMANTIC.warning,
  info: BRAND.action,
};

export interface AttentionItem {
  id: string;
  /** The thing needing attention — a patient, a bill, a medicine. */
  primary: ReactNode;
  /** Context under it — the doctor, the test, the batch. */
  secondary?: ReactNode;
  /** Right-aligned status: how long it's been waiting, how much is owed. */
  meta?: ReactNode;
  severity?: AttentionSeverity;
  icon?: ReactNode;
  /** Where resolving this row happens. Rows without one aren't clickable. */
  onClick?: () => void;
}

export interface AttentionListProps {
  title: string;
  /** One line saying what the list is for and how it's ordered. */
  subtitle?: string;
  items: AttentionItem[];
  loading?: boolean;
  /** Shown when there's genuinely nothing to do. Empty is a good outcome here. */
  emptyText?: string;
  /** Footer link to the full list. */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Rows to render before "and N more". The count chip always reflects the FULL
   * length, so trimming the list can never quietly understate the workload.
   */
  maxRows?: number;
  /**
   * The true size of the set when the SERVER already trimmed it — pass it and
   * the chip and "and N more" describe everything, not just what arrived. An
   * endpoint returning its top 8 would otherwise make a backlog of 40 read as 8.
   */
  totalCount?: number;
}

/**
 * The "what needs me now" panel — a ranked list of things a person can act on,
 * with an explicit count and a way through to each one.
 *
 * Every dashboard had counts ("4 pending lab tests") and lists ordered by
 * recency, but nothing that said which item to deal with first. This is the
 * shared shape for that band, so the reception, lab, nursing and pharmacy
 * versions read the same way instead of each inventing their own.
 */
export default function AttentionList({
  title, subtitle, items, loading = false, emptyText = "Nothing needs attention right now.",
  actionLabel, onAction, maxRows = 5, totalCount,
}: AttentionListProps) {
  const shown = items.slice(0, maxRows);
  // Anything the server already dropped counts as hidden too.
  const total = Math.max(totalCount ?? items.length, items.length);
  const hidden = total - shown.length;

  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>{title}</Typography>
          {subtitle && <Typography variant="caption" sx={{ color: "text.secondary" }}>{subtitle}</Typography>}
        </Box>
        {!loading && items.length > 0 && (
          <Chip
            size="small"
            label={total}
            sx={{ fontWeight: 700, bgcolor: alpha(SEMANTIC.warning, 0.14), color: SEMANTIC.warning, borderRadius: 1.5 }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1 }}>
        {loading ? (
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={34} />)}
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ px: 2.5, py: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <CheckCircleRounded sx={{ color: SEMANTIC.success, fontSize: 34 }} />
            <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>{emptyText}</Typography>
          </Box>
        ) : (
          shown.map((item) => {
            const color = SEVERITY_COLOR[item.severity ?? "info"];
            const clickable = Boolean(item.onClick);
            return (
              <Box
                key={item.id}
                onClick={item.onClick}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  px: 2.5, py: 1.5,
                  borderBottom: "1px solid", borderColor: "divider",
                  borderLeft: "3px solid", borderLeftColor: color,
                  cursor: clickable ? "pointer" : "default",
                  "&:last-of-type": { borderBottom: 0 },
                  "&:hover": clickable ? { bgcolor: "background.default" } : undefined,
                }}
              >
                {item.icon && (
                  <Box sx={{ width: 30, height: 30, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(color, 0.12), color }}>
                    {item.icon}
                  </Box>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>{item.primary}</Typography>
                  {item.secondary && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap component="div">{item.secondary}</Typography>
                  )}
                </Box>
                {item.meta && (
                  <Typography variant="caption" sx={{ color, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {item.meta}
                  </Typography>
                )}
                {clickable && <ChevronRightRounded sx={{ color: "text.disabled", fontSize: 18, flexShrink: 0 }} />}
              </Box>
            );
          })
        )}
      </Box>

      {(hidden > 0 || (actionLabel && onAction)) && (
        <Box sx={{ px: 2.5, py: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {hidden > 0 ? `and ${hidden} more` : ""}
          </Typography>
          {actionLabel && onAction && (
            <Button size="small" onClick={onAction} endIcon={<ChevronRightRounded />} sx={{ textTransform: "none", fontWeight: 600 }}>
              {actionLabel}
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
