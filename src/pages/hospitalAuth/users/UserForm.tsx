import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  InputAdornment,
  IconButton,
  Dialog,
  DialogContent,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  SaveRounded,
  Visibility,
  VisibilityOff,
  LockRounded,
  ContentCopyRounded,
  CheckCircleRounded,
  InfoOutlined,
  PersonRounded,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

interface Role {
  roleId: string;
  roleName: string;
}
interface Department {
  departmentId: string;
  departmentName: string;
}
interface Branch {
  branchId: string;
  branchName: string;
}
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ── Credentials Dialog ──────────────────────────────────────────────────────
interface CredentialDialogProps {
  open: boolean;
  email: string;
  password: string;
  name: string;
  onClose: () => void;
}

function CredentialDialog({ open, email, password, name, onClose }: CredentialDialogProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const copy = async (text: string, which: "email" | "password" | "all") => {
    await navigator.clipboard.writeText(text);
    if (which === "email") { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
    if (which === "password") { setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }
    if (which === "all") { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#0f172a",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: 3,
          backgroundImage: "none",
          overflow: "hidden",
        },
      }}
    >
      {/* Top accent bar */}
      <Box sx={{ height: 4, background: "linear-gradient(90deg, #6366f1, #10b981, #06b6d4)" }} />

      <DialogContent sx={{ p: 4 }}>
        {/* Success Header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "rgba(16, 185, 129, 0.1)",
              border: "2px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <CheckCircleRounded sx={{ color: "#10b981", fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ color: "#f1f5f9", fontWeight: 800, mb: 0.5 }}>
            Staff Account Created!
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Share these login credentials with{" "}
            <Box component="span" sx={{ color: "#a5b4fc", fontWeight: 600 }}>
              {name}
            </Box>
          </Typography>
        </Box>

        {/* Credentials Box */}
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: "rgba(99, 102, 241, 0.05)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            mb: 3,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#6366f1", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", mb: 2, display: "block" }}
          >
            Login Credentials
          </Typography>

          {/* Email row */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600 }}>
              Email / Username
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 0.5,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Typography
                sx={{
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  wordBreak: "break-all",
                }}
              >
                {email}
              </Typography>
              <Tooltip title={copiedEmail ? "Copied!" : "Copy email"}>
                <IconButton
                  size="small"
                  onClick={() => copy(email, "email")}
                  sx={{ color: copiedEmail ? "#10b981" : "#475569", ml: 1 }}
                >
                  {copiedEmail ? <CheckCircleRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Password row */}
          <Box>
            <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600 }}>
              Temporary Password
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 0.5,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Typography
                sx={{
                  color: "#fbbf24",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                {password}
              </Typography>
              <Tooltip title={copiedPassword ? "Copied!" : "Copy password"}>
                <IconButton
                  size="small"
                  onClick={() => copy(password, "password")}
                  sx={{ color: copiedPassword ? "#10b981" : "#475569", ml: 1 }}
                >
                  {copiedPassword ? <CheckCircleRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        {/* Info Banner */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(6, 182, 212, 0.05)",
            border: "1px solid rgba(6, 182, 212, 0.15)",
            mb: 3,
          }}
        >
          <InfoOutlined sx={{ color: "#06b6d4", fontSize: 18, mt: 0.1, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>
            The staff member will be required to <strong style={{ color: "#e2e8f0" }}>change this password</strong> on first login.
            Make sure to share these credentials securely.
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={copiedAll ? <CheckCircleRounded /> : <ContentCopyRounded />}
            onClick={() =>
              copy(`Login: ${email}\nPassword: ${password}\n\nNote: You will be asked to change your password on first login.`, "all")
            }
            sx={{
              color: copiedAll ? "#10b981" : "#94a3b8",
              borderColor: copiedAll ? "#10b981" : "rgba(255,255,255,0.15)",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {copiedAll ? "Copied!" : "Copy All"}
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={onClose}
            sx={{
              bgcolor: "#6366f1",
              "&:hover": { bgcolor: "#4f46e5" },
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Done
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Main UserForm ───────────────────────────────────────────────────────────
export default function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Credential dialog state
  const [credentialDialog, setCredentialDialog] = useState<{
    open: boolean;
    email: string;
    password: string;
    name: string;
  }>({ open: false, email: "", password: "", name: "" });

  // Password visibility
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roleId: "",
    employeeCode: "",
    departmentId: "",
    branchId: "",
    dateOfJoining: "",
    designation: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    initialPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const ddRes = await axiosInstance.get("/hospital/users/dropdowns");
        setRoles(ddRes.data.data.roles);
        setDepartments(ddRes.data.data.departments);
        setBranches(ddRes.data.data.branches);

        if (isEditing) {
          const res = await axiosInstance.get(`/hospital/users/${id}`);
          const user = res.data.data;
          setFormData((prev) => ({
            ...prev,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            phone: user.phone || "",
            roleId: user.roleId || "",
            employeeCode: user.employeeCode || "",
            departmentId: user.departmentId || "",
            branchId: user.branchId || "",
            dateOfJoining: user.dateOfJoining
              ? new Date(user.dateOfJoining).toISOString().split("T")[0]
              : "",
            designation: user.designation || "",
            addressLine1: user.addressLine1 || "",
            addressLine2: user.addressLine2 || "",
            city: user.city || "",
            state: user.state || "",
            postalCode: user.postalCode || "",
            emergencyContactName: user.emergencyContactName || "",
            emergencyContactPhone: user.emergencyContactPhone || "",
            emergencyContactRelation: user.emergencyContactRelation || "",
          }));
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
    setError(null);

    // Validate passwords if provided during creation
    if (!isEditing && formData.initialPassword) {
      if (formData.initialPassword.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (formData.initialPassword !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/users/${id}`, formData);
        navigate("/hospital/users");
      } else {
        const payload = {
          ...formData,
          initialPassword: formData.initialPassword || undefined,
        };
        const res = await axiosInstance.post("/hospital/users", payload);
        const { credentials } = res.data;

        // Show credentials dialog
        setCredentialDialog({
          open: true,
          email: credentials.email,
          password: credentials.temporaryPassword,
          name: `${formData.firstName} ${formData.lastName}`,
        });
      }
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
      },
      "& .MuiSvgIcon-root": { color: "#94a3b8" },
    },
  };

  return (
    <>
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
              {isEditing ? "Edit Staff" : "Add New Staff"}
            </Typography>
            <Typography variant="body1" sx={{ color: "#94a3b8" }}>
              {isEditing
                ? "Update staff member details."
                : "Create a new staff member profile and set their login credentials."}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/users")}
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

        <Paper sx={{ p: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
          <form onSubmit={handleSubmit}>
            <Tabs
              value={tabValue}
              onChange={(_e, v) => setTabValue(v)}
              sx={{
                borderBottom: 1,
                borderColor: "rgba(255,255,255,0.1)",
                "& .MuiTab-root": { color: "#94a3b8", textTransform: "none", fontSize: "1rem" },
                "& .Mui-selected": { color: "#6366f1" },
                "& .MuiTabs-indicator": { backgroundColor: "#6366f1" },
              }}
            >
              <Tab label="Personal & Role" />
              <Tab label="Employment" />
              <Tab label="Contact & Emergency" />
              {!isEditing && <Tab label="Login Credentials" />}
            </Tabs>

            {/* ── Tab 0: Personal & Role ── */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required {...textFieldProps} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required {...textFieldProps} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isEditing}
                    helperText={!isEditing ? "This will be the login email" : "Email cannot be changed"}
                    {...textFieldProps}
                    FormHelperTextProps={{ style: { color: "#64748b" } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Phone" name="phone" value={formData.phone} onChange={handleChange} {...textFieldProps} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="User Role / Type"
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    required
                    {...textFieldProps}
                  >
                    {roles.map((role) => (
                      <MenuItem key={role.roleId} value={role.roleId}>
                        {role.roleName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </TabPanel>

            {/* ── Tab 1: Employment ── */}
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Employee Code" name="employeeCode" value={formData.employeeCode} onChange={handleChange} {...textFieldProps} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Designation" name="designation" value={formData.designation} onChange={handleChange} {...textFieldProps} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Date of Joining" name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleChange} {...textFieldProps} slotProps={{ inputLabel: { shrink: true, style: { color: "#94a3b8" } } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField select label="Assign Department" name="departmentId" value={formData.departmentId} onChange={handleChange} {...textFieldProps}>
                    <MenuItem value="">None</MenuItem>
                    {departments.map((d) => <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField select label="Assign Branch" name="branchId" value={formData.branchId} onChange={handleChange} {...textFieldProps}>
                    <MenuItem value="">None</MenuItem>
                    {branches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
            </TabPanel>

            {/* ── Tab 2: Contact & Emergency ── */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2 }}>Contact Details</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}><TextField label="Address Line 1" name="addressLine1" value={formData.addressLine1} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12 }}><TextField label="Address Line 2" name="addressLine2" value={formData.addressLine2} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="City" name="city" value={formData.city} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="State/Province" name="state" value={formData.state} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Postal Code" name="postalCode" value={formData.postalCode} onChange={handleChange} {...textFieldProps} /></Grid>
              </Grid>
              <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.1)" }} />
              <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2 }}>Emergency Contact</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Name" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Phone" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} {...textFieldProps} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Relationship" name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} {...textFieldProps} /></Grid>
              </Grid>
            </TabPanel>

            {/* ── Tab 3: Login Credentials (create only) ── */}
            {!isEditing && (
              <TabPanel value={tabValue} index={3}>
                {/* Info box */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: "rgba(99, 102, 241, 0.06)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    mb: 4,
                  }}
                >
                  <LockRounded sx={{ color: "#818cf8", mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: "#a5b4fc", fontWeight: 700, mb: 0.5 }}>
                      Setting Login Password
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.7 }}>
                      Set a temporary password for this staff member. They will be <strong style={{ color: "#94a3b8" }}>required to change it</strong> on their first login.
                      <br />
                      If you leave this blank, the system will use the default: <Chip label="Password@123" size="small" sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#fbbf24", fontFamily: "monospace", fontWeight: 700, fontSize: "0.78rem", ml: 0.5 }} />
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <PersonRounded sx={{ color: "#64748b", fontSize: 18 }} />
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        Login Email: <strong style={{ color: "#94a3b8" }}>{formData.email || "(set email in Personal tab)"}</strong>
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Temporary Password"
                      name="initialPassword"
                      type={showInitialPassword ? "text" : "password"}
                      value={formData.initialPassword}
                      onChange={handleChange}
                      placeholder="Min 6 characters (or leave blank for default)"
                      InputLabelProps={{ style: { color: "#94a3b8" } }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowInitialPassword(!showInitialPassword)} edge="end" sx={{ color: "#64748b" }}>
                              {showInitialPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#f1f5f9",
                          "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                          "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                          "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                        },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat the password"
                      InputLabelProps={{ style: { color: "#94a3b8" } }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: "#64748b" }}>
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#f1f5f9",
                          "& fieldset": {
                            borderColor:
                              formData.confirmPassword && formData.confirmPassword !== formData.initialPassword
                                ? "rgba(239,68,68,0.5)"
                                : "rgba(255, 255, 255, 0.1)",
                          },
                          "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                          "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                        },
                      }}
                    />
                    {formData.confirmPassword && formData.confirmPassword !== formData.initialPassword && (
                      <Typography variant="caption" sx={{ color: "#f87171", mt: 0.5, display: "block" }}>
                        Passwords do not match
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </TabPanel>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4, borderTop: "1px solid rgba(255,255,255,0.1)", pt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />}
                sx={{
                  bgcolor: "#6366f1",
                  "&:hover": { bgcolor: "#4f46e5" },
                  py: 1.5,
                  px: 4,
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Staff Member"}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>

      {/* Credentials Dialog */}
      <CredentialDialog
        open={credentialDialog.open}
        email={credentialDialog.email}
        password={credentialDialog.password}
        name={credentialDialog.name}
        onClose={() => {
          setCredentialDialog((prev) => ({ ...prev, open: false }));
          navigate("/hospital/users");
        }}
      />
    </>
  );
}
