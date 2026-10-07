import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Typography,
  Grid, Autocomplete, Chip, Alert, Box, FormControlLabel, Checkbox,
} from "@mui/material";
import { ErrorRounded, WarningAmberRounded, CheckCircleRounded } from "@mui/icons-material";
import SearchableSelect, { type SelectOption } from "@/components/form/SearchableSelect";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { SEMANTIC } from "@/styles/accents";
import type { StaffRow, StaffOptions, SuggestResponse, StaffIssue } from "./staff.types";
import { GENDER_OPTIONS, ROLE_IN_DEPT_LABEL, STATUS_LABEL } from "./staff.types";

/**
 * Add or edit one staff member, filled left to right the way the workbook's
 * onboarding sheet is (17_Staff_Onboarding): the category first, and the
 * designation and department choices follow it; the grade comes with the
 * designation; managers are suggested from the reporting rules (sheet 14) and
 * checked as the sheet's validation column checks them.
 */

interface Props {
  row: StaffRow | null;
  options: StaffOptions;
  /** Only the Hospital Admin gives out logins (they carry roles). */
  canGiveLogin?: boolean;
  /** A new person, with "give them a login" already ticked (from Logins & roles). */
  startWithLogin?: boolean;
  onClose: () => void;
  onSaved: (result: { row: StaffRow; warnings: StaffIssue[]; credentials?: { email: string; temporaryPassword: string } }) => void;
}

interface Form {
  firstName: string; lastName: string; gender: string; dateOfBirth: string; phone: string; email: string; councilRegNo: string;
  staffCategoryCode: string; hospitalDesignationId: string; employmentTypeCode: string; branchId: string; employeeCode: string;
  /** The branches they also work at, beside the home facility. */
  alsoWorksAt: string[];
  joiningDate: string; status: string; exitDate: string;
  primaryDepartmentId: string; primaryRoleInDept: string; additionalDepartmentIds: string[];
  /** Their role in each additional department: they can head or visit one, not only belong. */
  additionalRoles: Record<string, string>;
  /** "" | "ward:<id>" | "unit:<id>" */
  posting: string;
  /** undefined = not chosen yet: the suggested manager stands in. "" = deliberately none. */
  adminManagerId: string | undefined;
  functionalManagerId: string | undefined;
  giveLogin: boolean; loginEmail: string; loginRoleId: string;
  /** Blank: the server makes one up and shows it once. */
  loginPassword: string;
  addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string;
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string;
}

const CONTACT_KEYS = [
  "addressLine1", "addressLine2", "city", "state", "postalCode",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
] as const;

const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");

function initialForm(row: StaffRow | null, options: StaffOptions, startWithLogin = false): Form {
  const p = row?.posting;
  return {
    firstName: row?.firstName ?? "", lastName: row?.lastName ?? "", gender: row?.gender ?? "", dateOfBirth: day(row?.dateOfBirth),
    phone: row?.phone ?? "", email: row?.email ?? "", councilRegNo: row?.councilRegNo ?? "",
    staffCategoryCode: row?.staffCategoryCode ?? "", hospitalDesignationId: row?.employment?.hospitalDesignationId ?? "",
    employmentTypeCode: row?.employment?.employmentTypeCode ?? "FULL_TIME",
    branchId: row?.employment?.branchId ?? (options.branches.length === 1 ? options.branches[0].branchId : ""),
    alsoWorksAt: (row?.worksAt ?? []).filter((w) => !w.isHome).map((w) => w.branchId),
    employeeCode: row?.employment?.employeeCode ?? "", joiningDate: day(row?.employment?.joiningDate),
    status: row?.status ?? "ACTIVE", exitDate: day(row?.employment?.exitDate),
    primaryDepartmentId: row?.primaryDepartment?.departmentId ?? "", primaryRoleInDept: row?.primaryDepartment?.roleInDept ?? "MEMBER",
    additionalDepartmentIds: row?.additionalDepartments.map((d) => d.departmentId) ?? [],
    additionalRoles: Object.fromEntries((row?.additionalDepartments ?? []).map((d) => [d.departmentId, d.roleInDept])),
    posting: p?.wardId ? `ward:${p.wardId}` : p?.serviceUnitId ? `unit:${p.serviceUnitId}` : "",
    // An existing person keeps what is on file — including no manager. Only a
    // new one starts from the suggestion.
    adminManagerId: row ? row.adminManager?.staffId ?? "" : undefined,
    functionalManagerId: row ? row.functionalManager?.staffId ?? "" : undefined,
    giveLogin: !row && startWithLogin, loginEmail: "", loginRoleId: "", loginPassword: "",
    ...Object.fromEntries(CONTACT_KEYS.map((k) => [k, row?.contact?.[k] ?? ""])) as Pick<Form, (typeof CONTACT_KEYS)[number]>,
  };
}

