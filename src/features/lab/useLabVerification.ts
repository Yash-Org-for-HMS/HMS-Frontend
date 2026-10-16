import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

/**
 * Whether this hospital verifies lab and radiology results (Hospital settings,
 * Clinical Workflow). Off, nothing offers a Verify step or marks a result
 * Verified / Unverified. Shares the settings page's query, so a save there
 * reaches every screen.
 */
export function useLabVerification(): boolean {
  const { data } = useQuery({
    queryKey: ["hospital-settings"],
    queryFn: async () => (await axiosInstance.get("/hospital/settings")).data.data,
    staleTime: 5 * 60_000,
  });
  return !!data?.settings?.labVerificationEnabled;
}
