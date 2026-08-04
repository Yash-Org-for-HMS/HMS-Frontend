import { Alert } from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";

/**
 * Shown when a report's detail list hit the server-side row cap and only a
 * prefix was returned. Reports have no pagination — they're bounded by their
 * date-range filter — so a very wide range can exceed the cap; this tells the
 * user to narrow the range to see (and export) the full list. Summary totals
 * and charts are always computed from the full set, so they remain accurate.
 */
export default function ReportTruncationNote({
  truncated, totalRows, shownRows, sx,
}: {
  truncated?: boolean;
  totalRows?: number;
  shownRows?: number;
  sx?: object;
}) {
  if (!truncated) return null;
  const shown = (shownRows ?? 0).toLocaleString();
  const total = (totalRows ?? 0).toLocaleString();
  return (
    <Alert
      severity="info"
      icon={<InfoOutlined fontSize="small" />}
      sx={{ borderRadius: 3, alignItems: "center", ...sx }}
    >
      Showing the first <strong>{shown}</strong> of <strong>{total}</strong> rows. Totals and
      charts above still reflect all {total} — narrow the date range to see or export the full detail list.
    </Alert>
  );
}
