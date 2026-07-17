import { useState, useEffect } from "react";
import { getApiErrorMessage, apiErrorText } from "../../utils/apiError";
import { useQuery } from "@tanstack/react-query";
import GeoAddressPicker from "../../components/GeoAddressPicker";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Divider,
  InputAdornment,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  SaveRounded,
  PersonRounded,
  LocalHospitalRounded,
  HomeRounded,
  ContactPhoneRounded,
  LockOpenRounded,
  ArrowBackRounded,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../providers/ToastContext";
import PageHeader from "../../components/layout/PageHeader";
import { validate, hasErrors, required, isEmail, isPhone, type Errors } from "../../utils/validation";

interface Gender {
  genderId: number;
  genderLabel: string;
  genderCode: string;
}
interface BloodGroup {
  bloodGroupId: number;
  groupLabel: string;
  groupCode: string;
}
interface InternalDoctor {
  doctorId: string;
  name: string;
}

const SECTIONS = [
  { id: "personal", label: "Personal Info", icon: <PersonRounded fontSize="small" /> },
  { id: "medical", label: "Medical", icon: <LocalHospitalRounded fontSize="small" /> },
  { id: "address", label: "Address", icon: <HomeRounded fontSize="small" /> },
  { id: "emergency", label: "Emergency Contact", icon: <ContactPhoneRounded fontSize="small" /> },
];

export interface PatientFormProps {
  isModal?: boolean;
  onSuccess?: (patientId: string, mrn: string) => void;
  onCancel?: () => void;
}

