import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { formatINR } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

export interface BranchComparisonData {
  rows: Array<{ branchId: string | null; branchName: string } & Record<string, number | string | null>>;
  total: Record<string, number>;
}

const inr = (v: unknown) => formatINR(Number(v) || 0, 0);
const n = (v: unknown) => Number(v) || 0;

/**
 * Every branch side by side, under the group's tiles (multi-branch plan,
 * phase 7). Each row follows the rule of the tile above it — cash as the Day
 * Book counts it, dues as the Outstanding register does, occupancy of census
 * beds — and the Total row is the group's figure, so the column adds up to it.
 * Money is net of refunds and not floored at zero, so a branch that paid out
 * more than it took today shows as a negative and the column still sums.
 */
export default function BranchComparison({ data }: { data: BranchComparisonData }) {
  // Headings wrap (the figures do not), so all eight columns fit a laptop-width card.
  const head = ["Branch", "Collected today", "Last 30 days", "Outstanding", "Appointments today", "Inpatients", "Beds occupied", "Admitted · discharged today"];
  const line = (r: Record<string, unknown>, isTotal = false) => {
    const beds = n(r.beds), occ = n(r.bedsOccupied);
    const cells = [
      <>{inr(r.netToday)}{n(r.cashOutToday) > 0 && <Typography component="span" variant="caption" sx={{ display: "block", color: "text.secondary" }}>{inr(r.cashOutToday)} refunded</Typography>}</>,
      inr(r.net30),
      <>{inr(r.outstanding)}<Typography component="span" variant="caption" sx={{ display: "block", color: "text.secondary" }}>{n(r.outstandingCount)} bill{n(r.outstandingCount) === 1 ? "" : "s"}</Typography></>,
      n(r.appointmentsToday).toLocaleString("en-IN"),
      n(r.inpatients).toLocaleString("en-IN"),
      beds ? `${occ} of ${beds} · ${Math.round((occ / beds) * 100)}%` : "—",
      `${n(r.admissionsToday)} · ${n(r.dischargesToday)}`,
    ];
    return cells.map((c, i) => (
      <TableCell key={i} align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: isTotal ? 800 : 500, color: i === 0 && n(r.netToday) < 0 ? SEMANTIC.danger : "text.primary", whiteSpace: "nowrap" }}>{c}</TableCell>
    ));
  };

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 4, overflow: "hidden" }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Branches side by side</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Each branch's share of the figures above — the Total row is the group's, and the branches add up to it.
        </Typography>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {head.map((h, i) => (
                <TableCell key={h} align={i ? "right" : "left"} sx={{ fontWeight: 700, color: "text.secondary", verticalAlign: "bottom", lineHeight: 1.3 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.branchId ?? "none"} hover>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", fontStyle: r.branchId ? "normal" : "italic", color: r.branchId ? "text.primary" : "text.secondary" }}>{r.branchName}</TableCell>
                {line(r)}
              </TableRow>
            ))}
            <TableRow sx={{ "& td": { borderTop: "2px solid", borderColor: "divider", borderBottom: 0 } }}>
              <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
              {line(data.total, true)}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
