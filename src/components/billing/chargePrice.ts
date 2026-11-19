type RoomPrice = { roomClassId: string; price: number | string };
/** A charge's price on a payer rate list (roomClassId "" = every room). */
export type ListPrice = { rateListId: string; roomClassId: string; price: number | string };
/** A branch's own price for a charge (roomClassId "" = its base price). */
export type BranchPrice = { branchId: string; roomClassId: string; price: number | string };

/**
 * A picked charge's price as the server bills it (resolveChargeItem / priceAt):
 * an insured stay's rate list first (its price for the room, then for every
 * room), then the branch's room-class price, the group's room-class price, the
 * branch's base price, then the base price.
 */
export function chargePriceFor(c: { price?: number | string; basePrice?: number; roomPrices?: RoomPrice[]; listPrices?: ListPrice[]; branchPrices?: BranchPrice[] }, roomClassId?: string | null, rateListId?: string | null, branchId?: string | null): number {
  if (rateListId) {
    const mine = (c.listPrices ?? []).filter((p) => p.rateListId === rateListId);
    const listed = (roomClassId ? mine.find((p) => p.roomClassId === roomClassId) : undefined) ?? mine.find((p) => p.roomClassId === "");
    if (listed) return Number(listed.price);
  }
  const atBranch = branchId ? (c.branchPrices ?? []).filter((p) => p.branchId === branchId) : [];
  if (roomClassId) {
    const bp = atBranch.find((p) => p.roomClassId === roomClassId);
    if (bp) return Number(bp.price);
    const rp = c.roomPrices?.find((r) => r.roomClassId === roomClassId);
    if (rp != null) return Number(rp.price);
  }
  const branchBase = atBranch.find((p) => p.roomClassId === "");
  if (branchBase) return Number(branchBase.price);
  return Number(c.basePrice ?? c.price);
}

/** Who the bill is for: an out-patient, or an in-patient's stay. */
export type BillingSide = "OPD" | "IPD";

/**
 * A charge as one side bills it (the server's typedOn/priceAt): an in-patient
 * pays its IPD price where it has one, and its price is typed at billing when
 * the IPD side says so. With no IPD price set, IPD is the same as OPD. The
 * IPD price sits under the room-class and rate-list prices, as on the server,
 * and above a branch's base price (dropped here, so it cannot win).
 */
export function sidedCharge<T extends { price: number | string; priceAtBilling?: boolean; ipdPrice?: number | string | null; ipdPriceAtBilling?: boolean; branchPrices?: BranchPrice[] }>(c: T, side: BillingSide = "OPD"): T {
  if (side !== "IPD") return c;
  if (c.ipdPriceAtBilling) return { ...c, priceAtBilling: true };
  if (c.ipdPrice != null) return { ...c, priceAtBilling: false, price: c.ipdPrice, ...(c.branchPrices ? { branchPrices: c.branchPrices.filter((p) => p.roomClassId !== "") } : {}) };
  return c;
}
