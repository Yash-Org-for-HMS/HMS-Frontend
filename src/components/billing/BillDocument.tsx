import type { CSSProperties, ReactNode } from "react";
import { formatINR } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

/**
 * The single, consistent bill/receipt shell used by every printed billing
 * document in the product (OPD receipt, IPD final bill, POS-generated invoices).
 *
 * Deliberately built from plain elements + INLINE styles (no MUI `sx`): the
 * receipt dialogs print by copying this DOM's `innerHTML` into a bare iframe,
 * where emotion/MUI class styles would be lost. Inline styles survive that copy
 * AND render identically on screen.
 *
 * The line-item table is passed as `children` so each bill keeps the columns it
 * needs, while the header, title, meta grid, totals, footer and currency
 * (formatINR) stay identical everywhere.
 */

export interface BillHospital {
  hospitalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  officialPhone?: string | null;
  officialEmail?: string | null;
}

export interface BillMetaItem {
  label: string;
  value?: ReactNode;
}

export interface BillTotals {
  subtotal?: number; // gross
  discount?: number;
  tax?: number;
  taxLabel?: string;
  total: number; // net payable
  paid?: number;
  refunded?: number;
  balance?: number;
}

interface Props {
  /** "receipt" prints the hospital header; "letterhead" leaves a blank top gap
   *  for pre-printed stationery (in-patient bills). */
  variant?: "receipt" | "letterhead";
  hospital?: BillHospital | null;
  title: string;
  metaLeft?: BillMetaItem[];
  metaRight?: BillMetaItem[];
  /** The line-item table (and any per-bill blocks above it, e.g. "Bill To"). */
  children: ReactNode;
  totals: BillTotals;
  /** Payment/refund history or notes rendered under the totals. */
  afterTotals?: ReactNode;
  footer?: ReactNode;
  paidWatermark?: boolean;
}

const INK = "#111827";
const SUB = "#6b7280";
const POS = SEMANTIC.success;
const NEG = SEMANTIC.danger;
const REFUND = "#8b5cf6";

const money = (v: number | undefined) => formatINR(v ?? 0);

export default function BillDocument({
  variant = "receipt", hospital, title, metaLeft = [], metaRight = [],
  children, totals, afterTotals, footer, paidWatermark,
}: Props) {
  const addressLine = [hospital?.addressLine1, hospital?.addressLine2, hospital?.postalCode].filter(Boolean).join(", ");
  const contactLine = [
    hospital?.officialPhone ? `Phone: ${hospital.officialPhone}` : null,
    hospital?.officialEmail || null,
  ].filter(Boolean).join("   |   ");

  return (
    <div style={{ fontFamily: "'Inter', Arial, sans-serif", color: INK, position: "relative" }}>
      {variant === "letterhead" ? (
        <div style={{ height: "40mm" }} aria-hidden />
      ) : (
        <div style={{ textAlign: "center", borderBottom: `2px solid ${INK}`, paddingBottom: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{hospital?.hospitalName || "Hospital"}</div>
          {addressLine && <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{addressLine}</div>}
          {contactLine && <div style={{ fontSize: 12, color: SUB }}>{contactLine}</div>}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800, letterSpacing: 3, marginBottom: 16 }}>
        {title.toUpperCase()}
      </div>

      {(metaLeft.length > 0 || metaRight.length > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 16, fontSize: 12.5 }}>
          <div>{metaLeft.map((m, i) => <MetaLine key={i} label={m.label} value={m.value} />)}</div>
          <div style={{ textAlign: "right" }}>{metaRight.map((m, i) => <MetaLine key={i} label={m.label} value={m.value} />)}</div>
        </div>
      )}

      {children}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <div style={{ width: 300, borderTop: `2px solid ${INK}`, paddingTop: 8 }}>
          {totals.subtotal != null && <TotalLine label="Subtotal" value={money(totals.subtotal)} />}
          {totals.discount ? <TotalLine label="Discount" value={`- ${money(totals.discount)}`} color={POS} /> : null}
          {totals.tax ? <TotalLine label={totals.taxLabel || "Tax"} value={`+ ${money(totals.tax)}`} /> : null}
          <TotalLine label="Total" value={money(totals.total)} bold />
          {totals.paid != null && <TotalLine label="Paid" value={money(totals.paid)} />}
          {totals.refunded ? <TotalLine label="Refunded" value={`- ${money(totals.refunded)}`} color={REFUND} /> : null}
          {totals.balance != null && (
            <TotalLine label="Balance Due" value={money(totals.balance)} bold color={totals.balance > 0.005 ? NEG : POS} />
          )}
        </div>
      </div>

      {afterTotals}

      {paidWatermark && (
        <div style={{
          position: "absolute", top: "40%", left: 0, right: 0, textAlign: "center",
          fontSize: 92, fontWeight: 900, color: "rgba(16,185,129,0.12)",
          transform: "rotate(-18deg)", pointerEvents: "none", letterSpacing: 8,
        }} aria-hidden>PAID</div>
      )}

      <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
        {footer ?? "Thank you. This is a computer-generated document."}
      </div>
    </div>
  );
}

function MetaLine({ label, value }: BillMetaItem) {
  return (
    <div style={{ marginBottom: 3 }}>
      <span style={{ fontWeight: 700, color: "#4b5563" }}>{label}:</span> {value ?? "—"}
    </div>
  );
}

function TotalLine({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  const s: CSSProperties = {
    display: "flex", justifyContent: "space-between", margin: "4px 0",
    fontSize: bold ? 14 : 12.5, fontWeight: bold ? 800 : 500, color: color || "#374151",
  };
  return (
    <div style={s}>
      <span>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600 }}>{value}</span>
    </div>
  );
}
