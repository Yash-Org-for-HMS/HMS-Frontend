import type { CSSProperties, ReactNode } from "react";
import { formatINR, formatDateTime } from "@/utils/format";
import { assetUrl } from "@/utils/assetUrl";
import { SEMANTIC } from "@/styles/accents";

/**
 * The single, consistent bill/receipt shell used by every printed billing
 * document in the product (OPD receipt, IPD final bill, POS-generated invoices).
 *
 * Plain elements with INLINE styles, not MUI `sx`: printing copies this DOM's
 * `innerHTML` into a bare iframe, where emotion class styles would be lost.
 *
 * The line-item table is `children` so each bill keeps its own columns, while
 * the header, totals, footer and currency stay identical everywhere.
 */

/**
 * Mirrors HOSPITAL_DOCUMENT_IDENTITY on the server — the one select every
 * document endpoint now uses. Previously this type stopped at six fields, so
 * the logo the lab receipt endpoint had always sent was dropped on the floor,
 * and `landmark`/`city` never reached the address line: printed receipts named
 * a street and a PIN code but not the town.
 */
export interface BillHospital {
  hospitalName?: string | null;
  legalBusinessName?: string | null;
  registrationNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string | null;
  postalCode?: string | null;
  officialPhone?: string | null;
  officialEmail?: string | null;
  gstNumber?: string | null;
  logoUrl?: string | null;
}

export interface BillMetaItem {
  label: string;
  value?: ReactNode;
}

export interface BillTotals {
  subtotal?: number; // gross
  discount?: number;
  tax?: number;      // combined tax (fallback when cgst/sgst not supplied)
  taxLabel?: string;
  cgst?: number;     // when supplied (and non-zero), CGST + SGST print as two lines
  sgst?: number;
  total: number; // net payable
  paid?: number;
  refunded?: number;
  balance?: number;
  /**
   * Why the balance is outstanding, when a refund is the reason.
   *
   * A bill paid in full and then refunded in full shows "Balance Due ₹850",
   * which is arithmetically right — nothing is paid any more — but on screen and
   * on paper it is indistinguishable from a bill that was never paid, so the
   * desk is invited to collect it a second time. This line says which it is.
   */
  balanceNote?: string;
}

