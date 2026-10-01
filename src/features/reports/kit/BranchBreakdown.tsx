import SimpleTable from "./SimpleTable";
import { formatINR } from "@/utils/format";

/**
 * "By branch" — every branch side by side, for a report looked at across all
 * of them (multi-branch plan, phase 7). The server sends the rows only in that
 * view, tallied from the same records as the report's totals, so the Total
 * row here is the report's own figure. Records that predate branches come as
 * their own row rather than vanishing from the sum.
 */

export interface BranchColumn {
  key: string;
  label: string;
  kind?: "money" | "count" | "percent";
  /** For a ratio (an occupancy %): worked out from the row's own figures, and for the Total from the totals — never summed. */
  derive?: (row: Record<string, number>) => number;
}

export type BranchBreakdownRow = { branchId: string | null; branchName: string } & Record<string, unknown>;

const format = (c: BranchColumn, v: number) =>
  c.kind === "money" ? formatINR(v) : c.kind === "percent" ? `${Math.round(v)}%` : Math.round(v).toLocaleString("en-IN");

export default function BranchBreakdown({ rows, columns, title = "By branch" }: {
  rows?: BranchBreakdownRow[];
  columns: BranchColumn[];
  title?: string;
}) {
  if (!rows || rows.length < 2) return null;
  const num = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v) || 0])) as Record<string, number>;
  const total: Record<string, number> = {};
  for (const c of columns) if (!c.derive) total[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  const cell = (c: BranchColumn, r: Record<string, number>) => format(c, c.derive ? c.derive(r) : r[c.key] ?? 0);
  return (
    <SimpleTable
      title={title}
      head={["Branch", ...columns.map((c) => c.label)]}
      rows={[
        ...rows.map((r) => [r.branchName, ...columns.map((c) => cell(c, num(r)))]),
        ["Total", ...columns.map((c) => cell(c, total))],
      ]}
      dense
      compact
      note="Each branch from the same records as the totals above, so the rows add up to them."
    />
  );
}
