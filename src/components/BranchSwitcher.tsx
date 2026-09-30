import { TextField, MenuItem, Box, Typography } from "@mui/material";
import { AccountTreeRounded } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";

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
  const queryClient = useQueryClient();

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
          // setActiveBranch writes activeBranchId to sessionStorage synchronously,
          // and the axios interceptor reads it per-request — so the new X-Branch-Id
          // is live immediately.
          //
          // The cache is DROPPED, not just invalidated: invalidating kept showing
          // the old branch's lists until each refetch landed, and a form or dialog
          // opened at the old branch stayed open and saved into the new one. With
          // the cache empty, and HospitalProtectedRoute remounting the page for
          // the new branch, every screen starts clean under the branch chosen.
          setActiveBranch(v === ALL ? null : v);
          queryClient.removeQueries();
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
      {/* Records are made AT a branch; the combined view can only read. */}
      {isOrgAdmin && !activeBranchId && (
        <Typography variant="caption" sx={{ display: "block", mt: 0.5, px: 0.5, color: "text.secondary", lineHeight: 1.3 }}>
          Viewing every branch. Pick one to add or change records.
        </Typography>
      )}
    </Box>
  );
}
