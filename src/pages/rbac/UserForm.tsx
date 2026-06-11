import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Grid,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from "@mui/material";
import { ArrowBackRounded, Visibility, VisibilityOff, ContentCopyRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";

interface Hospital {
  hospitalId: string;
  hospitalName: string;
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

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  // Data for dropdowns
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    hospitalId: "",
    roleId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    employeeCode: "",
    password: "",
    status: "active",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Fetch lookups
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [hospRes, roleRes] = await Promise.all([
          axiosInstance.get("/hospitals", { params: { limit: 100 } }),
          axiosInstance.get("/rbac/roles", { params: { limit: 100 } })
        ]);
        setHospitals(hospRes.data.data);
        setRoles(roleRes.data.data);
      } catch (err) {
        console.error("Failed to fetch lookups", err);
        toast.error("Failed to load required data. Please refresh.");
      }
    };
    fetchLookups();
  }, []);

  // Filter roles when hospital changes
  useEffect(() => {
    if (formData.hospitalId && roles.length > 0) {
      setFilteredRoles(
        roles.filter(r => r.hospitalId === formData.hospitalId || r.isSystemRole) // Include system roles
      );
    } else {
      setFilteredRoles([]);
    }
  }, [formData.hospitalId, roles]);

  // Fetch user if edit mode
  useEffect(() => {
    if (isEdit) {
      const fetchUser = async () => {
        try {
          const res = await axiosInstance.get(`/rbac/users/${id}`);
          const user = res.data.data;
          setFormData({
            hospitalId: user.hospitalId || "",
            roleId: user.roleId || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            phone: user.phone || "",
            employeeCode: user.employeeCode || "",
            password: "",
            status: user.status || "active",
          });
        } catch (err) {
          console.error("Failed to fetch user", err);
          toast.error("Failed to load user data");
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    }
  }, [id, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Reset role if hospital changes
      if (name === "hospitalId" && prev.hospitalId !== value) {
        next.roleId = "";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password; // Omit if empty
      
      if (isEdit) {
        delete payload.email; // Don't send email on update (not supported in backend yet or shouldn't change)
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

  const handleCopyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <IconButton onClick={() => navigate("/rbac/users")} sx={{ color: "text.secondary" }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "text.primary" }}>
          {isEdit ? "Edit User" : "Add New User"}
        </Typography>
      </Box>
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
                disabled={isEdit}
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
                  {saving ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Save"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Card>

      {/* Generated Password Dialog */}
      <Dialog
        open={!!generatedPassword}
        onClose={() => {
          setGeneratedPassword(null);
          navigate("/rbac/users");
        }}
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            borderRadius: 3,
            border: "1px solid", borderColor: "divider",
          }
        }}
      >
        <DialogTitle sx={{ color: "#10b981", fontWeight: 700 }}>User Created Successfully</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", mb: 2 }}>
            A temporary password was automatically generated for this user. Please securely share these credentials with them. They will be forced to change it on their first login.
          </DialogContentText>
          <Box sx={{ 
            p: 2, 
            bgcolor: "background.paper", 
            borderRadius: 2, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            border: "1px solid", borderColor: "divider"
          }}>
            <Typography variant="h6" sx={{ fontFamily: "monospace", letterSpacing: 2 }}>
              {generatedPassword}
            </Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton onClick={handleCopyPassword} sx={{ color: "#6366f1" }}>
                <ContentCopyRounded />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => {
              setGeneratedPassword(null);
              navigate("/rbac/users");
            }} 
            variant="contained"
            sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
