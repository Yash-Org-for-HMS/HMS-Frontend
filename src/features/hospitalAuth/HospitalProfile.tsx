import { useState, useEffect } from "react";
import { FORM_PAGE_WIDTH } from "@/components/layout/pageWidth";
import { SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "@/components/ErrorState";
import GeoAddressPicker from "@/components/GeoAddressPicker";
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
import {
  SaveRounded, BusinessRounded, PaletteRounded, GavelRounded, CloudUploadRounded,
  ArrowBackRounded, ArrowForwardRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useToast } from "@/providers/ToastContext";
import HospitalLogo from "@/components/HospitalLogo";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

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

/**
 * A tab label that can carry a "something's missing here" dot.
 *
 * Small and unlabelled on purpose: it marks where to look, and the message on
 * Save says what is actually wrong. A count here would be a second thing to
 * read on a control whose job is to be a signpost.
 */
function TabLabel({ text, flag }: { text: string; flag?: boolean }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {text}
      {flag && (
        <Box
          component="span"
          aria-label="has a required field still empty"
          sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: SEMANTIC.danger, flexShrink: 0 }}
        />
      )}
    </Box>
  );
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

  /**
   * Which tab each required field lives on, and what to call it.
   *
   * Every panel stays mounted (hidden with `visibility`, so the card does not
   * resize between tabs), which meant the browser's own `required` check found
   * an empty control it could not focus — "An invalid form control is not
   * focusable" — and blocked the save with nothing visible to act on. You
   * filled in General, pressed Save, and either nothing happened or a "fill out
   * this field" bubble pointed at a field on a tab you were not looking at.
   *
   * So the form no longer validates natively. This list drives our own check,
   * which can do the thing the browser cannot: SWITCH TO THE TAB the problem is
   * on before complaining about it.
   */
  const REQUIRED_FIELDS: { name: keyof typeof formData; label: string; tab: number }[] = [
    { name: "hospitalName", label: "Hospital name", tab: 0 },
    { name: "officialPhone", label: "Official phone", tab: 0 },
    { name: "addressLine1", label: "Address line 1", tab: 0 },
    { name: "registrationNumber", label: "Registration number", tab: 2 },
  ];
  const TAB_LABELS = ["General Information", "Branding", "Compliance"];

  const missingFields = REQUIRED_FIELDS.filter((f) => !String(formData[f.name] ?? "").trim());
  /** Tabs carrying a problem, so a tab can show it before anyone presses Save. */
  const tabsWithMissing = new Set(missingFields.map((f) => f.tab));

  const LAST_TAB = TAB_LABELS.length - 1;
  const isLastTab = tabValue === LAST_TAB;

  /**
   * Step forward, but only once THIS tab is complete.
   *
   * Checking one tab at a time is the point of stepping through: whatever is
   * wrong is on the screen you are already looking at. The old single Save
   * checked all three at once and pointed at fields two tabs away.
   *
   * The tab strip stays clickable on purpose — an existing hospital changing
   * one GST number should not have to walk the whole path — so this is a guided
   * route, not a cage.
   */
  const goNext = () => {
    const missingHere = REQUIRED_FIELDS.filter(
      (f) => f.tab === tabValue && !String(formData[f.name] ?? "").trim(),
    );
    if (missingHere.length) {
      toast.error(
        missingHere.length === 1
          ? `${missingHere[0].label} is required.`
          : `Still needed here: ${missingHere.map((f) => f.label).join(", ")}.`,
      );
      return;
    }
    setTabValue((t) => Math.min(t + 1, LAST_TAB));
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
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, "Failed to upload logo"));
      } finally {
        setUploadingLogo(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Save, called directly — never as a form submission from a button click.
   *
   * The Next and Save buttons occupy the same slot in the footer, so React
   * reuses the SAME <button> node between steps and simply changes its
   * attributes. When Next was `type="button"` and Save `type="submit"`,
   * clicking Next on Branding did this:
   *
   *   1. onClick runs goNext(), which sets the tab to Compliance
   *   2. React flushes that update synchronously, still inside the click
   *   3. the button element's `type` is now "submit"
   *   4. the browser reaches the click's DEFAULT ACTION, reads the type it
   *      finds NOW, and submits the form
   *
   * So pressing Next silently saved the profile. The isLastTab guard could not
   * catch it either: by step 4 the tab really was the last one. Both buttons
   * are now `type="button"` and call what they mean, which leaves the form's
   * onSubmit for the Enter key alone.
   */
  const saveProfile = async () => {
    // Take them to the problem before naming it. Reporting a missing field on
    // a tab the user cannot see is the whole complaint this replaces.
    if (missingFields.length) {
      const first = missingFields[0];
      setTabValue(first.tab);
      toast.error(
        missingFields.length === 1
          ? `${first.label} is required — it's on the ${TAB_LABELS[first.tab]} tab.`
          : `${missingFields.length} required fields are still empty. Starting with ${first.label}, on the ${TAB_LABELS[first.tab]} tab.`,
      );
      return;
    }

    try {
      setSaving(true);
      await axiosInstance.put("/hospital/profile", formData);
      toast.success("Profile updated successfully!");
      // Optionally re-fetch
      await refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reached only by the Enter key now — no button submits this form.
   *
   * Enter still means "move on" until the last step, so it never runs a save
   * from a step where Save is not even on screen.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLastTab) {
      goNext();
      return;
    }
    void saveProfile();
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
        message={apiErrorText(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: FORM_PAGE_WIDTH, mx: "auto", width: "100%" }}>
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
        // The browser cannot report on a control it cannot focus, and every
        // inactive panel here is `visibility: hidden`. Our own check in
        // handleSubmit does the job and can switch tabs first.
        noValidate
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
                backgroundColor: SEMANTIC.success,
                height: 3,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              },
            }}
          >
            {/* A dot on any tab still missing something required, so the gap is
                visible from here rather than discovered on Save. */}
            <Tab icon={<BusinessRounded sx={{ mr: 1 }} />} iconPosition="start"
              label={<TabLabel text="General Information" flag={canEdit && tabsWithMissing.has(0)} />} {...a11yProps(0)} />
            <Tab icon={<PaletteRounded sx={{ mr: 1 }} />} iconPosition="start"
              label={<TabLabel text="Branding" flag={canEdit && tabsWithMissing.has(1)} />} {...a11yProps(1)} />
            <Tab icon={<GavelRounded sx={{ mr: 1 }} />} iconPosition="start"
              label={<TabLabel text="Compliance" flag={canEdit && tabsWithMissing.has(2)} />} {...a11yProps(2)} />
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
                    {/* Whatever the sidebar is showing, shown here — including the
                        default when a logo was uploaded but its file has gone.
                        An admin deciding whether to upload one should be looking
                        at what their staff actually see, not the words "No Logo"
                        or a broken-image glyph. */}
                    <Box sx={{ textAlign: "center" }}>
                      <HospitalLogo
                        src={formData.logoUrl}
                        size={72}
                        radius={1}
                        title={formData.hospitalName || "Hospital"}
                      />
                      {!formData.logoUrl && (
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.75 }}>
                          Default
                        </Typography>
                      )}
                    </Box>
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
          <Box sx={{
            p: 3, borderTop: "1px solid", borderColor: "divider",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap",
          }}>
            {/* Where you are, and what is left. Says "Step 1 of 3" rather than
                repeating the tab's own name back at you. */}
            <Typography variant="caption" sx={{ color: missingFields.length ? SEMANTIC.danger : "text.secondary" }}>
              {missingFields.length
                ? `Step ${tabValue + 1} of ${TAB_LABELS.length} · ${missingFields.length} required field${missingFields.length === 1 ? "" : "s"} still empty`
                : `Step ${tabValue + 1} of ${TAB_LABELS.length}${isLastTab ? " · saving stores every tab at once" : ""}`}
            </Typography>

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {tabValue > 0 && (
                <Button
                  type="button"
                  onClick={() => setTabValue((t) => Math.max(t - 1, 0))}
                  disabled={saving}
                  startIcon={<ArrowBackRounded />}
                  sx={{ textTransform: "none", color: "text.secondary" }}
                >
                  Back
                </Button>
              )}

              {/* Both `type="button"`, and given distinct keys so React builds a
                  NEW element for each rather than reusing one node and swapping
                  its type mid-click — which is what made Next save the profile.
                  Neither ever triggers a form submission; each calls what it
                  says. */}
              {isLastTab ? (
                <Button
                  key="save"
                  type="button"
                  variant="contained"
                  disabled={saving}
                  onClick={() => void saveProfile()}
                  startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
                  sx={{ bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark }, px: 4 }}
                >
                  {saving ? "Saving..." : "Save profile"}
                </Button>
              ) : (
                <Button
                  key="next"
                  type="button"
                  variant="contained"
                  onClick={goNext}
                  endIcon={<ArrowForwardRounded />}
                  sx={{ bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark }, px: 4 }}
                >
                  Next: {TAB_LABELS[tabValue + 1]}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
