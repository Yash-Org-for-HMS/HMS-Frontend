import { Box, TextField, MenuItem, FormControlLabel, Switch } from "@mui/material";
import type { LeaveScope } from "./leaveScope";

/**
 * Where and when a doctor's leave applies: every branch or one, the whole day
 * or part of it ("a morning off at Branch A"). Shared by the admin's leave
 * screen and the doctor's own.
 */

export default function LeaveScopeFields({ value, onChange, branches }: {
  value: LeaveScope;
  onChange: (v: LeaveScope) => void;
  /** The branches the leave can be for; with one or none, the choice is not shown. */
  branches: { branchId: string; branchName: string }[];
}) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
      {branches.length > 1 && (
        <TextField
          id="leave-branch" select size="small" label="Branch" value={value.branchId} sx={{ minWidth: 180 }}
          onChange={(e) => onChange({ ...value, branchId: e.target.value })}
          SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}
        >
          <MenuItem value="">Every branch</MenuItem>
          {branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
        </TextField>
      )}
      <FormControlLabel
        control={<Switch id="leave-part-day" checked={value.partDay} onChange={(e) => onChange({ ...value, partDay: e.target.checked })} />}
        label="Part of the day"
      />
      {value.partDay && (
        <>
          <TextField id="leave-from-time" size="small" type="time" label="From" InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
            value={value.startTime} onChange={(e) => onChange({ ...value, startTime: e.target.value })} />
          <TextField id="leave-to-time" size="small" type="time" label="To" InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
            value={value.endTime} onChange={(e) => onChange({ ...value, endTime: e.target.value })} />
        </>
      )}
    </Box>
  );
}
