import { useEffect } from "react";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";

/**
 * Browser tab title for a hospital panel: the signed-in role, as the top bar
 * shows it ("Dolphin | Branch Admin", "Dolphin | Billing"). Several roles share
 * one panel, so the panel's own name told a Branch Admin's tab apart from
 * nothing. Falls back to the panel name before the user has loaded.
 */
export function useRoleTitle(panel: string) {
  const { user } = useHospitalAuth();
  const role = user?.roleName || panel;
  useEffect(() => {
    document.title = `Dolphin | ${role}`;
  }, [role]);
}