/**
 * The registration field's label from the category's council column
 * ("Yes (Nursing Council)", "Some (e.g. AERB for radiology)", "No"). null = the
 * category has no council, so the field is not shown.
 */
function registrationLabel(council: string | null | undefined): string | null {
  const c = (council ?? "").trim();
  if (!c || /^no\b/i.test(c)) return null;
  const named = /^yes\s*\(([^)]+)\)/i.exec(c);
  if (named) return `${named[1]} reg. no.`;
  return "Council reg. no. (if any)";
}

/** The login role a category usually gets — a starting point the admin can change. */
const DEFAULT_ROLE: Record<string, string> = { DOCTOR: "DOCTOR", NURSE: "NURSE", PHARMACIST: "PHARMACIST", TECHNICIAN: "LAB_TECH" };

export default function StaffDialog({ row, options, onClose, onSaved, canGiveLogin = true, startWithLogin = false }: Props) {
  const toast = useToast();
  const isNew = !row;
  const [f, setF] = useState<Form>(() => initialForm(row, options, startWithLogin && canGiveLogin));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const onSelect = (k: keyof Form) => (e: { target: { value: unknown } }) => set(k, String(e.target.value ?? "") as never);

  const category = options.categories.find((c) => c.code === f.staffCategoryCode);
  const designations = options.designations.filter((d) => d.staffCategoryCode === f.staffCategoryCode);
  const designation = designations.find((d) => d.id === f.hospitalDesignationId);
  const employmentType = options.employmentTypes.find((e) => e.code === f.employmentTypeCode);
  const myGrade = designation?.grade ?? null;
  const [postKind, postId] = f.posting ? f.posting.split(":") : ["", ""];
  const wardId = postKind === "ward" ? postId : "";

  const pickCategory = (code: string) => setF((prev) => ({
    ...prev, staffCategoryCode: code,
    // A designation of the old category no longer fits.
    hospitalDesignationId: options.designations.some((d) => d.id === prev.hospitalDesignationId && d.staffCategoryCode === code) ? prev.hospitalDesignationId : "",
    loginRoleId: prev.loginRoleId || (options.roles.find((r) => r.roleCode === DEFAULT_ROLE[code])?.roleId ?? ""),
  }));

  // Suggested managers (workbook 14), for whatever the form says right now.
  const suggestParams = {
    staffCategoryCode: f.staffCategoryCode, hospitalDesignationId: f.hospitalDesignationId,
    primaryDepartmentId: f.primaryDepartmentId || undefined, wardId: wardId || undefined,
    branchId: f.branchId || undefined, staffId: row?.staffId,
  };
  const { data: suggest } = useQuery<SuggestResponse>({
    queryKey: ["staff-suggest-managers", suggestParams],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/suggest-managers", { params: suggestParams })).data.data,
    enabled: Boolean(f.staffCategoryCode && f.hospitalDesignationId),
  });
  const adminId = f.adminManagerId !== undefined ? f.adminManagerId : suggest?.admin[0]?.staffId ?? "";
  const functionalId = f.functionalManagerId !== undefined ? f.functionalManagerId : suggest?.functional[0]?.staffId ?? "";

  const people = options.people;
  const gradeOf = (id: string) => people.find((p) => p.staffId === id)?.grade ?? null;
  const managerOptions = (suggested: string[], chosen: string): SelectOption[] => {
    const eligible = people.filter((p) => p.staffId !== row?.staffId && (myGrade == null || p.grade == null || p.grade < myGrade || p.staffId === chosen));
    return [...eligible]
      .sort((a, b) => Number(suggested.includes(b.staffId)) - Number(suggested.includes(a.staffId)) || (a.grade ?? 99) - (b.grade ?? 99) || a.name.localeCompare(b.name))
      .map((p) => ({
        value: p.staffId, label: p.name,
        secondary: [suggested.includes(p.staffId) ? "Suggested" : null, p.designationName, p.grade != null ? `Grade ${p.grade}` : null].filter(Boolean).join(" · "),
      }));
  };

  // The onboarding sheet's validation column, as the form changes.
  const issues = useMemo<StaffIssue[]>(() => {
    const out: StaffIssue[] = [];
    if (row && (adminId === row.staffId || functionalId === row.staffId)) return [{ level: "error", code: "SELF", message: "Can't report to themselves" }];
    if (!adminId) {
      if ((employmentType?.adminManagerRequired ?? true) && myGrade !== 1) out.push({ level: "warning", code: "NO_ADMIN_MANAGER", message: "Needs an administrative manager — you can save and add one later" });
    } else if (myGrade != null && gradeOf(adminId) != null && gradeOf(adminId)! >= myGrade) {
      out.push({ level: "error", code: "ADMIN_NOT_SENIOR", message: "The administrative manager must be more senior (a lower grade number)" });
    }
    if (functionalId && myGrade != null && gradeOf(functionalId) != null && gradeOf(functionalId)! >= myGrade) {
      out.push({ level: "error", code: "FUNCTIONAL_NOT_SENIOR", message: "The functional manager must be more senior (a lower grade number)" });
    }
    return out;
    // gradeOf reads `people`, which is part of options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, adminId, functionalId, myGrade, employmentType, people]);
  const blocked = issues.some((i) => i.level === "error");

  const deptOptions: SelectOption[] = useMemo(() => {
    const usual = (d: StaffOptions["departments"][number]) => d.usualFor.includes(f.staffCategoryCode);
    return [...options.departments]
      .sort((a, b) => Number(usual(b)) - Number(usual(a)) || a.departmentName.localeCompare(b.departmentName))
      .map((d) => ({ value: d.departmentId, label: d.departmentName, secondary: f.staffCategoryCode && usual(d) ? `Usual home for ${category?.name.toLowerCase() ?? "this category"}` : undefined }));
  }, [options.departments, f.staffCategoryCode, category]);

  const postingOptions: SelectOption[] = [
    ...options.wards.filter((w) => !f.branchId || w.branchId === f.branchId || f.alsoWorksAt.includes(w.branchId ?? ""))
      .map((w) => ({ value: `ward:${w.wardId}`, label: w.wardName ?? w.wardCode ?? "Ward", secondary: "Ward", keywords: w.wardCode ?? "" })),
    ...options.serviceUnits.filter((u) => !f.branchId || u.branchId === f.branchId || f.alsoWorksAt.includes(u.branchId ?? ""))
      .map((u) => ({ value: `unit:${u.serviceUnitId}`, label: u.name, secondary: `Unit · ${u.postingType}`, keywords: u.code })),
  ];

  const passwordShort = f.giveLogin && f.loginPassword.length > 0 && f.loginPassword.length < 6;
  const valid = f.firstName.trim() && f.staffCategoryCode && (!f.giveLogin || (f.loginEmail.trim() && f.loginRoleId && !passwordShort));

  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        firstName: f.firstName.trim(), lastName: f.lastName.trim(),
        gender: f.gender || null, dateOfBirth: f.dateOfBirth || null, phone: f.phone.trim() || null, email: f.email.trim() || null,
        councilRegNo: f.councilRegNo.trim() || null,
        staffCategoryCode: f.staffCategoryCode, hospitalDesignationId: f.hospitalDesignationId || null,
        employmentTypeCode: f.employmentTypeCode, branchId: f.branchId || null, employeeCode: f.employeeCode.trim() || null,
        // Where else they work — sent only where there is somewhere else to work.
        ...(options.branches.length > 1 ? { alsoWorksAt: f.alsoWorksAt.filter((b) => b !== f.branchId) } : {}),
        joiningDate: f.joiningDate || null, status: f.status, exitDate: f.status === "EXITED" ? f.exitDate || null : null,
        primaryDepartmentId: f.primaryDepartmentId || null, primaryRoleInDept: f.primaryRoleInDept,
        additionalDepartmentIds: f.additionalDepartmentIds.filter((id) => id !== f.primaryDepartmentId),
        additionalDepartmentRoles: Object.fromEntries(f.additionalDepartmentIds.filter((id) => id !== f.primaryDepartmentId).map((id) => [id, f.additionalRoles[id] ?? "MEMBER"])),
        postingWardId: postKind === "ward" ? postId : null, postingServiceUnitId: postKind === "unit" ? postId : null,
        adminManagerId: adminId || null, functionalManagerId: functionalId || null,
        ...Object.fromEntries(CONTACT_KEYS.map((k) => [k, f[k].trim() || null])),
        ...(isNew && f.giveLogin ? { login: { email: f.loginEmail.trim(), roleId: f.loginRoleId, ...(f.loginPassword ? { initialPassword: f.loginPassword } : {}) } } : {}),
      };
      const res = isNew
        ? await axiosInstance.post("/hospital/staff", body)
        : await axiosInstance.put(`/hospital/staff/${row!.staffId}`, body);
      onSaved({ row: res.data.data, warnings: res.data.warnings ?? [], credentials: res.data.credentials });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't save this staff member"));
    } finally {
      setSaving(false);
    }
  };

  const section = (title: string, hint?: string) => (
    <Box sx={{ pt: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      {hint && <Typography variant="caption" sx={{ color: "text.secondary" }}>{hint}</Typography>}
    </Box>
  );
  const suggestedCaption = (key: "adminManagerId" | "functionalManagerId", list: SuggestResponse["admin"] | undefined, rule: string | null | undefined) => {
    const field = f[key];
    if (!f.hospitalDesignationId) return undefined;
    // A new person: the suggestion is already filled in.
    if (field === undefined) {
      if (list?.length) return "Suggested from the reporting rules — change it if it's someone else";
      return rule && rule !== "-" ? `The rules say: ${rule} — nobody on file yet` : undefined;
    }
    // Someone on file with nobody set: offer the suggestion, don't impose it.
    if (field === "" && list?.length) {
      return (
        <Box component="span">
          Suggested: {list[0].name}{list[0].designationName ? ` (${list[0].designationName})` : ""} ·{" "}
          <Box component="button" type="button" onClick={() => set(key, list[0].staffId)}
            sx={{ border: 0, p: 0, background: "none", color: "primary.main", cursor: "pointer", font: "inherit", textDecoration: "underline" }}>
            use
          </Box>
        </Box>
      );
    }
    return undefined;
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isNew ? "Add a staff member" : `Edit ${row!.name}`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {row?.login && (
            <Alert severity="info" sx={{ py: 0 }}>
              {row.name} logs in as {row.login.email}. Name, phone, address, emergency contact, facility, home department and designation saved here update the login too.
            </Alert>
          )}

          {section("Person")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="First name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} slotProps={{ htmlInput: { maxLength: 50 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Last name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} slotProps={{ htmlInput: { maxLength: 50 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select fullWidth label="Gender" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                <MenuItem value="">—</MenuItem>
                {GENDER_OPTIONS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="date" label="Date of birth" value={f.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} slotProps={{ htmlInput: { maxLength: 15 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email" value={f.email} onChange={(e) => set("email", e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
            </Grid>
            {(registrationLabel(category?.councilRegistration) || f.councilRegNo) && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label={registrationLabel(category?.councilRegistration) ?? "Registration no."}
                  value={f.councilRegNo} onChange={(e) => set("councilRegNo", e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} />
              </Grid>
            )}
          </Grid>

          {section("Address & emergency contact")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth id="staff-address1" label="Address line 1" value={f.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} slotProps={{ htmlInput: { maxLength: 255 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth id="staff-address2" label="Address line 2" value={f.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} slotProps={{ htmlInput: { maxLength: 255 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-city" label="City" value={f.city} onChange={(e) => set("city", e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-state" label="State" value={f.state} onChange={(e) => set("state", e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-postal" label="PIN code" value={f.postalCode} onChange={(e) => set("postalCode", e.target.value)} slotProps={{ htmlInput: { maxLength: 20 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-emergency-name" label="Emergency contact" value={f.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-emergency-phone" label="Their phone" value={f.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} slotProps={{ htmlInput: { maxLength: 15 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth id="staff-emergency-relation" label="Relationship" value={f.emergencyContactRelation} onChange={(e) => set("emergencyContactRelation", e.target.value)} slotProps={{ htmlInput: { maxLength: 50 } }} />
            </Grid>
          </Grid>

          {section("Job", "Pick the staff category first — the designations follow it.")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth required label="Staff category" value={f.staffCategoryCode} onChange={(e) => pickCategory(e.target.value)}
                helperText={category?.notes ?? undefined}>
                {options.categories.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SearchableSelect label="Designation" name="hospitalDesignationId" value={f.hospitalDesignationId} onChange={onSelect("hospitalDesignationId")}
                disabled={!f.staffCategoryCode} placeholder={f.staffCategoryCode ? "Pick a designation" : "Pick a category first"} searchPlaceholder="Search designations…"
                options={designations.map((d) => ({ value: d.id, label: d.displayName, secondary: `Grade ${d.grade}` }))}
                helperText={designation ? `Grade ${designation.grade} — 1 is the most senior, 10 the most junior` : undefined} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Employment type" value={f.employmentTypeCode} onChange={(e) => set("employmentTypeCode", e.target.value)}
                helperText={employmentType ? `${employmentType.paymentModel}${employmentType.adminManagerRequired ? "" : " · no administrative manager needed"}` : undefined}>
                {options.employmentTypes.map((t) => <MenuItem key={t.code} value={t.code}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label={options.branches.length > 1 ? "Home facility" : "Facility"} value={f.branchId} onChange={(e) => set("branchId", e.target.value)}>
                {options.branches.length !== 1 && <MenuItem value="">—</MenuItem>}
                {options.branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
              </TextField>
            </Grid>
            {options.branches.length > 1 && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  select fullWidth id="staff-also-works-at" label="Also works at" value={f.alsoWorksAt.filter((b) => b !== f.branchId)}
                  onChange={(e) => set("alsoWorksAt", typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as unknown as string[]))}
                  helperText={row?.login ? "Their login can switch to these branches too." : "Other branches they work shifts at."}
                  SelectProps={{
                    multiple: true, displayEmpty: true,
                    renderValue: (v) => (v as string[]).map((id) => options.branches.find((b) => b.branchId === id)?.branchName ?? "Branch").join(", ") || "Only the home facility",
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                >
                  {options.branches.filter((b) => b.branchId !== f.branchId).map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Employee code" value={f.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} slotProps={{ htmlInput: { maxLength: 20 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="date" label="Joining date" value={f.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select fullWidth label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}>
                {options.statuses.map((s) => <MenuItem key={s.code} value={s.code}>{STATUS_LABEL[s.code] ?? s.code}</MenuItem>)}
              </TextField>
            </Grid>
            {f.status === "EXITED" && (
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth type="date" label="Left on" value={f.exitDate} onChange={(e) => set("exitDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="Blank = today" />
              </Grid>
            )}
          </Grid>

          {section("Departments", "The home department is for HR and payroll; additional ones are where they also work.")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <SearchableSelect label="Home department" name="primaryDepartmentId" value={f.primaryDepartmentId} onChange={onSelect("primaryDepartmentId")}
                emptyOption={{ value: "", label: "None yet" }} searchPlaceholder="Search departments…" options={deptOptions}
                helperText="Departments you have switched on — switch more on under Departments." />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select fullWidth label="Role in department" value={f.primaryRoleInDept} disabled={!f.primaryDepartmentId} onChange={(e) => set("primaryRoleInDept", e.target.value)}
                helperText={f.primaryRoleInDept === "HOD" ? "Replaces the department's current head" : undefined}>
                {options.rolesInDept.map((r) => <MenuItem key={r.code} value={r.code}>{ROLE_IN_DEPT_LABEL[r.code] ?? r.code}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete multiple options={options.departments.filter((d) => d.departmentId !== f.primaryDepartmentId).map((d) => d.departmentId)}
                value={f.additionalDepartmentIds.filter((id) => id !== f.primaryDepartmentId)}
                onChange={(_, v) => set("additionalDepartmentIds", v)}
                getOptionLabel={(id) => options.departments.find((d) => d.departmentId === id)?.departmentName ?? ""}
                renderTags={(value: readonly string[], getTagProps) => value.map((id, index) => (
                  <Chip size="small" label={options.departments.find((d) => d.departmentId === id)?.departmentName ?? ""} {...getTagProps({ index })} key={id} />
                ))}
                renderInput={(params) => <TextField {...params} label="Additional departments" placeholder={f.additionalDepartmentIds.length ? "" : "None"} />} />
            </Grid>
            {/* Their role in each one: someone can head a second department, or visit one. */}
            {f.additionalDepartmentIds.filter((id) => id !== f.primaryDepartmentId).map((id) => (
              <Grid key={id} size={{ xs: 12, sm: 6 }}>
                <TextField select fullWidth size="small" id={`staff-extra-role-${id}`}
                  label={`Role in ${options.departments.find((d) => d.departmentId === id)?.departmentName ?? "department"}`}
                  value={f.additionalRoles[id] ?? "MEMBER"}
                  onChange={(e) => set("additionalRoles", { ...f.additionalRoles, [id]: e.target.value })}
                  helperText={(f.additionalRoles[id] ?? "MEMBER") === "HOD" ? "Replaces that department's current head" : undefined}>
                  {options.rolesInDept.map((r) => <MenuItem key={r.code} value={r.code}>{ROLE_IN_DEPT_LABEL[r.code] ?? r.code}</MenuItem>)}
                </TextField>
              </Grid>
            ))}
          </Grid>

          {section("Posting", "Where they work day to day — a ward or a unit. Nurses rotate; the old posting is kept as history.")}
          <SearchableSelect label="Ward or unit" name="posting" value={f.posting} onChange={onSelect("posting")}
            emptyOption={{ value: "", label: "Not posted" }} searchPlaceholder="Search wards and units…" options={postingOptions} />

          {section("Reports to", suggest?.rule ? `Rule for ${suggest.rule.designationGroup}: HR line to ${suggest.rule.adminReportsTo}${suggest.rule.functionalReportsTo && suggest.rule.functionalReportsTo !== "-" ? `, day to day to ${suggest.rule.functionalReportsTo}` : ""}.` : "Their administrative (HR) manager, and a functional (day-to-day) one if different.")}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SearchableSelect label="Administrative manager" name="adminManagerId" value={adminId} onChange={(e) => set("adminManagerId", String(e.target.value ?? ""))}
                emptyOption={{ value: "", label: "None" }} searchPlaceholder="Search staff…"
                options={managerOptions(suggest?.admin.map((p) => p.staffId) ?? [], adminId)}
                helperText={suggestedCaption("adminManagerId", suggest?.admin, suggest?.rule?.adminReportsTo)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SearchableSelect label="Functional manager" name="functionalManagerId" value={functionalId} onChange={(e) => set("functionalManagerId", String(e.target.value ?? ""))}
                emptyOption={{ value: "", label: "None" }} searchPlaceholder="Search staff…"
                options={managerOptions(suggest?.functional.map((p) => p.staffId) ?? [], functionalId)}
                helperText={suggestedCaption("functionalManagerId", suggest?.functional, suggest?.rule?.functionalReportsTo)} />
            </Grid>
          </Grid>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {issues.length === 0 ? (
              <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: SEMANTIC.success }}>
                <CheckCircleRounded fontSize="small" /> {myGrade === 1 ? "OK — top of the hierarchy" : "OK"}
              </Typography>
            ) : issues.map((i) => (
              <Typography key={i.code} variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: i.level === "error" ? SEMANTIC.danger : SEMANTIC.warningDark }}>
                {i.level === "error" ? <ErrorRounded fontSize="small" /> : <WarningAmberRounded fontSize="small" />} {i.message}
              </Typography>
            ))}
          </Box>

          {isNew && canGiveLogin && (<>
            {section("Login")}
            <FormControlLabel control={<Checkbox checked={f.giveLogin} onChange={(e) => setF((prev) => ({ ...prev, giveLogin: e.target.checked, loginEmail: prev.loginEmail || prev.email.trim() }))} />}
              label="Give them a login now" />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: -1.5 }}>
              Not everyone needs one — housekeeping, drivers and visiting staff are often on the list without logging in. You can add one later.
            </Typography>
            {f.giveLogin && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField fullWidth required label="Login email" value={f.loginEmail} onChange={(e) => set("loginEmail", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField select fullWidth required label="Role" value={f.loginRoleId} onChange={(e) => set("loginRoleId", e.target.value)}
                    helperText="What they can open. Separate from the designation. More roles can be added under Logins & roles.">
                    {options.roles.map((r) => <MenuItem key={r.roleId} value={r.roleId}>{r.roleName}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField fullWidth id="staff-login-password" type="password" autoComplete="new-password" label="Starting password (optional)"
                    value={f.loginPassword} onChange={(e) => set("loginPassword", e.target.value)} error={passwordShort}
                    helperText={passwordShort ? "At least 6 characters" : "Leave blank and one is made up for you, shown once."} />
                </Grid>
              </Grid>
            )}
          </>)}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!valid || blocked || saving}
          startIcon={saving ? <HeartbeatLoader size={20} /> : undefined} sx={{ textTransform: "none", fontWeight: 600 }}>
          {saving ? "Saving…" : isNew ? "Add staff member" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
