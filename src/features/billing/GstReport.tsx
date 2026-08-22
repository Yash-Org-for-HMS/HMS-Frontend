import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, AlertTitle, Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, useTheme, alpha,
} from "@mui/material";
import { DownloadRounded, ReceiptLongRounded } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";
import { formatINR, formatDate } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

type Slab = { rate: number; taxableAmount: number; taxAmount: number; cgst: number; sgst: number; igst: number };
type Hsn = { hsnCode: string; rate: number; quantity: number; taxableAmount: number; taxAmount: number; cgst: number; sgst: number };
type RegisterRow = {
  invoiceId: string; invoiceNumber: string; invoiceDate: string; patientName: string; uhid: string | null;
  taxableAmount: number; exemptAmount: number; taxAmount: number; cgst: number; sgst: number;
};
type GstData = {
  from: string; to: string; gstin: string | null; invoiceCount: number; registerTruncated: boolean;
  slabs: Slab[];
  totals: { taxableAmount: number; taxAmount: number; cgst: number; sgst: number; igst: number };
  exempt: { amount: number };
  hsnSummary: Hsn[];
  register: RegisterRow[];
  readiness: {
    gstinSet: boolean; medicinesTotal: number; medicinesMissingHsn: number; medicinesZeroRated: number;
    taxableChargeItems: number; taxableChargeItemsMissingHsn: number; taxedLinesMissingHsn: number;
  };
};

function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(now) };
}

const HEAD_SX = { fontWeight: 700 } as const;

// Quotes every field so a description containing a comma can't shift columns.
function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  // BOM so Excel opens ₹ and non-ASCII names in the right encoding.
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", mb: 3 }}>
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" sx={{ color: "text.secondary" }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

