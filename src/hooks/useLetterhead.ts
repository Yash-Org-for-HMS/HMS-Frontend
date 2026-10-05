import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import type { BillHospital } from "@/components/billing/BillDocument";

/**
 * The letterhead of the branch being worked at, for documents printed straight
 * from the browser (prescription, ID card, clinical records). Server-made
 * documents — bills, lab reports, consent forms — carry their own branch's
 * identity already.
 *
 * The same rules as those: the hospital's details, with the branch's own
 * address, contacts, GSTIN and logo where it has them, and `branchName` only
 * when the hospital has more than one branch. Null until loaded (callers fall
 * back to the session's hospital name).
 *
 * `enabled` false holds off asking — for a dialog that is mounted closed.
 */
export function useLetterhead(enabled = true): BillHospital | null {
  const { data } = useQuery<BillHospital | null>({
    queryKey: ["branch-letterhead"],
    queryFn: async () => (await axiosInstance.get("/hospital/branches/letterhead")).data?.data ?? null,
    staleTime: 5 * 60_000,
    enabled,
  });
  return data ?? null;
}

/** "12 Main Road, Sector 5, Gandhinagar, 382419" without saying a part twice. */
export function letterheadAddress(h: BillHospital | null | undefined): string {
  return [h?.addressLine1, h?.addressLine2, h?.landmark, h?.city, h?.postalCode]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .reduce<string[]>((parts, part) => {
      const already = parts.join(", ").toLowerCase();
      return part.length >= 3 && already.includes(part.toLowerCase()) ? parts : [...parts, part];
    }, [])
    .join(", ");
}
