type RoomPrice = { roomClassId: string; price: number | string };
/** A charge's price on a payer rate list (roomClassId "" = every room). */
export type ListPrice = { rateListId: string; roomClassId: string; price: number | string };

/**
 * A picked charge's price as the server bills it (resolveChargeItem): an insured
 * stay's rate list first (its price for the room, then for every room), then the
 * room-class price, then the base price.
 */
export function chargePriceFor(c: { price?: number | string; basePrice?: number; roomPrices?: RoomPrice[]; listPrices?: ListPrice[] }, roomClassId?: string | null, rateListId?: string | null): number {
  if (rateListId) {
    const mine = (c.listPrices ?? []).filter((p) => p.rateListId === rateListId);
    const listed = (roomClassId ? mine.find((p) => p.roomClassId === roomClassId) : undefined) ?? mine.find((p) => p.roomClassId === "");
    if (listed) return Number(listed.price);
  }
  if (roomClassId) {
    const rp = c.roomPrices?.find((r) => r.roomClassId === roomClassId);
    if (rp != null) return Number(rp.price);
  }
  return Number(c.basePrice ?? c.price);
}
