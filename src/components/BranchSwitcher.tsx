import { TextField, MenuItem, Box } from "@mui/material";
import { AccountTreeRounded } from "@mui/icons-material";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";

/**
 * Branch switcher for the hospital portal. Lets multi-branch users (org admins,
 * cross-branch staff) choose which branch the app operates on. The selection is
 * stored by HospitalAuthContext and sent to the backend as the X-Branch-Id
 * header on every request.
 *
 * Renders nothing for single-branch users (the common case), so it is safe to
 * drop into any hospital layout.
 */
export default function BranchSwitcher() {
  const { availableBranches, activeBranchId, isOrgAdmin, setActiveBranch } = useHospitalAuth();

  // Nothing meaningful to switch between.
  if (availableBranches.length <= 1) return null;

  const ALL = "__ALL__";

  return (
    <Box sx={{ px: 0.5, pb: 1 }}>
      <TextField
        select
        size="small"
        fullWidth
        label="Active branch"
        value={activeBranchId ?? (isOrgAdmin ? ALL : "")}
        onChange={(e) => {
          const v = e.target.value;
          setActiveBranch(v === ALL ? null : v);
          // Reload so every page re-queries with the new branch (X-Branch-Id).
          window.location.reload();
        }}
        InputProps={{
          startAdornment: <AccountTreeRounded fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />,
        }}
      >
        {/* Org admins can view consolidated data across every branch. */}
        {isOrgAdmin && (
          <MenuItem value={ALL}>All branches (consolidated)</MenuItem>
        )}
        {availableBranches.map((b) => (
          <MenuItem key={b.branchId} value={b.branchId}>
            {b.branchName}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
