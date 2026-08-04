import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

/**
 * The hospital's configured GST/tax percentage (from hospital settings).
 * Cached and shared across components via react-query, so multiple consumers
 * (POS, payment dialog, invoice screen) trigger only one fetch. Returns 0 until
 * loaded / if unavailable.
 */
export function useHospitalTaxRate(): number {
  const { data } = useQuery({
    queryKey: ["hospital-tax-rate"],
    queryFn: async () => {
      const res = await axiosInstance.get("/hospital/settings");
      return Number(res.data?.data?.taxPercentage ?? 0);
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? 0;
}

/**
 * The hospital's configured pharmacy/medicine GST rate (0 = untaxed). Used by the
 * dispensary POS to preview GST on a medicine sale; the server still re-derives it
 * authoritatively at collection. Reads the settings payload's `settings` block.
 */
export function useHospitalPharmacyGstRate(): number {
  const { data } = useQuery({
    queryKey: ["hospital-pharmacy-gst-rate"],
    queryFn: async () => {
      const res = await axiosInstance.get("/hospital/settings");
      return Number(res.data?.data?.settings?.pharmacyGstPercent ?? 0);
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? 0;
}