interface Props {
  /** "receipt" prints the hospital header; "letterhead" leaves a blank top gap
   *  for pre-printed stationery (in-patient bills). */
  variant?: "receipt" | "letterhead";
  hospital?: BillHospital | null;
  title: string;
  /** The document's own reference, shown on the right of the title bar
   *  (e.g. "INV-0042 · 23 Sep 2026 · PAID"). */
  titleRight?: ReactNode;
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
  variant = "receipt", hospital, title, titleRight, metaLeft = [], metaRight = [],
  children, totals, afterTotals, footer, paidWatermark,
}: Props) {
  return (
    <div style={{ fontFamily: "'Inter', Arial, sans-serif", color: INK, position: "relative" }}>
      <BillLetterhead hospital={hospital} variant={variant} />
      <BillTitleBar title={title} right={titleRight} />

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
          {/* CGST/SGST as separate lines when supplied and non-zero; otherwise the
              combined tax line; nothing when the bill is fully exempt (all zero). */}
          {totals.cgst || totals.sgst ? (
            <>
              <TotalLine label="CGST" value={`+ ${money(totals.cgst)}`} />
              <TotalLine label="SGST" value={`+ ${money(totals.sgst)}`} />
            </>
          ) : totals.tax ? (
            <TotalLine label={totals.taxLabel || "Tax"} value={`+ ${money(totals.tax)}`} />
          ) : null}
          <TotalLine label="Total" value={money(totals.total)} bold />
          {totals.paid != null && <TotalLine label="Paid" value={money(totals.paid)} />}
          {totals.refunded ? <TotalLine label="Refunded" value={`- ${money(totals.refunded)}`} color={REFUND} /> : null}
          {totals.balance != null && (
            <TotalLine label="Balance Due" value={money(totals.balance)} bold color={totals.balance > 0.005 ? NEG : POS} />
          )}
          {totals.balanceNote && (
            <div style={{ fontSize: 10.5, color: SUB, textAlign: "right", marginTop: 2, lineHeight: 1.35 }}>
              {totals.balanceNote}
            </div>
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

      {/* The printed-on stamp is not decoration: these documents get reprinted,
          and a desk holding two copies of the same invoice needs to know which
          one it is looking at. It sits opposite the note so neither wraps. */}
      <BillFooter>{footer}</BillFooter>
    </div>
  );
}

/**
 * The hospital's identity block — the top of every printed document.
 *
 * Exported because not every document is a <BillDocument>: the in-patient bill
 * groups its lines by category and has a totals panel of its own (deposits,
 * IGST, refundable balance), so it composes the shared header and footer around
 * its own body rather than being forced through this component's middle.
 */
export function BillLetterhead({ hospital, variant = "receipt" }: { hospital?: BillHospital | null; variant?: "receipt" | "letterhead" }) {
  /**
   * One address line, without saying anything twice.
   *
   * Hospitals routinely type the whole address into line 1 — the live tenant's
   * reads "…Kudasan, Gandhinagar, Gujarat 382419" — and then fill `city` and
   * `postalCode` as well. Joining the fields blindly printed
   * "…Gujarat 382419, Ahmedabad, 382419" on every invoice: the PIN twice, and
   * a city that contradicted the one already in the line. Later parts already
   * present are dropped; the first mention wins. Parts under three characters
   * are kept regardless, since a short one matches almost anything.
   */
  const addressLine = [
    hospital?.addressLine1, hospital?.addressLine2, hospital?.landmark,
    hospital?.city, hospital?.postalCode,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .reduce<string[]>((parts, part) => {
      const already = parts.join(", ").toLowerCase();
      if (part.length >= 3 && already.includes(part.toLowerCase())) return parts;
      return [...parts, part];
    }, [])
    .join(", ");
  const contactLine = [
    hospital?.officialPhone ? `Ph: ${hospital.officialPhone}` : null,
    hospital?.officialEmail || null,
  ].filter(Boolean).join("  ·  ");

  // Pre-printed stationery already carries the identity; printing it again would
  // overlap it. Only the GSTIN is repeated, because the paper rarely has it.
  if (variant === "letterhead") {
    return (
      <>
        <div style={{ height: "40mm" }} aria-hidden />
        {hospital?.gstNumber && (
          <div style={{ textAlign: "right", fontSize: 11.5, color: SUB, marginBottom: 6 }}>GSTIN: {hospital.gstNumber}</div>
        )}
      </>
    );
  }

  /* Identity left, statutory IDs right. The IDs sit apart from the address
     because that is what a reader scans for on a tax invoice — and keeping them
     out of the address block lets a long address wrap without pushing the GSTIN
     somewhere unpredictable. */
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
      borderBottom: `2px solid ${INK}`, paddingBottom: 10,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
        {hospital?.logoUrl && (
          <img
            src={assetUrl(hospital.logoUrl)}
            alt=""
            /* A broken logo must not leave a torn-image icon on a bill the
               patient keeps. Uploads live on ephemeral storage, so a missing
               file is an expected state here, not a defensive flourish. */
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ height: 46, width: "auto", objectFit: "contain" }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: 0.2 }}>{hospital?.hospitalName || "Hospital"}</div>
          {hospital?.legalBusinessName && <div style={{ fontSize: 11, color: SUB }}>{hospital.legalBusinessName}</div>}
          {addressLine && <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{addressLine}</div>}
          {contactLine && <div style={{ fontSize: 11, color: SUB }}>{contactLine}</div>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {hospital?.gstNumber && <div style={{ fontSize: 11.5, fontWeight: 700 }}>GSTIN: {hospital.gstNumber}</div>}
        {hospital?.registrationNumber && <div style={{ fontSize: 10.5, color: SUB }}>Reg: {hospital.registrationNumber}</div>}
      </div>
    </div>
  );
}

/**
 * The document's own name and reference. `right` carries the invoice number,
 * date and status so they read on the title's line rather than competing with
 * the hospital's identity above it.
 */
export function BillTitleBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      background: "#f1f5f9", borderRadius: 4, padding: "6px 12px", margin: "12px 0 16px",
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2 }}>{title.toUpperCase()}</span>
      {right && <span style={{ fontSize: 11.5, color: SUB, textAlign: "right" }}>{right}</span>}
    </div>
  );
}

/**
 * The closing line of every printed document.
 *
 * The printed-on stamp is not decoration: these get reprinted, and a desk
 * holding two copies of one invoice needs to know which is which. It sits
 * opposite the note so neither wraps into the other.
 */
export function BillFooter({ children }: { children?: ReactNode }) {
  return (
    <div style={{
      marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 8,
      display: "flex", justifyContent: "space-between", gap: 16,
      fontSize: 10, color: "#9ca3af",
    }}>
      <span>{children ?? "Computer-generated document — no signature required."}</span>
      <span style={{ flexShrink: 0 }}>Printed {formatDateTime(new Date())}</span>
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
  