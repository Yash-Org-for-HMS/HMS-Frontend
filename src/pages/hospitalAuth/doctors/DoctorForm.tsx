import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  MenuItem,
  Tabs,
  Tab,
  Chip
} from "@mui/material";
import { SaveRounded, PersonRounded, LocalHospitalRounded, AccountTreeRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";

export default function DoctorForm() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [tabIndex, setTabIndex] = useState(0);
  const [branchIds, setBranchIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    departmentId: "",
    specializationId: "",
    licenseNumber: "",
    consultationFee: "",
    qualification: "",
    experienceYears: "",
  });

  // Reference dropdowns (departments / specializations / branches).
  const { data: refData, isLoading: refLoading, isError: refIsError, error: refError, refetch: refetchRefs } = useQuery({
    queryKey: ["doctor-form-refs"],
    queryFn: async () => {
      const [deptRes, specRes, dropdownRes] = await Promise.all([
        axiosInstance.get("/hospital/departments"),
        axiosInstance.get("/hospital/doctors/specializations").catch(() => ({ data: { data: [] } })),
        axiosInstance.get("/hospital/users/dropdowns").catch(() => ({ data: { data: { branches: [] } } })),
      ]);
      return {
        departments: deptRes.data.data,
        specializations: specRes.data.data,
        branches: dropdownRes.data?.data?.branches ?? [],
      };
    },
  });
  const departments: any[] = refData?.departments ?? [];
  const specializations: any[] = refData?.specializations ?? [];
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
      specializationId: d.specializationId || "",
      licenseNumber: d.licenseNumber || "",
      consultationFee: d.consultationFee || "",
      qualification: d.qualification || "",
      experienceYears: d.experienceYears || "",
    });
    setBranchIds(Array.isArray(d.branchIds) ? d.branchIds : []);
  }, [docData]);

  const initialLoad = refLoading || (!!id && docLoading);
  const isError = refIsError || docIsError;
  const error = refError || docError;
  const refetch = () => { refetchRefs(); if (id) refetchDoc(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!id) throw new Error("Invalid Doctor ID");
      await axiosInstance.put(`/hospital/doctors/${id}`, formData);
      // Persist branch availability (which branches this doctor can be booked at).
      await axiosInstance.put(`/hospital/doctors/${id}/branches`, { branchIds });
      navigate("/hospital/doctors");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred");
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load doctor form" message={(error as any)?.response?.data?.message} onRetry={refetch} />;
  }

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "text.secondary" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "text.primary",
        "& fieldset": { borderColor: "divider" },
        "&:hover fieldset": { borderColor: "divider" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "text.secondary" }
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHeader
        title="Edit Doctor Profile"
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
            "& .Mui-selected": { color: "#6366f1" },
            "& .MuiTabs-indicator": { backgroundColor: "#6366f1" }
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
                  disabled={true}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  {...textFieldProps}
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
                  {...textFieldProps}
                >
                  {departments.map((d) => (
                    <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Specialization"
                  name="specializationId"
                  value={formData.specializationId}
                  onChange={handleChange}
                  {...textFieldProps}
                >
                  <MenuItem value="">None / General</MenuItem>
                  {specializations.map((s) => (
                    <MenuItem key={s.specializationId} value={s.specializationId}>{s.specializationName}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Registration / License Number"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Consultation Fee ($)"
                  name="consultationFee"
                  type="number"
                  value={formData.consultationFee}
                  onChange={handleChange}
                  required
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
            </Grid>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
            {tabIndex < 2 ? (
              <Button
                variant="contained"
                onClick={() => setTabIndex(tabIndex + 1)}
                sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1.5, px: 4 }}
              >
                {tabIndex === 0 ? "Next: Professional Details" : "Next: Branch Availability"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={<SaveRounded />}
                sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, py: 1.5, px: 4 }}
              >
                {loading ? "Saving..." : "Save Doctor"}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
