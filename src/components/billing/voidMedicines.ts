import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

/** A medicine still out on a bill (dispensed minus already returned), from the stock ledger. */
export interface OutstandingMedicine {
  medicineId: string;
  medicineName: string;
  dispensed: number;
  returned: number;
  returnable: number;
}

/** The counter's answer for one medicine: back on the shelf, or not (with why). */
export interface MedicineChoice {
  returned: boolean | null;
  reason: string;
}
export type MedicineChoices = Record<string, MedicineChoice>;

/**
 * The medicines a void has to account for. Same server list the refund screen
 * offers for returns, so the counter is told the real quantity still out.
 */
export function useOutstandingMedicines(invoiceId: string | undefined, enabled: boolean, basePath = "/reception/billing") {
  const { data = [], isLoading } = useQuery<OutstandingMedicine[]>({
    queryKey: ["returnable-medicines", invoiceId],
    queryFn: async () => (await axiosInstance.get(`${basePath}/invoices/${invoiceId}/returnable-medicines`)).data.data,
    enabled: !!invoiceId && enabled,
    // Another desk returning a strip changes this; stale numbers would let the
    // void declare a medicine the server no longer has out.
    staleTime: 0,
  });
  return { medicines: data.filter((m) => m.returnable > 0), isLoading };
}

/** Every medicine answered, and every one not returned has a reason. */
export function declarationReady(medicines: OutstandingMedicine[], choices: MedicineChoices): boolean {
  return medicines.every((m) => {
    const c = choices[m.medicineId];
    if (!c || c.returned === null) return false;
    return c.returned || c.reason.trim().length >= 3;
  });
}

/** Any medicine not returned: the void then waits for an administrator. */
export function writesOff(medicines: OutstandingMedicine[], choices: MedicineChoices): boolean {
  return medicines.some((m) => choices[m.medicineId]?.returned === false);
}

/** The body field the void endpoints take (`medicines`). */
export function declarationPayload(medicines: OutstandingMedicine[], choices: MedicineChoices) {
  return medicines.map((m) => {
    const c = choices[m.medicineId];
    return c?.returned
      ? { medicineId: m.medicineId, returned: true }
      : { medicineId: m.medicineId, returned: false, reason: (c?.reason ?? "").trim() };
  });
}
