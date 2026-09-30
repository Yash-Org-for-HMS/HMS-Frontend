import { useState, useEffect } from "react";
import { FORM_PAGE_WIDTH } from "@/components/layout/pageWidth";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  Stack,
  Autocomplete
} from "@mui/material";
import { SaveRounded, PersonRounded, LocalHospitalRounded, AccountTreeRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import FormSkeleton from "@/components/skeletons/FormSkeleton";
import CredentialDialog from "@/components/CredentialDialog";
import { validate, hasErrors, required, isEmail, isPhone, isNonNegativeNumber, isPositiveNumber, type Errors } from "@/utils/validation";

export default function DoctorForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [tabIndex, setTabIndex] = useState(0);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  // The doctor's fee at a branch, where it differs from their own. "" = their own.
  const [branchFees, setBranchFees] = useState<Record<string, { consultationFee: string; ipdVisitCharge: string }>>({});
  // Other departments the doctor works in — what "specialization" used to say,
  // kept on the doctor's staff record. They can be booked under these too.
  const [additionalDepartmentIds, setAdditionalDepartmentIds] = useState<string[]>([]);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; temporaryPassword: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    departmentId: "",
    licenseNumber: "",
    consultationFee: "",
    ipdVisitCharge: "",
    qualification: "",
    experienceYears: "",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  // Reference dropdowns (departments / branches).
  const { data: refData, isLoading: refLoading, isError: refIsError, error: refError, refetch: refetchRefs } = useQuery({
    queryKey: ["doctor-form-refs"],
    queryFn: async () => {
      const [deptRes, dropdownRes] = await Promise.all([
        // Every department, not the endpoint's first page: since the standard list
        // was copied in, a hospital has 100+ departments (most switched off), and
        // the first 50 by date were switched-off copies — the hospital's real
        // departments never reached this dropdown.
        axiosInstance.get("/hospital/departments", { params: { limit: 1000 } }),
        axiosInstance.get("/hospital/users/dropdowns").catch(() => ({ data: { data: { branches: [] } } })),
      ]);
      return {
        departments: deptRes.data.data,
        branches: dropdownRes.data?.data?.branches ?? [],
      };
    },
  });
  const allDepartments: any[] = refData?.departments ?? [];
  const branches: any[] = refData?.branches ?? [];

  const { data: docData, isLoading: docLoading, isError: docIsError, error: docError, refetch: refetchDoc } = useQuery({
    queryKey: ["doctor", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });

  // Seed the form with the existing doctor when editing.
  useEffect(() => {
    if (!docData) return;
    const d = docData;
    setFormData({
      firstName: d.user?.firstName || "",
      lastName: d.user?.lastName || "",
      email: d.user?.email || "",
      phone: d.user?.phone || "",
      password: "",
      departmentId: d.departmentId || "",
      licenseNumber: d.licenseNumber || "",
      consultationFee: d.consultationFee || "",
      ipdVisitCharge: d.ipdVisitCharge || "",
      qualification: d.qualification || "",
      experienceYears: d.experienceYears || "",
    });
    setBranchIds(Array.isArray(d.branchIds) ? d.branchIds : []);
    const fees: Record<string, { consultationFee: string; ipdVisitCharge: string }> = {};
    for (const [b, f] of Object.entries((d.branchFees ?? {}) as Record<string, { consultationFee: number | null; ipdVisitCharge: number | null }>)) {
      fees[b] = { consultationFee: f.consultationFee == null ? "" : String(f.consultationFee), ipdVisitCharge: f.ipdVisitCharge == null ? "" : String(f.ipdVisitCharge) };
    }
    setBranchFees(fees);
    setAdditionalDepartmentIds(Array.isArray(d.additionalDepartmentIds) ? d.additionalDepartmentIds : []);
  }, [docData]);

  // Departments in use — plus any this doctor already has, so an existing choice
  // never shows blank even if that department has since been switched off.
  const departments = allDepartments
    .filter((d) => d.status === "active" || d.departmentId === formData.departmentId || additionalDepartmentIds.includes(d.departmentId))
    .sort((a, b) => String(a.departmentName).localeCompare(String(b.departmentName)));

  const initialLoad = refLoading || (!!id && docLoading);
  const isError = refIsError || docIsError;
  const error = refError || docError;
  const refetch = () => { refetchRefs(); if (id) refetchDoc(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name as keyof typeof formData] ? { ...prev, [name]: undefined } : prev));
  };

  // Personal fields live on tab 0, professional on tab 1 — jump to the first
  // tab that has an error so the highlighted field is actually visible.
  const TAB0_FIELDS = ["firstName", "lastName", "email", "phone"] as const;

  const feesBody = () => Object.fromEntries(branchIds.map((b) => {
    const f = branchFees[b];
    return [b, { consultationFee: f?.consultationFee ? Number(f.consultationFee) : null, ipdVisitCharge: f?.ipdVisitCharge ? Number(f.ipdVisitCharge) : null }];
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate(formData, {
      firstName: [required("First name")],
      lastName: [required("Last name")],
      email: [required("Email"), isEmail],
      phone: [isPhone],
      licenseNumber: [required("License number")],
      consultationFee: [required("Consultation fee"), isPositiveNumber],
      ipdVisitCharge: [required("IPD ward-visit charge"), isPositiveNumber],
      experienceYears: [isNonNegativeNumber],
      // A doctor MUST belong to a department — booking filters the doctor list by
      // department, so a departmentless doctor is invisible there (the empty-
      // dropdown bug). The field showed a required asterisk but was never enforced.
      departmentId: [required("Department")],
    });
    if (hasErrors(found)) {
      setErrors(found);
      const onTab0 = TAB0_FIELDS.some((f) => found[f]);
      setTabIndex(onTab0 ? 0 : 1);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    for (const b of branchIds) {
      const f = branchFees[b];
      for (const v of [f?.consultationFee, f?.ipdVisitCharge]) {
        if (v && !(Number(v) >= 0)) { toast.error("A branch fee must be zero or a positive amount."); setTabIndex(2); return; }
      }
    }
    setLoading(true);
    const body = { ...formData, additionalDepartmentIds: additionalDepartmentIds.filter((x) => x !== formData.departmentId) };
    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/doctors/${id}`, body);
        // Persist branch availability (which branches this doctor can be booked at).
        await axiosInstance.put(`/hospital/doctors/${id}/branches`, { branchIds, fees: feesBody() });
        navigate("/hospital/doctors");
      } else {
        // Create the login + clinical profile in one step; show the one-time credentials.
        const res = await axiosInstance.post(`/hospital/doctors`, body);
        const newDoctorId = res.data?.data?.doctorId;
        if (newDoctorId && branchIds.length) {
          await axiosInstance.put(`/hospital/doctors/${newDoctorId}/branches`, { branchIds, fees: feesBody() });
        }
        setCreatedCreds({
          email: formData.email,
          temporaryPassword: res.data?.credentials?.temporaryPassword || "",
          name: `${formData.firstName} ${formData.lastName}`.trim(),
        });
        setLoading(false);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "An error occurred"));
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <FormSkeleton />
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load doctor form" message={apiErrorText(error)} onRetry={refetch} />;
  }

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "text.secondary" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "text.primary",
        "& fieldset": { borderColor: "divider" },
        "&:hover fieldset": { borderColor: "divider" },
        "&.Mui-focused fieldset": { borderColor: BRAND.action },
        "& .MuiSvgIcon-root": { color: "text.secondary" }
      },
    },
  };

  return (
    <Box sx={{ maxWidth: FORM_PAGE_WIDTH, mx: "auto", width: "100%" }}>
      <PageHeader
        title={isEditing ? "Edit Doctor Profile" : "Add Doctor"}
        subtitle="Configure personal details and medical qualifications."
        actions={
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/doctors")}
            sx={{ color: "text.secondary", borderColor: "divider" }}
          >
            Cancel
          </Button>
        }
      />
<Paper sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          sx={{
            borderBottom: "1px solid", borderColor: "divider",
            "& .MuiTab-root": { color: "text.secondary", textTransform: "none", fontWeight: 600, fontSize: "1rem", minHeight: 64 },
            "& .Mui-selected": { color: BRAND.action },
            "& .MuiTabs-indicator": { backgroundColor: BRAND.action }
          }}
        >
          <Tab icon={<PersonRounded />} iconPosition="start" label="Personal Details" />
          <Tab icon={<LocalHospitalRounded />} iconPosition="start" label="Professional Details" />
          <Tab icon={<AccountTreeRounded />} iconPosition="start" label="Branch Availability" />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
          {tabIndex === 0 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isEditing}
                  error={!!errors.email}
                  helperText={errors.email || (isEditing ? "Login email can't be changed here" : "Used as the doctor's login")}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  error={!!errors.phone}
                  helperText={errors.phone}
                  {...textFieldProps}
                 inputProps={{ maxLength: 20 }}
              />
              </Grid>
            </Grid>
          )}

          {tabIndex === 1 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Department"
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  required
                  error={!!errors.departmentId}
                  helperText={errors.departmentId}
                  {...textFieldProps}
                >
                  {departments.map((d) => (
                    <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  multiple
                  options={departments.filter((d) => d.departmentId !== formData.departmentId).map((d) => d.departmentId as string)}
                  value={additionalDepartmentIds.filter((x) => x !== formData.departmentId)}
                  onChange={(_e, v) => setAdditionalDepartmentIds(v)}
                  getOptionLabel={(deptId) => departments.find((d) => d.departmentId === deptId)?.departmentName ?? ""}
                  renderTags={(value: readonly string[], getTagProps) =>
                    value.map((deptId, index) => (
                      <Chip size="small" label={departments.find((d) => d.departmentId === deptId)?.departmentName ?? ""} {...getTagProps({ index })} key={deptId} />
                    ))}
                  renderInput={(params) => (
                    <TextField {...params} {...textFieldProps} label="Also works in" placeholder={additionalDepartmentIds.length ? "" : "None"}
                      helperText="Other departments they see patients in — they can be booked there too." />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Registration / License Number"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  required
                  error={!!errors.licenseNumber}
                  helperText={errors.licenseNumber}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="OPD Consultation Fee (₹)"
                  name="consultationFee"
                  type="number"
                  value={formData.consultationFee}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 1 }}
                  error={!!errors.consultationFee}
                  helperText={errors.consultationFee || "Charged per OPD consultation. Must be above 0."}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="IPD Routine Visit Charge (₹)"
                  name="ipdVisitCharge"
                  type="number"
                  value={formData.ipdVisitCharge}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 1 }}
                  error={!!errors.ipdVisitCharge}
                  helperText={errors.ipdVisitCharge || "Billed per logged ward visit during an admission. Must be above 0."}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Qualifications (e.g. MBBS, MD)"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Experience (Years)"
                  name="experienceYears"
                  type="number"
                  value={formData.experienceYears}
                  onChange={handleChange}
                  error={!!errors.experienceYears}
                  helperText={errors.experienceYears}
                  {...textFieldProps}
                />
              </Grid>
            </Grid>
          )}

          {tabIndex === 2 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                  Select the branches where this doctor is available. Appointments can only be
                  booked for this doctor at the selected branches. Leave empty to allow all branches.
                </Typography>
                <TextField
                  select
                  label="Available at branches"
                  value={branchIds}
                  onChange={(e) => {
                    const v = e.target.value as unknown as string[] | string;
                    setBranchIds(typeof v === "string" ? v.split(",") : v);
                  }}
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {(selected as string[]).map((value) => {
                          const b = branches.find((x) => x.branchId === value);
                          return <Chip key={value} label={b?.branchName || value} size="small" />;
                        })}
                      </Box>
                    ),
                  }}
                  {...textFieldProps}
                >
                  {branches.map((b) => (
                    <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              {/* A doctor may charge differently at each branch. Empty = their own fee. */}
              {branchIds.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Fees at each branch</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                    Leave empty to charge the doctor's own fee (₹{formData.consultationFee || 0} consultation, ₹{formData.ipdVisitCharge || 0} ward visit).
                  </Typography>
                  <Stack spacing={1.5}>
                    {branchIds.map((b) => {
                      const name = branches.find((x) => x.branchId === b)?.branchName || "Branch";
                      const f = branchFees[b] ?? { consultationFee: "", ipdVisitCharge: "" };
                      const set = (k: "consultationFee" | "ipdVisitCharge", v: string) =>
                        setBranchFees((prev) => ({ ...prev, [b]: { ...f, [k]: v.replace(/[^\d.]/g, "") } }));
                      return (
                        <Box key={b} sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                          <Typography sx={{ width: 180, fontWeight: 600 }} noWrap>{name}</Typography>
                          <TextField id={`fee-consult-${b}`} size="small" label="Consultation ₹" value={f.consultationFee}
                            placeholder={String(formData.consultationFee || "")} InputLabelProps={{ shrink: true }}
                            onChange={(e) => set("consultationFee", e.target.value)} sx={{ width: 170 }} />
                          <TextField id={`fee-visit-${b}`} size="small" label="Ward visit ₹" value={f.ipdVisitCharge}
                            placeholder={String(formData.ipdVisitCharge || "")} InputLabelProps={{ shrink: true }}
                            onChange={(e) => set("ipdVisitCharge", e.target.value)} sx={{ width: 170 }} />
                        </Box>
                      );
                    })}
                  </Stack>
                </Grid>
              )}
            </Grid>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
            {tabIndex < 2 ? (
              <Button
                variant="contained"
                onClick={() => setTabIndex(tabIndex + 1)}
                sx={{ py: 1.5, px: 4 }}
              >
                {tabIndex === 0 ? "Next: Professional Details" : "Next: Branch Availability"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={<SaveRounded />}
                sx={{ bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark }, py: 1.5, px: 4 }}
              >
                {loading ? "Saving..." : "Save Doctor"}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <CredentialDialog
        open={!!createdCreds}
        title="Doctor Account Created!"
        name={createdCreds?.name}
        email={createdCreds?.email}
        password={createdCreds?.temporaryPassword || ""}
        onClose={() => { setCreatedCreds(null); navigate("/hospital/doctors"); }}
      />
    </Box>
  );
}
