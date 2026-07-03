import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Grid,
  TextField,
  Typography,
  MenuItem,
  Alert,
  IconButton,
  InputAdornment,
  Chip,
} from "@mui/material";
import { ArrowBackRounded, Visibility, VisibilityOff } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import FormHeader from "../../components/layout/FormHeader";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import CredentialDialog from "../../components/CredentialDialog";

interface Branch {
  branchId: string;
  branchName: string;
  status?: string;
}

interface Hospital {
  hospitalId: string;
  hospitalName: string;
  branches?: Branch[];
}

interface Role {
  roleId: string;
  roleName: string;
  hospitalId: string | null;
  isSystemRole?: boolean;
}

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const toast = useToast();
  // Data for dropdowns
  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["hospitals", "rbac-user-options"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 100 } })).data.data,
  });
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["rbac-roles-options"],
    queryFn: async () => (await axiosInstance.get("/rbac/roles", { params: { limit: 100 } })).data.data,
  });
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    hospitalId: "",
    roleId: "",
    branchIds: [] as string[],
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    employeeCode: "",
    password: "",
    status: "active",
  });

  // Branches available for the currently selected hospital
  const selectedHospital = hospitals.find((h) => h.hospitalId === formData.hospitalId);
  const availableBranches = (selectedHospital?.branches ?? []).filter(
    (b) => b.status === undefined || b.status === "active",
  );

  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Show only the selected hospital's roles. System roles are seeded per-hospital
  // (each tenant has its own H_ADMIN/Doctor/… with its hospitalId), so scoping by
  // hospitalId already includes them — once each. The old `|| r.isSystemRole`
  // pulled every tenant's system roles, duplicating the list across hospitals.
  useEffect(() => {
    if (formData.hospitalId && roles.length > 0) {
      setFilteredRoles(roles.filter(r => r.hospitalId === formData.hospitalId));
    } else {
      setFilteredRoles([]);
    }
  }, [formData.hospitalId, roles]);

  // Fetch user if edit mode
  const { data: userData, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["rbac-user", id],
    queryFn: async () => (await axiosInstance.get(`/rbac/users/${id}`)).data.data,
    enabled: isEdit,
  });

  // Seed the form with the existing user when editing.
  useEffect(() => {
    if (!userData) return;
    const user = userData;
    setFormData({
      hospitalId: user.hospitalId || "",
      roleId: user.roleId || "",
      branchIds: Array.isArray(user.branchIds)
        ? user.branchIds
        : user.branchId
          ? [user.branchId]
          : [],
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      employeeCode: user.employeeCode || "",
      password: "",
      status: user.status || "active",
    });
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Reset role and branch assignments if hospital changes (they are hospital-scoped)
      if (name === "hospitalId" && prev.hospitalId !== value) {
        next.roleId = "";
        next.branchIds = [];
      }
      return next;
    });
  };

  const handleBranchChange = (e: { target: { value: unknown } }) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      branchIds: typeof value === "string" ? value.split(",") : (value as string[]),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password; // Omit if empty
      
      if (isEdit) {
        delete payload.password; // Don't send password on update via this form
        await axiosInstance.put(`/rbac/users/${id}`, payload);
        navigate("/rbac/users");
      } else {
        const res = await axiosInstance.post("/rbac/users", payload);
        if (res.data.data.tempPassword) {
          setGeneratedPassword(res.data.data.tempPassword);
        } else {
          navigate("/rbac/users");
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save user");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoader />
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load user" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <FormHeader title={isEdit ? "Edit User" : "Add New User"} onBack={() => navigate("/rbac/users")} />
<Card
        sx={{
          p: 4,
          bgcolor: "background.paper",
          backgroundImage: "none",
          borderRadius: 3,
          border: "1px solid", borderColor: "divider",
        }}
      >
        <form onSubmit={handleSubmit}>
          <Typography variant="h6" sx={{ color: "text.primary", mb: 3 }}>
            User Details
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                helperText="This is the user's login email. Changing it changes how they sign in."
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Phone (Optional)"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Employee Code (Optional)"
                name="employeeCode"
                value={formData.employeeCode}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" sx={{ color: "text.primary", mb: 2, mt: 2 }}>
                Access & Security
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Hospital"
                name="hospitalId"
                value={formData.hospitalId}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                    "& .MuiSvgIcon-root": { color: "text.secondary" },
                  },
                }}
              >
                {hospitals.map((hosp) => (
                  <MenuItem key={hosp.hospitalId} value={hosp.hospitalId}>
                    {hosp.hospitalName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Role"
                name="roleId"
                value={formData.roleId}
                onChange={handleChange}
                required
                disabled={!formData.hospitalId}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                    "& .MuiSvgIcon-root": { color: "text.secondary" },
                  },
                }}
              >
                {filteredRoles.map((role) => (
                  <MenuItem key={role.roleId} value={role.roleId}>
                    {role.roleName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Branches (access scope)"
                name="branchIds"
                value={formData.branchIds}
                onChange={handleBranchChange}
                disabled={!formData.hospitalId}
                helperText={
                  !formData.hospitalId
                    ? "Select a hospital first"
                    : availableBranches.length === 0
                      ? "This hospital has no branches yet"
                      : "Leave empty to grant organization-wide access, or pick one or more branches to scope this user"
                }
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as string[]).map((value) => {
                        const branch = availableBranches.find((b) => b.branchId === value);
                        return <Chip key={value} label={branch?.branchName || value} size="small" />;
                      })}
                    </Box>
                  ),
                }}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                    "& .MuiSvgIcon-root": { color: "text.secondary" },
                  },
                }}
              >
                {availableBranches.map((branch) => (
                  <MenuItem key={branch.branchId} value={branch.branchId}>
                    {branch.branchName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {!isEdit && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Leave empty to auto-generate"
                  InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "text.primary",
                      "& fieldset": { borderColor: "divider" },
                      "&:hover fieldset": { borderColor: "divider" },
                      "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                    },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "text.secondary" }}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                  Users will be forced to change their password on first login.
                </Typography>
              </Grid>
            )}

            {isEdit && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  select
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  InputLabelProps={{ style: { color: "text.secondary" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "text.primary",
                      "& fieldset": { borderColor: "divider" },
                      "&:hover fieldset": { borderColor: "divider" },
                      "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                      "& .MuiSvgIcon-root": { color: "text.secondary" },
                    },
                  }}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/rbac/users")}
                  sx={{
                    color: "text.secondary",
                    borderColor: "divider",
                    "&:hover": { borderColor: "divider", bgcolor: "action.hover" },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                  sx={{
                    bgcolor: "#6366f1",
                    "&:hover": { bgcolor: "#4f46e5" },
                    minWidth: 120,
                  }}
                >
                  {saving ? <HeartbeatLoader size={22} /> : "Save"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Card>

      {/* Generated Password Dialog */}
      <CredentialDialog
        open={!!generatedPassword}
        password={generatedPassword || ""}
        title="User Created Successfully"
        note="A temporary password was automatically generated for this user. They will be forced to change it on their first login."
        onClose={() => {
          setGeneratedPassword(null);
          navigate("/rbac/users");
        }}
      />
    </Box>
  );
}
