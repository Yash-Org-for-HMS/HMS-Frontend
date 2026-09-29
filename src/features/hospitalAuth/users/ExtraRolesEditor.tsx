import { Box, Button, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import { AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { ROLE_HINT } from "@/constants/roles";

export interface ExtraRoleRow {
  roleId: string;
  /** "" = every facility */
  branchId: string;
}

interface Props {
  rows: ExtraRoleRow[];
  onChange: (rows: ExtraRoleRow[]) => void;
  roles: { roleId: string; roleCode?: string; roleName: string }[];
  branches: { branchId: string; branchName: string }[];
  primaryRoleId: string;
  /** Roles the plan's modules allow (hidden otherwise). */
  roleAllowed: (roleCode?: string) => boolean;
}

/**
 * Roles beside the main one (HMS_Platform_Master_Data.xlsx 15_System_Roles:
 * one staff can hold several, each at one facility or all). The main role
 * picks where the person lands after signing in; each extra role adds its
 * panel, reached from "Switch panel" in the sidebar.
 */
export default function ExtraRolesEditor({ rows, onChange, roles, branches, primaryRoleId, roleAllowed }: Props) {
  const set = (i: number, patch: Partial<ExtraRoleRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const options = roles.filter((r) => r.roleId !== primaryRoleId && roleAllowed(r.roleCode));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Additional roles</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
        Someone who does more than one job — a doctor who is also an admin, a clerk on both billing and the TPA desk. Each role can be
        for every facility or just one. Changes apply when they next sign in.
      </Typography>
      {rows.map((r, i) => {
        const code = roles.find((x) => x.roleId === r.roleId)?.roleCode;
        return (
          <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 1.5, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
            <TextField select size="small" label="Role" value={r.roleId} onChange={(e) => set(i, { roleId: e.target.value })}
              sx={{ minWidth: 240, flex: 1 }} helperText={code ? ROLE_HINT[code] : " "}>
              {options.map((o) => <MenuItem key={o.roleId} value={o.roleId}>{o.roleName}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="At" value={r.branchId} onChange={(e) => set(i, { branchId: e.target.value })}
              sx={{ minWidth: 200 }} helperText=" "
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">Every facility</MenuItem>
              {branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
            </TextField>
            <Tooltip title="Remove this role">
              <IconButton onClick={() => onChange(rows.filter((_, j) => j !== i))} sx={{ mt: 0.25 }}><DeleteOutlineRounded fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        );
      })}
      <Button size="small" startIcon={<AddRounded />} onClick={() => onChange([...rows, { roleId: "", branchId: "" }])}
        disabled={!options.length} sx={{ textTransform: "none", fontWeight: 600 }}>
        Add a role
      </Button>
    </Box>
  );
}
