import { TableCell, TableSortLabel } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { SortOrder } from "./useTableSort";

/**
 * Drop-in clickable column header that matches the app's existing table-head
 * styling (uppercase, text.secondary, opaque background so it works under a
 * sticky header). Pair with useTableSort. Use a plain <TableCell> for columns
 * that aren't sortable (e.g. an Actions column).
 */
const headSx = {
  color: "text.secondary",
  fontWeight: 700,
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  py: 2,
  bgcolor: "background.default",
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

interface Props {
  label: string;
  sortKey: string;
  orderBy: string | null;
  order: SortOrder;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  sx?: SxProps<Theme>;
}

export default function SortableHeadCell({
  label,
  sortKey,
  orderBy,
  order,
  onSort,
  align = "left",
  sx,
}: Props) {
  const active = orderBy === sortKey;
  return (
    <TableCell
      align={align}
      sortDirection={active ? order : false}
      sx={{ ...headSx, ...sx }}
    >
      <TableSortLabel
        active={active}
        direction={active ? order : "asc"}
        onClick={() => onSort(sortKey)}
        sx={{
          color: "inherit !important",
          "&:hover": { color: "text.primary" },
          // Show a faint arrow even when inactive to hint the column is sortable.
          "& .MuiTableSortLabel-icon": {
            color: "#06b6d4 !important",
            opacity: active ? 1 : 0.35,
          },
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}
