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
  Tab
} from "@mui/material";
import { SaveRounded, PersonRounded, LocalHospitalRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

export default function DoctorForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [tabIndex, setTabIndex] = useState(0);

  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deptRes, specRes] = await Promise.all([
          axiosInstance.get("/hospital/departments"),
          axiosInstance.get("/hospital/doctors/specializations").catch(() => ({ data: { data: [] } }))
        ]);
        setDepartments(deptRes.data.data);
        setSpecializations(specRes.data.data);

        if (isEditing) {
          const docRes = await axiosInstance.get(`/hospital/doctors/${id}`);
          const d = docRes.data.data;
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
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setInitialLoad(false);
      }
    };
    loadData();
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/doctors/${id}`, formData);
      } else {
        await axiosInstance.post("/hospital/doctors", formData);
      }
      navigate("/hospital/doctors");
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred");
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

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "#94a3b8" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "#f1f5f9",
        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "#94a3b8" }
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            {isEditing ? "Edit Doctor Profile" : "Add New Doctor"}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Configure personal details and medical qualifications.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/doctors")}
          sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.2)" }}
        >
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          sx={{
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            "& .MuiTab-root": { color: "#94a3b8", textTransform: "none", fontWeight: 600, fontSize: "1rem", minHeight: 64 },
            "& .Mui-selected": { color: "#6366f1" },
            "& .MuiTabs-indicator": { backgroundColor: "#6366f1" }
          }}
        >
          <Tab icon={<PersonRounded />} iconPosition="start" label="Personal Details" />
          <Tab icon={<LocalHospitalRounded />} iconPosition="start" label="Professional Details" />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
          {tabIndex === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isEditing}
                  {...textFieldProps}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              {!isEditing && (
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Temporary Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    {...textFieldProps}
                  />
                </Grid>
              )}
            </Grid>
          )}

          {tabIndex === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={6}>
                <TextField
                  label="Registration / License Number"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={6}>
                <TextField
                  label="Qualifications (e.g. MBBS, MD)"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid item xs={12} md={6}>
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

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
            {tabIndex === 0 ? (
              <Button
                variant="contained"
                onClick={() => setTabIndex(1)}
                sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1.5, px: 4 }}
              >
                Next: Professional Details
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
