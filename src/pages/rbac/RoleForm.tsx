import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

export default function RoleForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    hospitalId: "",
    roleCode: "",
    roleName: "",
    isSystemRole: false,
    status: "active",
  });

  const { data: hospitals = [], isLoading: hospLoading, isError: hospIsError, error: hospError, refetch: refetchHosp } = useQuery<any[]>({
    queryKey: ["hospitals", "rbac-role-options"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 100 } })).data.data,
  });
  const { data: allPermissions = [], isLoading: permLoading, isError: permIsError, error: permError, refetch: refetchPerms } = useQuery<any[]>({
    queryKey: ["rbac-permissions"],
    queryFn: async () => (await axiosInstance.get("/rbac/permissions")).data.data,
  });
  const { data: roleData, isLoading: roleLoading, isError: roleIsError, error: roleError, refetch: refetchRole } = useQuery({
    queryKey: ["rbac-role", id],
    queryFn: async () => (await axiosInstance.get(`/rbac/roles/${id}`)).data.data,
    enabled: isEdit,
  });

  // Seed the form + selected permissions from the loaded role when editing.
  useEffect(() => {
    if (!roleData) return;
    const d = roleData;
    setFormData({
      hospitalId: d.hospitalId || "",
      roleCode: d.roleCode || "",
      roleName: d.roleName || "",
      isSystemRole: d.isSystemRole || false,
      status: d.status || "active",
    });
    setSelectedPermissions(d.rolePermissions.map((rp: any) => rp.permissionId));
  }, [roleData]);

  const initialLoading = hospLoading || permLoading || (isEdit && roleLoading);
  const isError = hospIsError || permIsError || roleIsError;
  const error = hospError || permError || roleError;
  const refetch = () => { refetchHosp(); refetchPerms(); if (isEdit) refetchRole(); };

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
    try {
      const payload = { ...formData, permissionIds: selectedPermissions };
      if (isEdit) {
        await axiosInstance.put(`/rbac/roles/${id}`, payload);
      } else {
        await axiosInstance.post("/rbac/roles", payload);
      }
      navigate("/rbac/roles");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("common.error"));
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

  if (isError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <ErrorState title="Couldn't load role form" message={(error as any)?.response?.data?.message} onRetry={refetch} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/rbac/roles")}
          sx={{
            bgcolor: "action.hover",
            border: "1px solid", borderColor: "divider",
            color: "text.primary",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <PageHeader
            title={isEdit ? t("rbac.editRole", "Edit Role") : t("rbac.addRole", "Add Role")}
          />
        </Box>
      </Box>
<Paper
        elevation={2}
        sx={{
          p: { xs: 3, md: 5 },
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
          border: "1px solid", borderColor: "divider",
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
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": {
                          py: 1.8,
                          px: 2,
                          "&:hover": { bgcolor: "action.hover" }
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
                  label={<Typography sx={{ color: "text.primary" }}>Is System Role Template</Typography>}
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
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
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
              <Typography variant="h6" sx={{ color: "text.primary", mt: 2, mb: 3 }}>
                Assign Permissions
              </Typography>
              <Grid container spacing={3}>
                {Object.entries(permissionsByModule).map(([moduleName, perms]: [string, any]) => (
                  <Grid size={{ xs: 12 }} key={moduleName}>
                    <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
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
                            label={<Typography variant="body2" sx={{ color: "text.primary" }}>{perm.actionName}</Typography>}
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
                  sx={{ borderColor: "divider", color: "text.primary" }}
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
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#14b8a6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#14b8a6" },
};
