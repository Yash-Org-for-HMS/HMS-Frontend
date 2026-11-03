type Line = { category?: string | null; unitPrice: unknown; originalUnitPrice?: unknown; taxPercent?: unknown; totalPrice?: unknown; taxAmount?: unknown; quantity?: unknown };

/**
 * A medicine line's price per unit as sold (GST inside), from what the line
 * holds: its total plus its GST, over the quantity - exact, where grossing up
 * the rounded ex-GST unit can come out a paisa high (9.53 x 1.05 = 10.01 for a
 * Rs 10 medicine).
 */
function asSold(l: Line): number {
  const qty = Number(l.quantity ?? 1) || 1;
  if (l.totalPrice != null) return Math.round(((Number(l.totalPrice) + Number(l.taxAmount ?? 0)) / qty) * 100) / 100;
  return Math.round(Number(l.unitPrice) * (100 + Number(l.taxPercent ?? 0))) / 100;
}

/**
 * The lines of an unpaid OPD bill whose price can be changed: all but a
 * package's contents (they stay at 0). None once money is taken, on a cancelled
 * bill, or on a discharge bill. A medicine can only come down (see medicineMrp).
 */
export function priceableLines<L extends Line>(
  bill: { InvoiceItem?: L[] | null; admissionId?: string | null; invoiceStatus?: string | null } | null | undefined, paid: number,
): L[] {
  if (!bill || paid > 0 || bill.admissionId || bill.invoiceStatus === "CANCELLED") return [];
  return (bill.InvoiceItem ?? []).filter((l) => !(l.category === "PACKAGE" && Number(l.unitPrice) === 0 && l.originalUnitPrice == null));
}

/**
 * A medicine line's price as sold (GST inside): the most it can be billed at.
 * Undefined for anything else. Once its price was changed only the ex-GST
 * stamp is left to rebuild it from, so that is rounded DOWN - the screen never
 * offers more than the server allows (going back to the MRP is a reset, which
 * the server prices exactly).
 */
export function medicineMrp(l: Line): number | undefined {
  if (l.category !== "PHARMACY") return undefined;
  if (l.originalUnitPrice == null) return asSold(l);
  return Math.floor(Number(l.originalUnitPrice) * (100 + Number(l.taxPercent ?? 0)) + 1e-6) / 100;
}

/** The unit price a person reads: a medicine's with its GST inside, anything else as billed. */
export function shownUnitPrice(l: Line): number {
  if (l.category !== "PHARMACY") return Number(l.unitPrice);
  return asSold(l);
}
