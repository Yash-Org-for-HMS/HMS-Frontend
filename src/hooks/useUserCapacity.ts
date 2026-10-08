import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

/** The hospital's logins against its user capacity (backend lib/userCapacity). */
export interface UserCapacity {
  used: number;
  limit: number;
  remaining: number;
  /** This hospital's own limit (set by the super admin), its plan's, or the platform default. */
  source: "hospital" | "plan" | "default";
  planLimit: number | null;
  planName: string | null;
}

/** The message the server sends when the limit is reached — the same words on screen. */
export const USER_LIMIT_MESSAGE = "User limit reached. Please contact your Super Admin to increase your user capacity.";

export const USER_CAPACITY_KEY = ["user-capacity"] as const;

/** For the screens that add people: how many logins are left, and whether none are. */
export function useUserCapacity(enabled = true) {
  const { data } = useQuery<UserCapacity>({
    queryKey: USER_CAPACITY_KEY,
    queryFn: async () => (await axiosInstance.get("/hospital/users/capacity")).data.data,
    enabled,
  });
  return { capacity: data, atLimit: !!data && data.remaining <= 0 };
}
