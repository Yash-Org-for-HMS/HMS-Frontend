import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function RoleForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hospitals, setHospitals] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    hospitalId: "",
    roleCode: "",
    roleName: "",
    isSystemRole: false,
    status: "active",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hospRes, permRes] = await Promise.all([
          axiosInstance.get("/hospitals", { params: { limit: 100 } }),
          axiosInstance.get("/rbac/permissions")
        ]);
        setHospitals(hospRes.data.data);
        setAllPermissions(permRes.data.data);

        if (isEdit) {
          const roleRes = await axiosInstance.get(`/rbac/roles/${id}`);
          const d = roleRes.data.data;
          setFormData({
            hospitalId: d.hospitalId || "",
            roleCode: d.roleCode || "",
            roleName: d.roleName || "",
            isSystemRole: d.isSystemRole || false,
            status: d.status || "active",
          });
          setSelectedPermissions(d.rolePermissions.map((rp: any) => rp.permissionId));
        }
      } catch (err) {
        setError(t("common.error"));
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handlePermissionChange = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId) 
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { ...formData, permissionIds: selectedPermissions };
      if (isEdit) {
        await axiosInstance.put(`/rbac/roles/${id}`, payload);
      } else {
        await axiosInstance.post("/rbac/roles", payload);
      }
      navigate("/rbac/roles");
    } catch (err: any) {
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by module
  const permissionsByModule = allPermissions.reduce((acc: any, perm: any) => {
    if (!acc[perm.moduleName]) acc[perm.moduleName] = [];
    acc[perm.moduleName].push(perm);
    return acc;
  }, {});

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#14b8a6" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/rbac/roles")}
          sx={{
            bgcolor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f8fafc",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <ArrowBackRounded />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", letterSpacing: "-0.5px" }}>
            {isEdit ? t("rbac.editRole", "Edit Role") : t("rbac.addRole", "Add Role")}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          bgcolor: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 4,
        }}
      >
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("rbac.hospital", "Target Hospital")}
                name="hospitalId"
                value={formData.hospitalId}
                onChange={handleChange}
                required
                sx={textFieldSx}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "#1e293b",
                        color: "#f8fafc",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        "& .MuiMenuItem-root": {
                          py: 1.8,
                          px: 2,
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" }
                        }
                      }
                    }
                  }
                }}
              >
                {hospitals.map(h => (
                  <MenuItem key={h.hospitalId} value={h.hospitalId}>
                    {h.hospitalName} ({h.hospitalCode})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", alignItems: "center", height: "100%", pl: 2 }}>
                <FormControlLabel
                  control={<Switch checked={formData.isSystemRole} onChange={handleChange} name="isSystemRole" color="primary" />}
                  label={<Typography sx={{ color: "#f8fafc" }}>Is System Role Template</Typography>}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("rbac.roleName", "Role Name")}
                name="roleName"
                value={formData.roleName}
                onChange={handleChange}
                required
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("rbac.roleCode", "Role Code")}
                name="roleCode"
                value={formData.roleCode}
                onChange={handleChange}
                required
                inputProps={{ style: { textTransform: "uppercase" } }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("rbac.status", "Status")}
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                sx={textFieldSx}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "#1e293b",
                        color: "#f8fafc",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        "& .MuiMenuItem-root": { py: 1.8, px: 2 }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>

            {/* Permissions Grid */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" sx={{ color: "#f8fafc", mt: 2, mb: 3 }}>
                Assign Permissions
              </Typography>
              <Grid container spacing={3}>
                {Object.entries(permissionsByModule).map(([moduleName, perms]: [string, any]) => (
                  <Grid size={{ xs: 12 }} key={moduleName}>
                    <Box sx={{ p: 2, bgcolor: "rgba(15, 23, 42, 0.4)", borderRadius: 3, border: "1px solid rgba(255, 255, 255, 0.05)", height: "100%" }}>
                      <Typography variant="subtitle2" sx={{ color: "#14b8a6", mb: 2, fontWeight: 700, textTransform: "uppercase" }}>
                        {moduleName}
                      </Typography>
                      <FormGroup>
                        {perms.map((perm: any) => (
                          <FormControlLabel
                            key={perm.permissionId}
                            control={
                              <Checkbox 
                                checked={selectedPermissions.includes(perm.permissionId)}
                                onChange={() => handlePermissionChange(perm.permissionId)}
                                size="small"
                                sx={{ color: "rgba(255,255,255,0.3)", "&.Mui-checked": { color: "#14b8a6" } }}
                              />
                            }
                            label={<Typography variant="body2" sx={{ color: "#cbd5e1" }}>{perm.actionName}</Typography>}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/rbac/roles")} 
                  disabled={loading} 
                  sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#cbd5e1" }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading} 
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />} 
                  sx={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Save Role")}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
    "&.Mui-focused fieldset": { borderColor: "#14b8a6" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#14b8a6" },
};
