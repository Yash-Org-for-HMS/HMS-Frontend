import { Alert, Chip, Tooltip } from "@mui/material";
import { useUserCapacity, USER_LIMIT_MESSAGE } from "@/hooks/useUserCapacity";

/**
 * "Logins 35 of 50": how many people can sign in against the hospital's user
 * capacity, which the super admin sets. Shown where people are added.
 */
export function UserCapacityChip() {
  const { capacity, atLimit } = useUserCapacity();
  if (!capacity) return null;
  const near = !atLimit && capacity.used >= capacity.limit * 0.9;
  const where = capacity.source === "hospital"
    ? "This hospital's limit, set by your Super Admin."
    : capacity.source === "plan" ? `The ${capacity.planName ?? "current"} plan's limit.` : "The standard limit.";
  return (
    <Tooltip title={`${where} Logins that are switched off don't count.`}>
      <Chip
        size="small"
        label={`Logins ${capacity.used} of ${capacity.limit}`}
        color={atLimit ? "error" : near ? "warning" : "default"}
        variant={atLimit ? "filled" : "outlined"}
        sx={{ fontWeight: 600 }}
      />
    </Tooltip>
  );
}

/** Once the hospital is at its user capacity: say so, in the server's own words. */
export function UserLimitNotice() {
  const { atLimit } = useUserCapacity();
  if (!atLimit) return null;
  return <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{USER_LIMIT_MESSAGE}</Alert>;
}
