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
import { UserCapacityChip, UserLimitNotice } from "@/components/UserCapacity";
import { USER_CAPACITY_KEY } from "@/hooks/useUserCapacity";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import CredentialDialog from "@/components/CredentialDialog";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { useClientPage } from "@/components/table/useClientPage";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { SEMANTIC } from "@/styles/accents";
import StaffDialog from "./StaffDialog";
import type { StaffRow, StaffListResponse, StaffOptions } from "./staff.types";
import { STATUS_LABEL, ROLE_IN_DEPT_LABEL } from "./staff.types";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * Everyone who works at the hospital - with a login or without - with their
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

const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 400, fontSize: "0.875rem", py: undefined, px: 1.5 };
const CELL_SX = { borderBottom: "1px solid", borderColor: "divider", px: 1.5 };

function GiveLoginDialog({ row, options, onClose, onDone }: {
  row: StaffRow; options: StaffOptions; onClose: () => void;
  onDone: (credentials: { email: string | null; loginId?: string | null; temporaryPassword: string }, doctorId: string | null) => void;
}) {
  const toast = useToast();
  const guess: Record<string, string> = { DOCTOR: "DOCTOR", NURSE: "NURSE", PHARMACIST: "PHARMACIST", TECHNICIAN: "LAB_TECH" };
  const [email, setEmail] = useState(row.email ?? "");
  // null until typed in: until then the suggested ID (hospital short code and a number) is used.
  const [typedId, setLoginId] = useState<string | null>(null);
  const { data: suggestedId } = useQuery({
    queryKey: ["staff-login-id-suggestion"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/login-id-suggestion")).data.data.loginId as string,
    staleTime: 0,
  });
  const loginId = typedId ?? suggestedId ?? "";
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(options.roles.find((r) => r.roleCode === guess[row.staffCategoryCode])?.roleId ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/hospital/staff/${row.staffId}/account`, { loginId: loginId.trim() || undefined, email: email.trim() || undefined, roleId, ...(password ? { initialPassword: password } : {}) });
      onDone(res.data.credentials, res.data.doctorId ?? null);
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
          <TextField fullWidth label="Login ID" value={loginId} onChange={(e) => setLoginId(e.target.value)}
            helperText="What they type to sign in. Made up for you; change it if they already have an ID (e.g. from your old software)." slotProps={{ htmlInput: { maxLength: 50 } }} />
          <TextField fullWidth label={loginId.trim() ? "Email (optional)" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)}
            helperText="Give a login ID, an email, or both." />
          <TextField select fullWidth required label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} helperText="What they can open. Separate from the designation.">
            {options.roles.map((r) => <MenuItem key={r.roleId} value={r.roleId}>{r.roleName}</MenuItem>)}
          </TextField>
          <TextField fullWidth id="give-login-password" type="password" autoComplete="new-password" label="Starting password (optional)"
            value={password} onChange={(e) => setPassword(e.target.value)} error={password.length > 0 && password.length < 6}
            helperText={password.length > 0 && password.length < 6 ? "At least 6 characters" : "Leave blank and one is made up for them; they change it at first sign-in."} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={(!email.trim() && !loginId.trim()) || !roleId || saving || (password.length > 0 && password.length < 6)}
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
  // Logins carry roles - only the Hospital Admin hands them out (HR Admin runs the rest).
  const canGiveLogins = hasRole(user, "H_ADMIN");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [branch, setBranch] = useState("");
  const [attention, setAttention] = useState(false);
  const [dialog, setDialog] = useState<{ row: StaffRow | null } | null>(null);
  // "Add staff member" on Logins & roles lands here (?add=login): the one place
  // a person is added, with their login already ticked.
  const [searchParams, setSearchParams] = useSearchParams();
  // "Add Doctor" on the Doctors page lands here too (?add=doctor), as a doctor
  // with a login; once saved, the doctor profile opens for fees and registration.
  const addWithLogin = searchParams.get("add") === "login" || searchParams.get("add") === "doctor";
  const addCategory = searchParams.get("add") === "doctor" ? "DOCTOR" : "";
  const navigate = useNavigate();
  // A new doctor's profile, opened once their login details have been shown.
  const [doctorNext, setDoctorNext] = useState<string | null>(null);
  const openDoctor = (doctorId: string) => navigate(`/hospital/doctors/${doctorId}/edit?setup=1`);
  // "Change in the Staff Directory" on the organisation chart opens that person here (?edit=).
  const editId = searchParams.get("edit");
  const [loginFor, setLoginFor] = useState<StaffRow | null>(null);
  const [cred, setCred] = useState<{ email: string; password: string; name: string } | null>(null);
  // What the person signs in with: the login ID when they have one.
  const signInAs = (c: { email: string | null; loginId?: string | null }) => c.loginId || c.email || "";

  const list = useQuery<StaffListResponse>({
    queryKey: ["staff-directory"],
    queryFn: async () => { const d = (await axiosInstance.get("/hospital/staff")).data; return { data: d.data, summary: d.summary }; },
  });
  // The chart is the whole group; the list is the branch picked - someone from
  // another branch is fetched on their own.
  const listed = editId ? list.data?.data.find((r) => r.staffId === editId) ?? null : null;
  const editOne = useQuery<StaffRow>({
    queryKey: ["staff-one", editId],
    queryFn: async () => (await axiosInstance.get(`/hospital/staff/${editId}`)).data.data,
    enabled: !!editId && !!list.data && !listed,
  });
  const editRow = listed ?? (editId ? editOne.data ?? null : null);
  const openDialog = dialog ?? (addWithLogin ? { row: null } : editRow ? { row: editRow } : null);
  const closeDialog = () => {
    setDialog(null);
    if (addWithLogin || editId) setSearchParams({}, { replace: true });
  };
  // The page filters on a few small lists; the form's full lists (~30 KB:
  // designations, wards, every person for the manager pickers) load only when
  // a form is opened.
  const filterOpts = useQuery<Pick<StaffOptions, "categories" | "branches" | "roles">>({
    queryKey: ["staff-options", "filters"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/options", { params: { part: "filters" } })).data.data,
  });
  const pageOptions = filterOpts.data;
  const opts = useQuery<StaffOptions>({
    queryKey: ["staff-options"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/options")).data.data,
    enabled: !!openDialog || !!loginFor,
  });
  const options = opts.data;
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const summary = list.data?.summary;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!category || r.staffCategoryCode === category) &&
      // Someone who works at the facility, as home or also - or at none in particular.
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
  // Paged in the browser: search, filters, sort and the count cover everyone;
  // the ?edit= deep link resolves from the full list above, not this page.
  const { shown, pager } = useClientPage(sorted, { size: 25, resetKey: [search, category, branch, attention, orderBy, order] });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["staff-directory"] });
    void qc.invalidateQueries({ queryKey: ["staff-options"] });
    void qc.invalidateQueries({ queryKey: ["ward-in-charge-options"] });
    void qc.invalidateQueries({ queryKey: ["hospital-users-list"] });
    void qc.invalidateQueries({ queryKey: USER_CAPACITY_KEY });
  };

  return (
    <>
      <Box>
        <PageHeader
          title="Staff Directory"
          subtitle="Everyone who works here - with or without a login - their designation, department, posting and who they report to."
          actions={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <UserCapacityChip />
              <Button variant="contained" startIcon={<AddRounded />} disabled={!pageOptions} onClick={() => setDialog({ row: null })} sx={{ textTransform: "none", fontWeight: 600, px: 3 }}>
                Add staff member
              </Button>
            </Box>
          }
        />
        {/* People can still be added without a login; a login past the limit is refused. */}
        <UserLimitNotice />

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
            {(pageOptions?.categories ?? []).map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
          </TextField>
          {(pageOptions?.branches.length ?? 0) > 1 && (
            <TextField select size="small" label="Facility" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">All facilities</MenuItem>
              {pageOptions!.branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
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
                  <Mascot pose="nothing-here-yet" subtitle={rows.length ? "Nobody matches these filters." : "No staff yet - add the first person."} size={120} />
                </TableCell></TableRow>
              ) : shown.map((r) => {
                const exited = r.status === "EXITED";
                return (
                  <TableRow key={r.staffId} hover sx={{ opacity: exited ? 0.6 : 1, "&:last-child td": { border: 0 } }}>
                    <TableCell sx={{ ...CELL_SX, maxWidth: 240 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: "0.875rem", fontWeight: 700 }}>{r.firstName.charAt(0)}{r.lastName.charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.name}</Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {[r.staffCategoryName, r.employment?.employeeCode].filter(Boolean).join(" · ")}
                          </Typography>
                          {(pageOptions?.branches.length ?? 0) > 1 && (r.worksAt ?? []).length > 0 && (
                            <Typography variant="caption" noWrap title={(r.worksAt ?? []).map((w) => w.branchName).join(" · ")} sx={{ color: "text.secondary", display: "block", maxWidth: 180 }}>
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
                      <Typography variant="body2">{r.employment?.designationName ?? "-"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {[r.employment?.grade != null ? `Grade ${r.employment.grade}` : null, r.employment && r.employment.employmentTypeCode !== "FULL_TIME" ? r.employment.employmentTypeName : null].filter(Boolean).join(" · ")}
                      </Typography>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2" component="div">
                        {r.primaryDepartment?.departmentName ?? "-"}
                        {r.primaryDepartment?.roleInDept === "HOD" && <Chip size="small" label="HOD" sx={{ height: 18, ml: 0.75, fontSize: "0.7rem", fontWeight: 700 }} />}
                      </Typography>
                      {r.additionalDepartments.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>also {r.additionalDepartments.map((d) => d.roleInDept === "MEMBER" ? d.departmentName : `${d.departmentName} (${ROLE_IN_DEPT_LABEL[d.roleInDept]?.toLowerCase() ?? d.roleInDept})`).join(", ")}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2">{r.posting?.label || "-"}</Typography>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Typography variant="body2">{r.adminManager?.name ?? "-"}</Typography>
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
                                  sx={{ height: 20, maxWidth: 120, fontSize: "0.72rem", fontWeight: 600,
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
                            <IconButton size="small" disabled={!pageOptions} onClick={() => setLoginFor(r)} sx={{ color: "text.secondary" }}><KeyRounded fontSize="small" /></IconButton>
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <span>
                          <IconButton size="small" disabled={!pageOptions} onClick={() => setDialog({ row: r })} sx={{ color: "text.secondary" }}><EditRounded fontSize="small" /></IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {pager}
      </Box>

      {openDialog && options && (
        <StaffDialog
          row={openDialog.row}
          options={options}
          canGiveLogin={canGiveLogins}
          startWithLogin={!dialog && addWithLogin}
          startCategory={!dialog ? addCategory : ""}
          onClose={closeDialog}
          onSaved={({ row, warnings, credentials, doctorId }) => {
            closeDialog();
            refresh();
            toast.success(openDialog.row ? "Saved" : `${row.name} added`);
            if (warnings.length) toast.warning(warnings.map((w) => w.message).join(" · "));
            if (credentials) setCred({ email: signInAs(credentials), password: credentials.temporaryPassword, name: row.name });
            if (!openDialog.row && doctorId) {
              if (credentials) setDoctorNext(doctorId); else openDoctor(doctorId);
            }
          }}
        />
      )}
      {loginFor && options && (
        <GiveLoginDialog
          row={loginFor}
          options={options}
          onClose={() => setLoginFor(null)}
          onDone={(c, doctorId) => {
            setCred({ email: signInAs(c), password: c.temporaryPassword, name: loginFor.name });
            if (doctorId) setDoctorNext(doctorId);
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
        onClose={() => {
          setCred(null);
          if (doctorNext) { setDoctorNext(null); openDoctor(doctorNext); }
        }}
      />
    </>
  );
}
