import { formatINR } from "@/utils/format";

/** A test's price as shown on order screens: a price-at-billing test has none yet, the billing counter types it. */
export function testPrice(t: { price?: number | string | null; priceAtBilling?: boolean }, decimals = 2): string {
  return t.priceAtBilling ? "At billing" : formatINR(Number(t.price ?? 0), decimals);
}
