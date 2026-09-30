import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, TextField, MenuItem, Avatar, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack,
} from "@mui/material";
import { AddRounded, EditRounded, SearchRounded, KeyRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import CredentialDialog from "@/components/CredentialDialog";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { SEMANTIC } from "@/styles/accents";
import StaffDialog from "./StaffDialog";
import type { StaffRow, StaffListResponse, StaffOptions } from "./staff.types";
import { STATUS_LABEL } from "./staff.types";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";

/**
 * Everyone who works at the hospital — with a login or without — with their
 * designation and grade, home department, posting and who they report to
 * (HMS_Platform_Master_Data.xlsx, 17_Staff_Onboarding). People with a login
 * appear here on their own; the Issues column is the sheet's validation column.
 */

/** Short names for the checks; the full sentence is the tooltip. */
const ISSUE_SHORT: Record<string, string> = {
  NO_ADMIN_MANAGER: "No manager yet", NO_HOME_DEPARTMENT: "No home department", NO_DESIGNATION: "No designation",
  MANAGER_EXITED: "Manager has left", EXITED_LOGIN_ACTIVE: "Login still on", SELF: "Reports to self",
  ADMIN_NOT_SENIOR: "Manager not senior", FUNCTIONAL_NOT_SENIOR: "Day-to-day manager not senior",
  ADMIN_LOOP: "Reporting loop", FUNCTIONAL_LOOP: "Reporting loop",
};

const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 400, fontSize: "0.875rem", py: undefined };
const CELL_SX = { borderBottom: "1px solid", borderColor: "divider" };