export default function GstReport() {
  const theme = useTheme();
  const [{ from, to }, setRange] = useState(monthBounds);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gst-report", from, to],
    queryFn: async () =>
      (await axiosInstance.get(`/billing/gst-report?from=${from}&to=${to}`)).data.data as GstData,
  });

  const r = data?.readiness;
  // Only things that actually block or distort a filing. A medicine sitting at 0%
  // is not listed — plenty of supplies are legitimately exempt, so flagging that
  // would cry wolf; it's only worth mentioning when NOTHING is rated.
  const issues: { text: string; to?: string }[] = [];
  if (r && !r.gstinSet) issues.push({ text: "Your GSTIN is not set on the hospital profile — it must appear on every tax invoice.", to: "/hospital/profile" });
  if (r && r.taxedLinesMissingHsn > 0) issues.push({ text: `${r.taxedLinesMissingHsn} taxed invoice line${r.taxedLinesMissingHsn === 1 ? "" : "s"} in this range carry no HSN/SAC code, so they are missing from the HSN summary GSTR-1 Table 12 requires.` });
  if (r && r.medicinesMissingHsn > 0) issues.push({ text: `${r.medicinesMissingHsn} of ${r.medicinesTotal} medicines have no HSN code — sales of these can't be reported HSN-wise.`, to: "/pharmacy/medicines" });
  if (r && r.taxableChargeItemsMissingHsn > 0) issues.push({ text: `${r.taxableChargeItemsMissingHsn} taxable charge item${r.taxableChargeItemsMissingHsn === 1 ? "" : "s"} have no SAC code.`, to: "/hospital/soc" });
  if (r && r.medicinesTotal > 0 && r.medicinesZeroRated === r.medicinesTotal) issues.push({ text: `All ${r.medicinesTotal} medicines are set to 0% GST. Medicines are normally taxable (commonly 5% or 12%) even though healthcare services are exempt — if that's not deliberate, this report will under-state your liability.`, to: "/pharmacy/medicines" });

  const exportSummary = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["GST Summary", `${from} to ${to}`],
      ["GSTIN", data.gstin ?? "(not set)"],
      [],
      ["Rate", "Taxable Value", "CGST", "SGST", "Total GST"],
      ...data.slabs.map((s) => [`${s.rate}%`, s.taxableAmount, s.cgst, s.sgst, s.taxAmount]),
      ["Total", data.totals.taxableAmount, data.totals.cgst, data.totals.sgst, data.totals.taxAmount],
      [],
      ["Exempt / nil-rated supplies (no GST)", data.exempt.amount],
      [],
      ["HSN/SAC", "Rate", "Qty", "Taxable Value", "CGST", "SGST", "Total GST"],
      ...data.hsnSummary.map((h) => [h.hsnCode, `${h.rate}%`, h.quantity, h.taxableAmount, h.cgst, h.sgst, h.taxAmount]),
    ];
    downloadCsv(`gst-summary-${from}-to-${to}.csv`, rows);
  };

  const exportRegister = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Invoice No", "Date", "Patient", "UHID", "Taxable Value", "CGST", "SGST", "Total GST", "Exempt Value"],
      ...data.register.map((x) => [
        x.invoiceNumber, formatDate(x.invoiceDate), x.patientName, x.uhid ?? "",
        x.taxableAmount, x.cgst, x.sgst, x.taxAmount, x.exemptAmount,
      ]),
    ];
    downloadCsv(`gst-invoice-register-${from}-to-${to}.csv`, rows);
  };

  return (
    <Box>
      <PageHeader
        title="GST Report"
        subtitle="Taxable value, GST collected, and the HSN summary needed to file"
        actions={
          data && (
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={exportSummary} sx={{ textTransform: "none" }}>
              Export summary
            </Button>
          )
        }
      />

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
        <TextField type="date" label="From" size="small" value={from}
          onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="To" size="small" value={to}
          onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} InputLabelProps={{ shrink: true }} />
        {data?.gstin && <Chip size="small" label={`GSTIN ${data.gstin}`} sx={{ fontWeight: 700 }} />}
      </Box>

      {isLoading ? (
        <ListSkeleton />
      ) : isError || !data ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <>
          {issues.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>This report is not ready to file</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {issues.map((i, idx) => (
                  <li key={idx}>
                    <Typography variant="body2" component="span">{i.text}</Typography>
                    {i.to && (
                      <Button component={RouterLink} to={i.to} size="small" sx={{ ml: 1, textTransform: "none", py: 0 }}>Fix</Button>
                    )}
                  </li>
                ))}
              </Box>
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {data.invoiceCount} invoice{data.invoiceCount === 1 ? "" : "s"} in range · non-cancelled, by invoice date
            {data.registerTruncated && " · register truncated to the first 10,000"}
          </Typography>

          <SectionCard title="Tax collected by rate" subtitle="Taxable supplies only — exempt supplies are listed separately below">
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": HEAD_SX }}>
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
                        No taxable supplies in this range — every invoiced line was exempt (0%).
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {data.slabs.map((s) => (
                        <TableRow key={s.rate} hover>
                          <TableCell>{s.rate}%</TableCell>
                          <TableCell align="right">{formatINR(s.taxableAmount)}</TableCell>
                          <TableCell align="right">{formatINR(s.cgst)}</TableCell>
                          <TableCell align="right">{formatINR(s.sgst)}</TableCell>
                          <TableCell align="right">{formatINR(s.taxAmount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ "& td": { fontWeight: 800, borderTop: `2px solid ${theme.palette.divider}` } }}>
                        <TableCell>Total</TableCell>
                        <TableCell align="right">{formatINR(data.totals.taxableAmount)}</TableCell>
                        <TableCell align="right">{formatINR(data.totals.cgst)}</TableCell>
                        <TableCell align="right">{formatINR(data.totals.sgst)}</TableCell>
                        <TableCell align="right">{formatINR(data.totals.taxAmount)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(SEMANTIC.info, 0.06), borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Exempt / nil-rated supplies (healthcare services — no GST charged)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatINR(data.exempt.amount)}</Typography>
            </Box>
          </SectionCard>

          <SectionCard
            title="HSN / SAC summary"
            subtitle="GSTR-1 Table 12 — taxed lines only; exempt supplies need no HSN"
          >
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": HEAD_SX }}>
                    <TableCell>HSN / SAC</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Taxable Value</TableCell>
                    <TableCell align="right">CGST</TableCell>
                    <TableCell align="right">SGST</TableCell>
                    <TableCell align="right">Total GST</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.hsnSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                        Nothing to summarise — no taxed line in this range carries an HSN/SAC code.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.hsnSummary.map((h) => (
                      <TableRow key={`${h.hsnCode}-${h.rate}`} hover>
                        <TableCell sx={{ fontFamily: "monospace" }}>{h.hsnCode}</TableCell>
                        <TableCell align="right">{h.rate}%</TableCell>
                        <TableCell align="right">{h.quantity}</TableCell>
                        <TableCell align="right">{formatINR(h.taxableAmount)}</TableCell>
                        <TableCell align="right">{formatINR(h.cgst)}</TableCell>
                        <TableCell align="right">{formatINR(h.sgst)}</TableCell>
                        <TableCell align="right">{formatINR(h.taxAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>

          <SectionCard
            title="Invoice register"
            subtitle="Every invoice in range that carried GST"
            action={
              data.register.length > 0 && (
                <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={exportRegister} sx={{ textTransform: "none" }}>
                  Export register
                </Button>
              )
            }
          >
            <TableContainer sx={{ overflowX: "auto", maxHeight: 520 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": HEAD_SX }}>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell align="right">Taxable Value</TableCell>
                    <TableCell align="right">CGST</TableCell>
                    <TableCell align="right">SGST</TableCell>
                    <TableCell align="right">Total GST</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.register.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                        <ReceiptLongRounded sx={{ fontSize: 32, color: "text.disabled", display: "block", mx: "auto", mb: 1 }} />
                        No invoice in this range carried GST.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.register.map((x) => (
                      <TableRow key={x.invoiceId} hover>
                        <TableCell sx={{ fontFamily: "monospace" }}>{x.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(x.invoiceDate)}</TableCell>
                        <TableCell>
                          {x.patientName}
                          {x.uhid && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{x.uhid}</Typography>}
                        </TableCell>
                        <TableCell align="right">{formatINR(x.taxableAmount)}</TableCell>
                        <TableCell align="right">{formatINR(x.cgst)}</TableCell>
                        <TableCell align="right">{formatINR(x.sgst)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatINR(x.taxAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </>
      )}
    </Box>
  );
}
