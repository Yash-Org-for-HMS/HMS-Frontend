import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import BillDocument from "@/components/billing/BillDocument";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SubscriptionInvoicePrint() {
  const { id } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get(`/subscription-billing/invoices/${id}`);
        setInv(res.data.data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Failed to load this invoice"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!loading && inv) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, inv]);

  if (loading) return <DetailSkeleton />;
  if (error) return <Typography color="error" sx={{ p: 4 }}>{error}</Typography>;
  if (!inv) return <Typography sx={{ p: 4 }}>Invoice not found</Typography>;

  const h = inv.hospital || {};
  const p = inv.platform || {};
  // The SaaS operator's (seller) identity, configured under Billing → Settings.
  const platformHeader = {
    hospitalName: p.companyName || "HMS Platform",
    addressLine1: p.addressLine1 || undefined,
    addressLine2: p.addressLine2 || undefined,
    postalCode: p.postalCode || undefined,
    officialEmail: p.email || undefined,
    officialPhone: p.phone || undefined,
  };
  const billToAddress = [h.addressLine1, h.addressLine2, h.city, h.postalCode].filter(Boolean).join(", ");
  const balance = Number(inv.amount) - Number(inv.paid || 0);
  const fullyPaid = inv.status === "PAID" || balance <= 0.005;
  const statusLabel = fullyPaid ? "Paid"
    : inv.phase === "SUSPENDED" ? "Overdue (suspended)"
    : inv.phase === "OVERDUE" ? "Overdue"
    : inv.status === "VOID" ? "Void" : "Unpaid";

  const cellHead: React.CSSProperties = { padding: "8px", borderBottom: "2px solid #e5e7eb", textAlign: "left", fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#4b5563" };
  const cell: React.CSSProperties = { padding: "8px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

  return (
    <Box sx={{
      width: "210mm", minHeight: "297mm", margin: "0 auto", bgcolor: "white", color: "#111827",
      px: "18mm", py: "16mm", boxSizing: "border-box", fontFamily: "'Inter', Arial, sans-serif",
      "@media screen": { boxShadow: "0 4px 12px rgba(0,0,0,0.12)", my: 4 },
      "@media print": { margin: 0, boxShadow: "none", width: "100%" },
    }}>
      <BillDocument
        variant="receipt"
        hospital={platformHeader}
        title="Subscription Invoice"
        metaLeft={[
          { label: "Invoice", value: inv.invoiceNumber },
          { label: "Issued", value: fmtDate(inv.issuedAt) },
          { label: "Due", value: fmtDate(inv.dueDate) },
        ]}
        metaRight={[
          { label: "Status", value: statusLabel },
          { label: "Cycle", value: inv.billingCycle === "ANNUAL" ? "Annual" : "Monthly" },
        ]}
        totals={{ subtotal: Number(inv.amount), total: Number(inv.amount), paid: Number(inv.paid || 0), balance }}
        paidWatermark={fullyPaid}
        footer={p.gstNumber ? `GST: ${p.gstNumber} · This is a computer-generated subscription invoice.` : "This is a computer-generated subscription invoice."}
      >
        {/* Bill To — the hospital tenant */}
        <div style={{ marginBottom: 16, padding: 10, border: "1px solid #e5e7eb", borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5 }}>BILL TO</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{h.legalBusinessName || h.hospitalName || "—"}</div>
          {billToAddress && <div style={{ fontSize: 11.5, color: "#4b5563" }}>{billToAddress}</div>}
          {h.gstNumber && <div style={{ fontSize: 11.5, color: "#4b5563" }}>GST: {h.gstNumber}</div>}
          {h.officialEmail && <div style={{ fontSize: 11.5, color: "#4b5563" }}>{h.officialEmail}</div>}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead><tr>
            <th style={cellHead}>Description</th>
            <th style={{ ...cellHead, textAlign: "right" }}>Amount</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={cell}>
                {inv.planName} — {inv.billingCycle === "ANNUAL" ? "Annual" : "Monthly"} subscription
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Period: {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</div>
              </td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatINR(inv.amount)}</td>
            </tr>
          </tbody>
        </table>
      </BillDocument>
    </Box>
  );
}
