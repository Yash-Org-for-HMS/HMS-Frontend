import { SEMANTIC } from "@/styles/accents";
import {
  Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
} from "@mui/material";
import { DeleteOutlineRounded } from "@mui/icons-material";
import dayjs from "dayjs";
import Mascot from "@/components/Mascot";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { leaveScopeLabel } from "./leaveScope";

/** A leave day as the leave endpoints return it. */
export interface LeaveRow {
  doctorLeaveId: string;
  leaveDate: string;
  leaveReason?: string | null;
  status: string;
  branchId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

/** The paged response: upcoming in full, one page of past history. */
export interface PagedLeaves {
  upcoming: LeaveRow[];
  data: LeaveRow[];
  pagination: { totalPages: number };
}

const INACTIVE = ["rejected", "cancelled", "declined"];

// Sentence-case fontWeight-600 header look (override SortableHeadCell's default uppercase/700 style).
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 600, fontSize: "0.875rem" };
const PLAIN_HEAD_SX = { ...HEAD_SX, color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" };

/**
 * One table of leave days, shared by the admin's Manage Leaves and the doctor's
 * My Leave. `sortable` is for a list held in full (upcoming); a server-paged
 * list (past) is shown in the server's order, since sorting one page would mislead.
 */
export default function LeaveTable({
  rows, branchName, onRemove, removing, emptyText, sortable = false, maxHeight,
}: {
  rows: LeaveRow[];
  branchName: (branchId: string) => string | undefined;
  onRemove: (leave: LeaveRow) => void;
  removing: boolean;
  emptyText: string;
  sortable?: boolean;
  maxHeight?: string;
}) {
  const { sorted, orderBy, order, onSort } = useTableSort(rows, {
    date: (l) => (l.leaveDate ? new Date(l.leaveDate) : null),
    reason: (l) => l.leaveReason ?? null,
    status: (l) => l.status ?? null,
  });
  const shown = sortable ? sorted : rows;
  const head = (label: string, key: string) => sortable
    ? <SortableHeadCell label={label} sortKey={key} orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
    : <TableCell sx={PLAIN_HEAD_SX}>{label}</TableCell>;

  return (
    <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, border: "1px solid", borderColor: "divider", maxHeight }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {head("Leave Date", "date")}
            {head("Reason", "reason")}
            {head("Status", "status")}
            <TableCell sx={PLAIN_HEAD_SX} />
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} sx={{ py: 3, borderBottom: "none" }}>
                <Mascot pose="nothing-here-yet" subtitle={emptyText} size={110} />
              </TableCell>
            </TableRow>
          ) : (
            shown.map((leave) => {
              const inactive = INACTIVE.includes((leave.status || "").toLowerCase());
              const past = dayjs(leave.leaveDate).isBefore(dayjs(), "day");
              const scope = leaveScopeLabel(leave, branchName);
              return (
                <TableRow key={leave.doctorLeaveId} hover sx={{ "&:last-child td": { border: 0 } }}>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 600 }}>
                    {dayjs(leave.leaveDate).format("ddd, DD MMM YYYY")}
                    {scope && (
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 500 }}>{scope}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>{leave.leaveReason || "—"}</TableCell>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                    <Chip label={leave.status} size="small"
                      sx={{ bgcolor: inactive ? "rgba(148,163,184,0.15)" : "rgba(16,185,129,0.15)", color: inactive ? "text.secondary" : "#16a34a", fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                    <Tooltip title={past ? "A past leave day can't be removed" : "Remove leave"}>
                      <span>
                        <IconButton size="small" onClick={() => onRemove(leave)} disabled={past || removing}
                          sx={{ color: "text.secondary", "&:hover": { color: SEMANTIC.danger } }}>
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