function GiveLoginDialog({ row, options, onClose, onDone }: {
  row: StaffRow; options: StaffOptions; onClose: () => void;
  onDone: (credentials: { email: string; temporaryPassword: string }) => void;
}) {
  const toast = useToast();
  const guess: Record<string, string> = { DOCTOR: "DOCTOR", NURSE: "NURSE", PHARMACIST: "PHARMACIST", TECHNICIAN: "LAB_TECH" };
  const [email, setEmail] = useState(row.email ?? "");
  const [roleId, setRoleId] = useState(options.roles.find((r) => r.roleCode === guess[row.staffCategoryCode])?.roleId ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/hospital/staff/${row.staffId}/account`, { email: email.trim(), roleId });
      onDone(res.data.credentials);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't create the login"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Give {row.name} a login</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField fullWidth required label="Login email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField select fullWidth required label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} helperText="What they can open. Separate from the designation.">
            {options.roles.map((r) => <MenuItem key={r.roleId} value={r.roleId}>{r.roleName}</MenuItem>)}
          </TextField>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>A temporary password is made for them; they change it at first sign-in.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!email.trim() || !roleId || saving}
          startIcon={saving ? <HeartbeatLoader size={20} /> : undefined} sx={{ textTransform: "none", fontWeight: 600 }}>
          Create login
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function StaffDirectory() {
  const toast = useToast();
  const { user } = useHospitalAuth();
  // Logins carry roles — only the Hospital Admin hands them out (HR Admin runs the rest).
  const canGiveLogins = hasRole(user, "H_ADMIN");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [branch, setBranch] = useState("");
  const [attention, setAttention] = useState(false);
  const [dialog, setDialog] = useState<{ row: StaffRow | null } | null>(null);
  const [loginFor, setLoginFor] = useState<StaffRow | null>(null);
  const [cred, setCred] = useState<{ email: string; password: string; name: string } | null>(null);

  const list = useQuery<StaffListResponse>({
    queryKey: ["staff-directory"],
    queryFn: async () => { const d = (await axiosInstance.get("/hospital/staff")).data; return { data: d.data, summary: d.summary }; },
  });
  const opts = useQuery<StaffOptions>({
    queryKey: ["staff-options"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/options")).data.data,
  });
  const options = opts.data;
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const summary = list.data?.summary;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!category || r.staffCategoryCode === category) &&
      // Someone who works at the facility, as home or also — or at none in particular.
      (!branch || !(r.worksAt ?? []).length || (r.worksAt ?? []).some((w) => w.branchId === branch)) &&
      (!attention || r.issues.length > 0) &&
      (!q || [r.name, r.employment?.employeeCode, r.employment?.designationName, r.primaryDepartment?.departmentName, r.login?.email]
        .some((v) => (v ?? "").toLowerCase().includes(q))));
  }, [rows, search, category, branch, attention]);

  const { sorted, orderBy, order, onSort } = useTableSort(filtered, {
    name: (r) => r.name,
    designation: (r) => r.employment?.grade ?? 99,
    department: (r) => r.primaryDepartment?.departmentName ?? null,
    posting: (r) => r.posting?.label ?? null,
    manager: (r) => r.adminManager?.name ?? null,
    issues: (r) => r.issues.length,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["staff-directory"] });
    void qc.invalidateQueries({ queryKey: ["staff-options"] });
    void qc.invalidateQueries({ queryKey: ["ward-in-charge-options"] });
    void qc.invalidateQueries({ queryKey: ["hospital-users-list"] });
  };

  return (
    <>
      <Box>
        <PageHeader
          title="Staff Directory"
          subtitle="Everyone who works here — with or without a login — their designation, department, posting and who they report to."
          actions={
            <Button variant="contained" startIcon={<AddRounded />} disabled={!options} onClick={() => setDialog({ row: null })} sx={{ textTransform: "none", fontWeight: 600, px: 3 }}>
              Add staff member
            </Button>
          }
        />

        {summary && (
          <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <Chip label={`${summary.active} working`} sx={{ fontWeight: 600 }} />
            <Chip label={`${summary.withLogin} with a login`} variant="outlined" />
            <Chip label={`${summary.withoutLogin} without`} variant="outlined" />
            {summary.needingAttention > 0 && (
              <Chip label={`${summary.needingAttention} need attention`} onClick={() => setAttention((v) => !v)}
                sx={{ fontWeight: 600, bgcolor: attention ? SEMANTIC.warningDark : `${SEMANTIC.warning}22`, color: attention ? "#fff" : SEMANTIC.warningDark }} />
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" placeholder="Search name, code, designation…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 260 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">All categories</MenuItem>
            {(options?.categories ?? []).map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
          </TextField>
          {(options?.branches.length ?? 0) > 1 && (
            <TextField select size="small" label="Facility" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">All facilities</MenuItem>
              {options!.branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
            </TextField>
          )}
          <Typography variant="body2" sx={{ color: "text.secondary", ml: "auto" }}>
            {filtered.length} {filtered.length === 1 ? "person" : "people"}
          </Typography>
        </Box>

        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "calc(100vh - 340px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Staff member" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Designation" sortKey="designation" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Department" sortKey="department" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Posting" sortKey="posting" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Reports to" sortKey="manager" orderBy={orderBy} order={order} onSort={onSort} sx={{ ...HEAD_SX, whiteSpace: "nowrap" }} />
                <SortableHeadCell label="Checks" sortKey="issues" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell align="right" sx={{ color: "text.secondary", ...CELL_SX, bgcolor: "background.default" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.isLoading ? (
                <TableRowsSkeleton rows={6} columns={7} />
              ) : list.isError ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 3, borderBottom: "none" }}><ErrorState message={apiErrorText(list.error)} onRetry={() => list.refetch()} /></TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 3, borderBottom: "none" }}>
                  <Mascot pose="nothing-here-yet" subtitle={rows.length ? "Nobody matches these filters." : "No staff yet — add the first person."} size={120} />
                </TableCell></TableRow>
              ) : sorted.map((r) => {
                const exited = r.status === "EXITED";
                return (
                  <TableRow key={r.staffId} hover sx={{ opacity: exited ? 0.6 : 1, "&:last-child td": { border: 0 } }}>
                    <TableCell sx={CELL_SX}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: "0.875rem", fontWeight: 700 }}>{r.firstName.charAt(0)}{r.lastName.charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.name}</Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {[r.staffCategoryName, r.employment?.employeeCode].filter(Boolean).join(" · ")}
                          </Typography>
                          {(options?.branches.length ?? 0) > 1 && (r.worksAt ?? []).length > 0 && (
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                              {(r.worksAt ?? []).map((w) => w.branchName).join(" · ")}
                            </Typography>
                          )}
                          <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                            {r.login
                              ? <Chip size="small" label={`Login · ${r.login.roleName}`} sx={{ height: 18, fontSize: "0.7rem", opacity: r.login.isActive ? 1 : 0.6 }} />
                              : <Chip size="small" variant="outlined" label="No login" sx={{ height: 18, fontSize: "0.7rem" }} />}
                            {r.status !== "ACTIVE" && <Chip size="small" label={STATUS_LABEL[r.status] ?? r.status} sx={{ height: 18, fontSize: "0.7rem", fontWeight: 600 }} />}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2">{r.employment?.designationName ?? "—"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {[r.employment?.grade != null ? `Grade ${r.employment.grade}` : null, r.employment && r.employment.employmentTypeCode !== "FULL_TIME" ? r.employment.employmentTypeName : null].filter(Boolean).join(" · ")}
                      </Typography>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2" component="div">
                        {r.primaryDepartment?.departmentName ?? "—"}
                        {r.primaryDepartment?.roleInDept === "HOD" && <Chip size="small" label="HOD" sx={{ height: 18, ml: 0.75, fontSize: "0.7rem", fontWeight: 700 }} />}
                      </Typography>
                      {r.additionalDepartments.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>also {r.additionalDepartments.map((d) => d.departmentName).join(", ")}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2">{r.posting?.label || "—"}</Typography>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2">{r.adminManager?.name ?? "—"}</Typography>
                      {r.functionalManager && <Typography variant="caption" sx={{ color: "text.secondary" }}>day to day: {r.functionalManager.name}</Typography>}
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      {r.issues.length === 0
                        ? <Chip size="small" label="OK" sx={{ height: 20, fontWeight: 600, bgcolor: `${SEMANTIC.success}1a`, color: SEMANTIC.success }} />
                        : (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, alignItems: "flex-start" }}>
                            {r.issues.map((i) => (
                              <Tooltip key={i.code} title={i.message}>
                                <Chip size="small" label={ISSUE_SHORT[i.code] ?? i.message}
                                  sx={{ height: 20, fontSize: "0.72rem", fontWeight: 600,
                                    bgcolor: i.level === "error" ? `${SEMANTIC.danger}14` : `${SEMANTIC.warning}1f`, color: i.level === "error" ? SEMANTIC.danger : SEMANTIC.warningDark }} />
                              </Tooltip>
                            ))}
                          </Box>
                        )}
                    </TableCell>
                    <TableCell align="right" sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                      {canGiveLogins && !r.login && !exited && (
                        <Tooltip title="Give a login">
                          <span>
                            <IconButton size="small" disabled={!options} onClick={() => setLoginFor(r)} sx={{ color: "text.secondary" }}><KeyRounded fontSize="small" /></IconButton>
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <span>
                          <IconButton size="small" disabled={!options} onClick={() => setDialog({ row: r })} sx={{ color: "text.secondary" }}><EditRounded fontSize="small" /></IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {dialog && options && (
        <StaffDialog
          row={dialog.row}
          options={options}
          canGiveLogin={canGiveLogins}
          onClose={() => setDialog(null)}
          onSaved={({ row, warnings, credentials }) => {
            setDialog(null);
            refresh();
            toast.success(dialog.row ? "Saved" : `${row.name} added`);
            if (warnings.length) toast.warning(warnings.map((w) => w.message).join(" · "));
            if (credentials) setCred({ email: credentials.email, password: credentials.temporaryPassword, name: row.name });
          }}
        />
      )}
      {loginFor && options && (
        <GiveLoginDialog
          row={loginFor}
          options={options}
          onClose={() => setLoginFor(null)}
          onDone={(c) => {
            setCred({ email: c.email, password: c.temporaryPassword, name: loginFor.name });
            setLoginFor(null);
            refresh();
          }}
        />
      )}
      <CredentialDialog
        open={!!cred}
        title="Login created"
        email={cred?.email ?? ""}
        password={cred?.password ?? ""}
        name={cred?.name}
        note="They will be asked to change this password when they first sign in. Share it securely."
        onClose={() => setCred(null)}
      />
    </>
  );
}
