import { TextField, MenuItem, Box, Typography, Tooltip } from "@mui/material";
import { AccountTreeRounded } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";

/**
 * Hospital-admin pages that are the same for every branch (the multi-branch
 * model: setup, catalogues and the patient register are group-level; branch
 * differences are set inside them). Said under the picker, so it does not look
 * as though the picker did nothing.
 */
const SHARED_PAGES = [
  "/hospital/profile", "/hospital/settings", "/hospital/branches", "/hospital/module-access", "/hospital/departments",
  "/hospital/soc", "/hospital/doctors", "/hospital/medicines", "/hospital/vaccines", "/hospital/ward-chart",
  "/hospital/form-builder", "/hospital/lookups", "/hospital/organogram",
];
// Shared as a list only: every branch's patients are the hospital's, but one
// patient's profile shows the bills and stays of the branch picked.
const SHARED_LIST_ONLY = ["/hospital/patients"];

/**
 * Branch switcher for the hospital portal. Lets multi-branch users (org admins,
 * cross-branch staff) choose which branch the app operates on. The selection is
 * stored by HospitalAuthContext and sent to the backend as the X-Branch-Id
 * header on every request.
 *
 * Renders nothing for single-branch users (the common case), so it is safe to
 * drop into any hospital layout.
 */
export default function BranchSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "bar" } = {}) {
  const { availableBranches, activeBranchId, isOrgAdmin, setActiveBranch } = useHospitalAuth();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const shared = SHARED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || SHARED_LIST_ONLY.includes(pathname);

  // Nothing to switch between. In the top bar the one branch is still named:
  // where you are working is worth seeing even when you can't change it.
  if (availableBranches.length <= 1) {
    const only = availableBranches[0];
    if (variant !== "bar" || !only) return null;
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: "action.hover", color: "text.secondary", minWidth: 0 }}>
        <AccountTreeRounded sx={{ fontSize: 16 }} />
        <Typography noWrap variant="body2" sx={{ fontWeight: 600 }}>{only.branchName}</Typography>
      </Box>
    );
  }

  const ALL = "__ALL__";
  const hint = shared
    ? "This page is shared by every branch — the branch picked doesn't change it."
    : isOrgAdmin && !activeBranchId ? "Viewing every branch. Pick one to add or change records." : null;
  const inBar = variant === "bar";

  const picker = (
      <TextField
        select
        size="small"
        fullWidth={!inBar}
        sx={inBar ? { width: { xs: 150, sm: 210 } } : undefined}
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
  );

  // In the top bar: the picker, with what it means beside it where there is room
  // and on hover where there is not.
  if (inBar) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Tooltip title={hint ?? ""} disableHoverListener={!hint}><Box>{picker}</Box></Tooltip>
        {hint && (
          <Typography variant="caption" sx={{ display: { xs: "none", xl: "block" }, color: "text.secondary", maxWidth: 240, lineHeight: 1.3 }}>
            {hint}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ px: 0.5, pb: 1 }}>
      {picker}
      {hint && (
        <Typography variant="caption" sx={{ display: "block", mt: 0.5, px: 0.5, color: "text.secondary", lineHeight: 1.3 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
