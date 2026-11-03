type Line = { category?: string | null; unitPrice: unknown; originalUnitPrice?: unknown; taxPercent?: unknown };

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

/** A medicine line's price as sold (GST inside): the most it can be billed at. Undefined for anything else. */
export function medicineMrp(l: Line): number | undefined {
  if (l.category !== "PHARMACY") return undefined;
  return Math.round(Number(l.originalUnitPrice ?? l.unitPrice) * (100 + Number(l.taxPercent ?? 0))) / 100;
}

/** The unit price a person reads: a medicine's with its GST inside, anything else as billed. */
export function shownUnitPrice(l: Line): number {
  if (l.category !== "PHARMACY") return Number(l.unitPrice);
  return Math.round(Number(l.unitPrice) * (100 + Number(l.taxPercent ?? 0))) / 100;
}