export default function PatientForm({ isModal = false, onSuccess, onCancel }: PatientFormProps = {}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const { data: dd, isLoading: ddLoading, isError: ddIsError, error: ddError, refetch: refetchDd } = useQuery({
    queryKey: ["patient-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/patients/dropdowns")).data.data,
  });
  const genders: Gender[] = dd?.genders ?? [];
  const bloodGroups: BloodGroup[] = dd?.bloodGroups ?? [];
  const internalDoctors: InternalDoctor[] = dd?.internalDoctors ?? [];

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    genderId: "",
    bloodGroupId: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    district: "",
    state: "",
    postalCode: "",
    allergies: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    referredByType: "",
    referredByInternalDoctorId: "",
    referredByExternalName: "",
    referredByExternalSpecialty: "",
    referredByExternalClinic: "",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  const { data: patientData, isLoading: patientLoading, isError: patientIsError, error: patientError, refetch: refetchPatient } = useQuery({
    queryKey: ["patient-edit", id],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${id}`)).data.data,
    enabled: isEditing && !!id,
  });

  // Seed the form with the existing patient when editing.
  useEffect(() => {
    if (!patientData) return;
    const p = patientData;
    setFormData({
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
      genderId: String(p.genderId || ""),
      bloodGroupId: String(p.bloodGroupId || ""),
      phone: p.phone || "",
      email: p.email || "",
      addressLine1: p.addressLine1 || "",
      addressLine2: p.addressLine2 || "",
      city: p.city || "",
      district: p.district || "",
      state: p.state || "",
      postalCode: p.postalCode || "",
      allergies: p.allergies || "",
      emergencyContactName: p.emergencyContactName || "",
      emergencyContactPhone: p.emergencyContactPhone || "",
      emergencyContactRelation: p.emergencyContactRelation || "",
      referredByType: p.referredByType || "",
      referredByInternalDoctorId: p.referredByInternalDoctorId || "",
      referredByExternalName: p.referredByExternalName || "",
      referredByExternalSpecialty: p.referredByExternalSpecialty || "",
      referredByExternalClinic: p.referredByExternalClinic || "",
    });
  }, [patientData]);

  const initialLoad = ddLoading || (isEditing && patientLoading);
  const isError = ddIsError || patientIsError;
  const error = ddError || patientError;
  const refetch = () => { refetchDd(); if (isEditing) refetchPatient(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[name as keyof typeof formData] ? { ...prev, [name]: undefined } : prev));
  };

  // Client-side validation mirrors the backend patients validator: required
  // demographics + phone/email format, so a bad request never leaves the browser.
  const validateForm = () =>
    validate(formData, {
      firstName: [required("First name")],
      dateOfBirth: [required("Date of birth")],
      genderId: [required("Gender")],
      bloodGroupId: [required("Blood group")],
      phone: [required("Phone number"), isPhone],
      email: [isEmail],
      emergencyContactPhone: [isPhone],
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validateForm();
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && id) {
        await axiosInstance.put(`/reception/patients/${id}`, formData);
        toast.success("Patient updated successfully.");
        if (isModal && onSuccess) {
          setTimeout(() => onSuccess(id, ""), 1000);
        } else {
          setTimeout(() => navigate(`/reception/patients/${id}`), 1200);
        }
      } else {
        const res = await axiosInstance.post("/reception/patients", formData);
        const patientId = res.data.data.patientId;
        const mrn = res.data.data.uhidNumber;
        toast.success(`Patient registered! MRN: ${mrn}`);
        if (isModal && onSuccess) {
          setTimeout(() => onSuccess(patientId, mrn), 1000);
        } else {
          setTimeout(() => navigate(`/reception/patients/${patientId}`), 1400);
        }
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
    return <ErrorState title="Couldn't load patient form" message={apiErrorText(error)} onRetry={refetch} />;
  }

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      color: "text.primary",
      bgcolor: "action.hover",
      "& fieldset": { borderColor: "rgba(6, 182, 212, 0.15)" },
      "&:hover fieldset": { borderColor: "rgba(6, 182, 212, 0.3)" },
      "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
    },
    "& .MuiInputLabel-root": { color: "text.secondary" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#06b6d4" },
    "& .MuiSvgIcon-root": { color: "text.secondary" },
  };

  const sectionContent: Record<string, React.ReactNode> = {
    personal: (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth label="First Name" name="firstName" value={formData.firstName}
            onChange={handleChange} required sx={fieldSx}
            error={!!errors.firstName} helperText={errors.firstName}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth label="Last Name" name="lastName" value={formData.lastName}
            onChange={handleChange} sx={fieldSx}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth label="Date of Birth" name="dateOfBirth" type="date"
            value={formData.dateOfBirth} onChange={handleChange} required sx={fieldSx}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!errors.dateOfBirth} helperText={errors.dateOfBirth}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select fullWidth label="Gender" name="genderId" value={formData.genderId}
            onChange={handleChange} required sx={fieldSx}
            error={!!errors.genderId} helperText={errors.genderId}
          >
            {genders.map((g) => (
              <MenuItem key={g.genderId} value={String(g.genderId)}>{g.genderLabel}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth label="Phone Number" name="phone" value={formData.phone}
            onChange={handleChange} required sx={fieldSx}
            error={!!errors.phone} helperText={errors.phone}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Typography sx={{ color: "text.secondary", fontSize: "0.875rem" }}>+91</Typography></InputAdornment>,
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth label="Email Address (Optional)" name="email" type="email" value={formData.email}
            onChange={handleChange} disabled={isEditing} sx={fieldSx}
            error={!!errors.email}
            helperText={errors.email || (isEditing ? "Email cannot be changed" : undefined)}
            FormHelperTextProps={{ style: { color: "text.secondary" } }}
          />
        </Grid>
      </Grid>
    ),

    medical: (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select fullWidth label="Blood Group" name="bloodGroupId" value={formData.bloodGroupId}
            onChange={handleChange} required sx={fieldSx}
          >
            {bloodGroups.map((b) => (
              <MenuItem key={b.bloodGroupId} value={String(b.bloodGroupId)}>
                {b.groupLabel} ({b.groupCode})
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, mb: 1 }}>
            Referred By (Optional)
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={formData.referredByType || null}
            onChange={(_, val) => setFormData((prev) => ({
              ...prev,
              referredByType: val || "",
              // Clear the other mode's inputs when switching.
              ...(val === "INTERNAL" ? { referredByExternalName: "", referredByExternalSpecialty: "", referredByExternalClinic: "" } : {}),
              ...(val === "EXTERNAL" ? { referredByInternalDoctorId: "" } : {}),
              ...(!val ? { referredByInternalDoctorId: "", referredByExternalName: "", referredByExternalSpecialty: "", referredByExternalClinic: "" } : {}),
            }))}
            sx={{
              mb: formData.referredByType ? 2 : 0,
              "& .MuiToggleButton-root": { textTransform: "none", px: 2, borderColor: "divider" },
              "& .Mui-selected": { bgcolor: "rgba(6,182,212,0.12) !important", color: "#0891b2 !important" },
            }}
          >
            <ToggleButton value="INTERNAL">Internal Doctor</ToggleButton>
            <ToggleButton value="EXTERNAL">External / Outside</ToggleButton>
          </ToggleButtonGroup>

          {formData.referredByType === "INTERNAL" && (
            <TextField
              select fullWidth label="Select Doctor" name="referredByInternalDoctorId"
              value={formData.referredByInternalDoctorId} onChange={handleChange} sx={fieldSx}
              helperText="One of your hospital's doctors who referred this patient."
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {internalDoctors.map((d) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>{d.name}</MenuItem>
              ))}
            </TextField>
          )}

          {formData.referredByType === "EXTERNAL" && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth label="Doctor Name" name="referredByExternalName"
                  value={formData.referredByExternalName} onChange={handleChange} sx={fieldSx}
                  placeholder="e.g. Dr. Yash Patel"
                  helperText="Name of the outside doctor who referred this patient."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth label="Specialty (Optional)" name="referredByExternalSpecialty"
                  value={formData.referredByExternalSpecialty} onChange={handleChange} sx={fieldSx}
                  placeholder="e.g. Cardiology"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth label="Clinic / Hospital (Optional)" name="referredByExternalClinic"
                  value={formData.referredByExternalClinic} onChange={handleChange} sx={fieldSx}
                />
              </Grid>
            </Grid>
          )}
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth multiline rows={3} label="Known Allergies / Medical Notes"
            name="allergies" value={formData.allergies} onChange={handleChange} sx={fieldSx}
            placeholder="e.g. Penicillin, Sulfa drugs, Pollen..."
          />
        </Grid>
      </Grid>
    ),

    address: (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth label="Address Line 1" name="addressLine1" value={formData.addressLine1}
            onChange={handleChange} sx={fieldSx} placeholder="House/Flat No., Building, Street"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth label="Address Line 2" name="addressLine2" value={formData.addressLine2}
            onChange={handleChange} sx={fieldSx} placeholder="Area, Landmark (optional)"
          />
        </Grid>
        <GeoAddressPicker
          value={{ stateName: formData.state, districtName: formData.district, city: formData.city, pincode: formData.postalCode }}
          onChange={(patch) => setFormData((prev) => ({
            ...prev,
            ...(patch.stateName !== undefined ? { state: patch.stateName } : {}),
            ...(patch.districtName !== undefined ? { district: patch.districtName } : {}),
            ...(patch.city !== undefined ? { city: patch.city } : {}),
            ...(patch.pincode !== undefined ? { postalCode: patch.pincode } : {}),
          }))}
        />
      </Grid>
    ),

    emergency: (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
            <ContactPhoneRounded sx={{ color: "#f59e0b", fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Emergency contact to notify in case of a medical emergency.
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth label="Contact Name" name="emergencyContactName"
            value={formData.emergencyContactName} onChange={handleChange} sx={fieldSx}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth label="Contact Phone" name="emergencyContactPhone"
            value={formData.emergencyContactPhone} onChange={handleChange} sx={fieldSx}
            error={!!errors.emergencyContactPhone} helperText={errors.emergencyContactPhone}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select fullWidth label="Relationship" name="emergencyContactRelation"
            value={formData.emergencyContactRelation} onChange={handleChange} sx={fieldSx}
          >
            {["Spouse", "Parent", "Child", "Sibling", "Friend", "Guardian", "Other"].map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
    ),
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      {/* Header */}
      {!isModal && (
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate("/reception/patients")}
          sx={{ color: "text.secondary", textTransform: "none", mb: 1, pl: 0 }}
        >
          Back to Patients
        </Button>
      )}
      <PageHeader
        title={isEditing ? "Edit Patient" : "Register Patient"}
        subtitle={isEditing
          ? "Update patient registration details"
          : "Fill in the patient information to register them in the system"}
        actions={!isEditing ? (
          <Chip
            icon={<LockOpenRounded sx={{ fontSize: "16px !important" }} />}
            label="MRN will be auto-generated"
            sx={{
              bgcolor: "rgba(6, 182, 212, 0.08)",
              color: "#06b6d4",
              border: "1px solid", borderColor: "divider",
              fontWeight: 600,
            }}
          />
        ) : undefined}
      />

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* ── Section Nav (Left) ── */}
          {!isModal && (
            <Grid size={{ xs: 12, md: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid", borderColor: "divider",
                  bgcolor: "background.paper",
                  overflow: "hidden",
                  position: "sticky",
                  top: 90,
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: "#334155", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                    Quick Navigation
                  </Typography>
                </Box>
                <Divider sx={{ borderColor: "rgba(6,182,212,0.08)" }} />
                {SECTIONS.map((section) => {
                  return (
                    <Box
                      key={section.id}
                      onClick={() => {
                        document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth" });
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2.5,
                        py: 1.8,
                        cursor: "pointer",
                        borderLeft: "3px solid transparent",
                        transition: "all 0.15s ease",
                        "&:hover": { bgcolor: "rgba(6, 182, 212, 0.06)", borderLeft: "3px solid #06b6d4" },
                      }}
                    >
                      <Box sx={{ color: "#334155" }}>{section.icon}</Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontWeight: 500 }}
                      >
                        {section.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Paper>
            </Grid>
          )}

          {/* ── Form Content (Right) ── */}
          <Grid size={{ xs: 12, md: isModal ? 12 : 9 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {SECTIONS.map((section) => (
                <Paper
                  key={section.id}
                  id={`section-${section.id}`}
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: "1px solid", borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                    <Box sx={{ color: "#06b6d4" }}>
                      {section.icon}
                    </Box>
                    <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
                      {section.label}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: "rgba(6, 182, 212, 0.08)", mb: 3 }} />
                  {sectionContent[section.id]}
                </Paper>
              ))}
            </Box>

            {/* Submit row */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                mt: 3,
                p: 2.5,
                borderRadius: 2,
                bgcolor: "background.default",
                border: "1px solid", borderColor: "divider",
                gap: 2,
              }}
            >
              {isModal && onCancel && (
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none", px: 3, py: 1.1 }}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <HeartbeatLoader size={22} /> : <SaveRounded />}
                sx={{
                  background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
                  fontWeight: 700,
                  px: 4,
                  py: 1.3,
                  textTransform: "none",
                  borderRadius: 2,
                  boxShadow: "0 4px 14px rgba(6, 182, 212, 0.25)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)",
                    boxShadow: "0 6px 20px rgba(6, 182, 212, 0.35)",
                  },
                }}
              >
                {loading ? "Saving..." : isEditing ? "Save Changes" : "Register Patient"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
}
