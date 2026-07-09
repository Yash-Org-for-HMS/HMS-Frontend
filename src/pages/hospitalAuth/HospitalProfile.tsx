import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "../../components/ErrorState";
import GeoAddressPicker from "../../components/GeoAddressPicker";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Divider,
} from "@mui/material";
import { SaveRounded, BusinessRounded, PaletteRounded, GavelRounded, CloudUploadRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { useToast } from "../../contexts/ToastContext";
import { assetUrl } from "../../utils/assetUrl";
import PageHeader from "../../components/layout/PageHeader";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import DetailSkeleton from "../../components/skeletons/DetailSkeleton";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const active = value === index;

  // All panels stay mounted and stacked in the same grid cell (see the parent
  // `display: grid`), so the card sizes to the TALLEST tab and its size stays
  // fixed when switching tabs. Inactive panels are hidden but keep their space.
  return (
    <Box
      role="tabpanel"
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      sx={{
        gridArea: "1 / 1",
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
      {...other}
    >
      <Box sx={{ pt: 3 }}>{children}</Box>
    </Box>
  );
}

function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    "aria-controls": `profile-tabpanel-${index}`,
  };
}

export default function HospitalProfile() {
  const { user, hospital, updateHospital } = useHospitalAuth();
  // The backend only lets H_ADMIN edit the hospital profile — mirror that here
  // so staff see a read-only view instead of filling out a form that 403s on save.
  const canEdit = user?.role === "H_ADMIN";
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState({
    hospitalName: "",
    registrationNumber: "",
    ownershipType: "",
    websiteUrl: "",
    officialEmail: "",
    officialPhone: "",
    addressLine1: "",
    addressLine2: "",
    countryId: "",
    stateId: "",
    cityId: "",
    city: "",
    postalCode: "",
    logoUrl: "",
    gstNumber: "",
    licenseExpiryDate: "",
    accreditationType: "",
  });

  const { data: profileData, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["hospital-profile"],
    queryFn: async () => (await axiosInstance.get("/hospital/profile")).data.data,
  });

  // Seed the editable form once the profile loads (or after a refetch).
  useEffect(() => {
    if (!profileData) return;
    const data = profileData;
    setFormData({
      hospitalName: data.hospitalName || "",
      registrationNumber: data.registrationNumber || "",
      ownershipType: data.ownershipType || "",
      websiteUrl: data.websiteUrl || "",
      officialEmail: data.officialEmail || "",
      officialPhone: data.officialPhone || "",
      addressLine1: data.addressLine1 || "",
      addressLine2: data.addressLine2 || "",
      countryId: data.countryId?.toString() || "",
      stateId: data.stateId?.toString() || "",
      cityId: data.cityId?.toString() || "",
      city: data.city || "",
      postalCode: data.postalCode || "",
      logoUrl: data.logoUrl || "",
      gstNumber: data.gstNumber || "",
      licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate).toISOString().split('T')[0] : "",
      accreditationType: data.accreditationType || "",
    });
  }, [profileData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formDataUpload = new FormData();
      formDataUpload.append("logo", file);

      try {
        setUploadingLogo(true);
        const res = await axiosInstance.post("/hospital/profile/logo", formDataUpload, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        setFormData((prev) => ({ ...prev, logoUrl: res.data.data.logoUrl }));
        updateHospital({ logoUrl: res.data.data.logoUrl });
        toast.success("Logo uploaded successfully!");
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to upload logo");
      } finally {
        setUploadingLogo(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axiosInstance.put("/hospital/profile", formData);
      toast.success("Profile updated successfully!");
      // Optionally re-fetch
      await refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DetailSkeleton />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load profile"
        message={(error as any)?.response?.data?.message}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <PageHeader
        title="Hospital Profile"
        subtitle="Manage your hospital's details, branding, and compliance information."
      />
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You're viewing this in read-only mode — only a hospital admin can edit these details.
        </Alert>
      )}
      {canEdit && (!formData.officialPhone || !formData.addressLine1 || !formData.registrationNumber) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Finish setting up your hospital to unlock the rest of the panel. Required (marked *):
          official phone &amp; address line 1 (General Information), and registration number (Compliance).
        </Alert>
      )}
<Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          bgcolor: "background.paper",
          border: "1px solid", borderColor: "divider",
          borderRadius: 3,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              "& .MuiTab-root": {
                color: "text.secondary",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                minHeight: 64,
              },
              "& .Mui-selected": {
                color: "#10b981 !important",
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "#10b981",
                height: 3,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              },
            }}
          >
            <Tab icon={<BusinessRounded sx={{ mr: 1 }} />} iconPosition="start" label="General Information" {...a11yProps(0)} />
            <Tab icon={<PaletteRounded sx={{ mr: 1 }} />} iconPosition="start" label="Branding" {...a11yProps(1)} />
            <Tab icon={<GavelRounded sx={{ mr: 1 }} />} iconPosition="start" label="Compliance" {...a11yProps(2)} />
          </Tabs>
        </Box>

        <Box sx={{ p: 4, display: "grid" }}>
          {/* General Information Tab */}
          <CustomTabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Hospital Name"
                  name="hospitalName"
                  value={formData.hospitalName}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Ownership Type"
                  name="ownershipType"
                  value={formData.ownershipType}
                  onChange={handleChange}
                  disabled={!canEdit}
                >
                  <MenuItem value="">Select Type</MenuItem>
                  <MenuItem value="private">Private</MenuItem>
                  <MenuItem value="government">Government</MenuItem>
                  <MenuItem value="trust">Trust</MenuItem>
                  <MenuItem value="NGO">NGO</MenuItem>
                  <MenuItem value="cooperative">Cooperative</MenuItem>
                </TextField>
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1, borderColor: "divider" }} />
                <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 2 }}>Contact Details</Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Official Email"
                  name="officialEmail"
                  type="email"
                  value={formData.officialEmail}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Official Phone"
                  name="officialPhone"
                  value={formData.officialPhone}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Website URL"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1, borderColor: "divider" }} />
                <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 2 }}>Address Information</Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Address Line 1"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required
                />
              </Grid>
              <GeoAddressPicker
                disabled={!canEdit}
                value={{ stateId: formData.stateId as any, districtId: formData.cityId as any, city: formData.city, pincode: formData.postalCode }}
                onChange={(patch) => setFormData((prev) => ({
                  ...prev,
                  ...(patch.stateId !== undefined ? { stateId: (patch.stateId ?? "") as any } : {}),
                  ...(patch.districtId !== undefined ? { cityId: (patch.districtId ?? "") as any } : {}),
                  ...(patch.city !== undefined ? { city: patch.city } : {}),
                  ...(patch.pincode !== undefined ? { postalCode: patch.pincode } : {}),
                }))}
              />
            </Grid>
          </CustomTabPanel>

          {/* Branding Tab */}
          <CustomTabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 2 }}>Hospital Logo</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: 2,
                      border: "1px dashed",
                      borderColor: "divider",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "background.default",
                      overflow: "hidden",
                    }}
                  >
                    {formData.logoUrl ? (
                      <img 
                        src={assetUrl(formData.logoUrl)} 
                        alt="Logo" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">No Logo</Typography>
                    )}
                  </Box>
                  <Box>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={uploadingLogo ? <HeartbeatLoader size={22} /> : <CloudUploadRounded />}
                      disabled={uploadingLogo || !canEdit}
                    >
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </Button>
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: "text.secondary" }}>
                      Recommended size: 256x256px. Max 5MB (JPEG, PNG).
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* Compliance Tab */}
          <CustomTabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Registration Number"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="GST Number"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="License Expiry Date"
                  name="licenseExpiryDate"
                  type="date"
                  value={formData.licenseExpiryDate}
                  onChange={handleChange}
                  disabled={!canEdit}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Accreditation Type"
                  name="accreditationType"
                  value={formData.accreditationType}
                  onChange={handleChange}
                  disabled={!canEdit}
                  placeholder="e.g. NABH, JCI, ISO 9001"
                />
              </Grid>
            </Grid>
          </CustomTabPanel>
        </Box>

        {canEdit && (
          <Box sx={{ p: 3, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
              sx={{
                bgcolor: "#10b981",
                "&:hover": { bgcolor: "#059669" },
                px: 4,
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
