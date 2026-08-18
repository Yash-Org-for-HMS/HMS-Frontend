import { describe, it, expect } from "vitest";
import { prescriptionToCart, resolveQuantity } from "./prescriptionToCart";
import type { DispensableMedicine, PrescriptionItem } from "@/types";

// sellingPrice is a decimal STRING on the wire — testing with numbers would let
// a string-coercion bug through.
const med = (medicineId: string, opts: Partial<DispensableMedicine> = {}): DispensableMedicine => ({
  medicineId,
  medicineCode: `C-${medicineId}`,
  medicineName: `Med ${medicineId}`,
  genericName: `generic-${medicineId}`,
  manufacturer: "Acme",
  sellingPrice: "32.50",
  inStock: 100,
  label: `Med ${medicineId}`,
  ...opts,
});

const rx = (o: Partial<PrescriptionItem> = {}): PrescriptionItem => ({ medicineName: "Med a", ...o });

describe("resolveQuantity", () => {
  it("uses the prescribed quantity", () => expect(resolveQuantity({ quantity: 4 })).toBe(4));

  // The bug. An item with no quantity used to make `inStock < undefined`
  // evaluate to false, skipping the stock check and putting `undefined` in the
  // cart — an order for an unknown amount with an NaN total.
  it("defaults a missing quantity to one rather than undefined", () => {
    expect(resolveQuantity({})).toBe(1);
    expect(resolveQuantity({ quantity: null })).toBe(1);
    expect(resolveQuantity({ quantity: undefined })).toBe(1);
  });

  it("never returns zero, a negative, or NaN", () => {
    expect(resolveQuantity({ quantity: 0 })).toBe(1);
    expect(resolveQuantity({ quantity: -3 })).toBe(1);
    expect(resolveQuantity({ quantity: "abc" as unknown as number })).toBe(1);
  });

  it("accepts a numeric string, as the API may send", () => expect(resolveQuantity({ quantity: "3" as unknown as number })).toBe(3));
});

describe("prescriptionToCart", () => {
  const stock = [med("a"), med("b", { inStock: 2 })];

  it("matches on medicine id and prices the line numerically", () => {
    const { cart, missing, outOfStock } = prescriptionToCart([rx({ medicineId: "a", quantity: 3 })], stock);
    expect(missing).toEqual([]);
    expect(outOfStock).toEqual([]);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
    expect(cart[0].unitPrice).toBe(32.5);
    expect(cart[0].quantity * cart[0].unitPrice).toBe(97.5);
  });

  // The regression, end to end through the mapper.
  it("carts a quantity-less item as one unit with a real total", () => {
    const { cart, outOfStock } = prescriptionToCart([rx({ medicineId: "a" })], stock);
    expect(outOfStock).toEqual([]);
    expect(cart[0].quantity).toBe(1);
    expect(Number.isNaN(cart[0].quantity * cart[0].unitPrice)).toBe(false);
    expect(cart[0].quantity * cart[0].unitPrice).toBe(32.5);
  });

  it("reports a short-stocked item instead of carting it", () => {
    const { cart, outOfStock } = prescriptionToCart([rx({ medicineId: "b", quantity: 5 })], stock);
    expect(cart).toEqual([]);
    expect(outOfStock).toEqual([{ medicineName: "Med b", wanted: 5, available: 2 }]);
  });

  it("falls back to a generic-name match when there is no id", () => {
    const { cart } = prescriptionToCart([rx({ genericName: "GENERIC-A", quantity: 1 })], stock);
    expect(cart[0].medicineId).toBe("a");
  });

  // A null medicineId must not match a catalog row that also has no id-style
  // match; otherwise an unmatched item would silently dispense the wrong drug.
  it("does not match on a null medicine id", () => {
    const noGeneric = [med("a", { genericName: "" })];
    const { cart, missing } = prescriptionToCart([rx({ medicineId: null, medicineName: "Unknown drug" })], noGeneric);
    expect(cart).toEqual([]);
    expect(missing).toEqual(["Unknown drug"]);
  });

  it("names an unmatched item, falling back through name then generic", () => {
    const { missing } = prescriptionToCart(
      [rx({ medicineId: "zzz", medicineName: "", genericName: "" })],
      stock,
    );
    expect(missing).toEqual(["Unnamed medicine"]);
  });

  it("keeps the good lines when one item of several fails", () => {
    const { cart, missing, outOfStock } = prescriptionToCart(
      [rx({ medicineId: "a", quantity: 2 }), rx({ medicineId: "b", quantity: 9 }), rx({ medicineId: "nope", medicineName: "Ghost" })],
      stock,
    );
    expect(cart.map((c) => c.medicineId)).toEqual(["a"]);
    expect(outOfStock.map((o) => o.medicineName)).toEqual(["Med b"]);
    expect(missing).toEqual(["Ghost"]);
  });

  it("returns empty results for an empty prescription", () => {
    expect(prescriptionToCart([], stock)).toEqual({ cart: [], missing: [], outOfStock: [] });
  });
});
