import type { DispensableMedicine, PrescriptionItem, CartLine } from "@/types";

/**
 * Turn a doctor's prescription into dispensary cart lines.
 *
 * Extracted from DispensaryPOS.loadPrescription so it can be tested directly:
 * this is the step that decides how much of a drug leaves the pharmacy, and it
 * used to get that wrong. The bug was `if (match.inStock < item.quantity)` —
 * a prescribed item may carry no explicit quantity, and comparing a number
 * against `undefined` is always false, so the stock check was skipped and a
 * cart line was pushed with `quantity: undefined`: an order for an unknown
 * amount, with an NaN line total.
 *
 * Returns rather than throws. Nothing here talks to the UI; the caller decides
 * which toast to raise, so this stays pure.
 */
export interface PrescriptionToCartResult {
  /** Lines that can be dispensed now. */
  cart: CartLine[];
  /** Prescribed names with no catalog match — the pharmacist substitutes by hand. */
  missing: string[];
  /** Matched but short on stock, with what is actually available. */
  outOfStock: { medicineName: string; wanted: number; available: number }[];
}

/** A prescribed item with no explicit quantity means one unit, not "unknown". */
export function resolveQuantity(item: Pick<PrescriptionItem, "quantity">): number {
  const n = Number(item.quantity ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** Catalog match: exact medicine id first, then a generic-name containment fallback. */
function findMatch(item: PrescriptionItem, available: DispensableMedicine[]): DispensableMedicine | undefined {
  return available.find(
    (m) =>
      (item.medicineId != null && m.medicineId === item.medicineId) ||
      (!!m.genericName &&
        !!item.genericName &&
        m.genericName.toLowerCase().includes(item.genericName.toLowerCase())),
  );
}

export function prescriptionToCart(
  items: PrescriptionItem[],
  available: DispensableMedicine[],
): PrescriptionToCartResult {
  const cart: CartLine[] = [];
  const missing: string[] = [];
  const outOfStock: PrescriptionToCartResult["outOfStock"] = [];

  for (const item of items) {
    const match = findMatch(item, available);
    if (!match) {
      missing.push(item.medicineName || item.genericName || "Unnamed medicine");
      continue;
    }
    const wanted = resolveQuantity(item);
    if (match.inStock < wanted) {
      outOfStock.push({ medicineName: match.medicineName ?? "Unnamed medicine", wanted, available: match.inStock });
      continue;
    }
    cart.push({
      ...match,
      quantity: wanted,
      // sellingPrice arrives as a Decimal string; the cart does arithmetic on it.
      unitPrice: Number(match.sellingPrice),
    });
  }

  return { cart, missing, outOfStock };
}
