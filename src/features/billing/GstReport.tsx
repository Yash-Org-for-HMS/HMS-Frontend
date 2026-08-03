import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, useTheme,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";

type Slab = { rate: number; taxableAmount: number; taxAmount: number; cgst: number; sgst: number; igst: number };
type GstData = {
  from: string; to: string; invoiceCount: number;
  slabs: Slab[];
  totals: { taxableAmount: number; taxAmount: number; cgst: number; sgst: number; igst: number };
};

// First and last day of the current month as yyyy-mm-dd (for the default range).
function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(now) };
}

export default function GstReport() {
  const theme = useTheme();
  const [{ from, to }, setRange] = useState(monthBounds);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gst-report", from, to],
    queryFn: async () =>
      (await axiosInstance.get(`/billing/gst-report?from=${from}&to=${to}`)).data.data as GstData,
  });

  return (
    <Box>
      <PageHeader title="GST Report" subtitle="Taxable value and GST collected by rate slab" />

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          type="date" label="From" size="small" value={from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date" label="To" size="small" value={to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {isLoading ? (
        <ListSkeleton />
      ) : isError || !data ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {data.invoiceCount} invoice{data.invoiceCount === 1 ? "" : "s"} in range · non-cancelled, by invoice date
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                  <TableCell>GST Rate</TableCell>
                  <TableCell align="right">Taxable Value</TableCell>
                  <TableCell align="right">CGST</TableCell>
                  <TableCell align="right">SGST</TableCell>
                  <TableCell align="right">Total GST</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.slabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>
                      No invoiced charges in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.slabs.map((s) => (
                    <TableRow key={s.rate} hover>
                      <TableCell>{s.rate === 0 ? "Exempt (0%)" : `${s.rate}%`}</TableCell>
                      <TableCell align="right">{formatINR(s.taxableAmount)}</TableCell>
                      <TableCell align="right">{formatINR(s.cgst)}</TableCell>
                      <TableCell align="right">{formatINR(s.sgst)}</TableCell>
                      <TableCell align="right">{formatINR(s.taxAmount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.slabs.length > 0 && (
                <TableBody>
                  <TableRow sx={{ "& td": { fontWeight: 800, borderTop: `2px solid ${theme.palette.divider}` } }}>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">{formatINR(data.totals.taxableAmount)}</TableCell>
                    <TableCell align="right">{formatINR(data.totals.cgst)}</TableCell>
                    <TableCell align="right">{formatINR(data.totals.sgst)}</TableCell>
                    <TableCell align="right">{formatINR(data.totals.taxAmount)}</TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
