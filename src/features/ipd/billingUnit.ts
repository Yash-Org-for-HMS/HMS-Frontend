/**
 * How a bed's time is charged - its ward type's billing mode (backend
 * ipd.constants BILLING_MODE). The bed's rate and its room-class tariff are per
 * this unit, so every place that shows a rate says which.
 */
export type BillingUnit = "day" | "hour" | "session" | "visit" | null;

const RATE_SUFFIX: Record<string, string> = {
  PER_DAY: "/day", PER_HOUR: "/hour", PER_SESSION: "/session", PER_VISIT: "/visit",
};

/** "₹1,200/day", "₹300/hour"; for a ward whose bed time is not charged, says so. */
export function rateWithUnit(formatted: string, billingMode?: string | null): string {
  if (billingMode === "PER_PROCEDURE") return "in the procedure charge";
  if (billingMode === "INCLUDED") return "in the package";
  return `${formatted}${RATE_SUFFIX[billingMode ?? "PER_DAY"] ?? "/day"}`;
}

/** The rate field's label in a ward billed that way. */
export function rateLabel(billingMode?: string | null): string {
  switch (billingMode) {
    case "PER_HOUR": return "Charge per hour (₹)";
    case "PER_SESSION": return "Charge per session (₹)";
    case "PER_VISIT": return "Charge per visit (₹)";
    case "PER_PROCEDURE": return "Charge (not billed - part of the procedure)";
    case "INCLUDED": return "Charge (not billed - part of the package)";
    default: return "Daily charge (₹)";
  }
}

/** "3 hours", "1 session"; a segment whose time is not charged reads "included". */
export function unitCount(n: number, unit: BillingUnit | undefined): string {
  if (unit === null) return "included";
  const u = unit ?? "day";
  return `${n} ${u}${n === 1 ? "" : "s"}`;
}

/** "per hour", "in the package" - for "billed ..." sentences. */
export function billingModeText(billingMode?: string | null): string {
  switch (billingMode) {
    case "PER_HOUR": return "per hour";
    case "PER_SESSION": return "per session";
    case "PER_VISIT": return "per visit";
    case "PER_PROCEDURE": return "in the procedure charge";
    case "INCLUDED": return "in the package";
    default: return "per day";
  }
}
