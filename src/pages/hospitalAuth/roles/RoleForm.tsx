import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";
import HeartbeatLoader from "../../../components/HeartbeatLoader";

interface Permission {
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionName: string;
}

export default function RoleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  
  const cloneId = searchParams.get("clone");
  const isEditing = Boolean(id);
  const isCloning = Boolean(cloneId);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    roleName: "",
    roleCode: "",
  });

  const { data: groupedPermissions = {}, isLoading: permLoading, isError: permIsError, error: permError, refetch: refetchPerms } =
    useQuery<Record<string, Permission[]>>({
      queryKey: ["role-permissions"],
      queryFn: async () => (await axiosInstance.get("/hospital/roles/permissions")).data.data,
    });

  const roleIdToFetch = isEditing ? id : cloneId;
  const { data: roleData, isLoading: roleLoading, isError: roleIsError, error: roleError, refetch: refetchRole } = useQuery({
    queryKey: ["role", roleIdToFetch],
    queryFn: async () => (await axiosInstance.get(`/hospital/roles/${roleIdToFetch}`)).data.data,
    enabled: isEditing || isCloning,
  });

  // Seed the form + selected permissions from the loaded role (edit or clone).
  useEffect(() => {
    if (!roleData) return;
    const role = roleData;
    if (isEditing) {
      setFormData({ roleName: role.roleName, roleCode: role.roleCode });
    } else {
      setFormData({ roleName: `${role.roleName} (Copy)`, roleCode: `${role.roleCode}_COPY` });
    }
    setSelectedPermissions(role.rolePermissions.map((rp: any) => rp.permissionId));
  }, [roleData, isEditing]);

  const initialLoad = permLoading || ((isEditing || isCloning) && roleLoading);
  const isError = permIsError || roleIsError;
  const error = permError || roleError;
  const refetch = () => { refetchPerms(); if (isEditing || isCloning) refetchRole(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permissionId)) {
        return prev.filter((id) => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const handleModuleSelectAll = (moduleName: string, selectAll: boolean) => {
    const modulePerms = groupedPermissions[moduleName].map(p => p.permissionId);
    if (selectAll) {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...modulePerms])));
    } else {
      setSelectedPermissions(prev => prev.filter(id => !modulePerms.includes(id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        permissionIds: selectedPermissions,
      };

      if (isEditing) {
        await axiosInstance.put(`/hospital/roles/${id}`, payload);
      } else {
        await axiosInstance.post("/hospital/roles", payload);
      }
      navigate("/hospital/roles");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred");
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <HeartbeatLoader size={96} />
      </Box>
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load role form" message={(error as any)?.response?.data?.message} onRetry={refetch} />;
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
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <PageHeader
        title={isEditing ? "Edit Role" : isCloning ? "Clone Role" : "Create New Role"}
        subtitle="Configure role details and module permissions."
        actions={
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/roles")}
            sx={{ color: "text.secondary", borderColor: "divider" }}
          >
            Cancel
          </Button>
        }
      />
<form onSubmit={handleSubmit}>
        <Paper sx={{ p: 4, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, mb: 4 }}>
          <Typography variant="h6" sx={{ color: "text.primary", mb: 3 }}>Role Details</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Role Name"
                name="roleName"
                value={formData.roleName}
                onChange={handleChange}
                required
                placeholder="e.g. Senior Doctor"
                {...textFieldProps}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Role Code"
                name="roleCode"
                value={formData.roleCode}
                onChange={handleChange}
                required
                placeholder="e.g. SR_DOCTOR"
                {...textFieldProps}
              />
            </Grid>
          </Grid>
        </Paper>

        <Typography variant="h6" sx={{ color: "text.primary", mb: 2 }}>Module Permissions</Typography>
        <Grid container spacing={3}>
          {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
            const allModulePermsSelected = perms.every(p => selectedPermissions.includes(p.permissionId));
            const someModulePermsSelected = perms.some(p => selectedPermissions.includes(p.permissionId));
            const indeterminate = someModulePermsSelected && !allModulePermsSelected;

            return (
              <Grid size={{ xs: 12, md: 6 }} key={moduleName}>
                <Paper sx={{ p: 3, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, height: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 600 }}>
                      {moduleName}
                    </Typography>
                    <FormControlLabel
                      label={<Typography variant="body2" sx={{ color: "text.secondary" }}>Select All</Typography>}
                      control={
                        <Checkbox
                          size="small"
                          checked={allModulePermsSelected}
                          indeterminate={indeterminate}
                          onChange={(e) => handleModuleSelectAll(moduleName, e.target.checked)}
                          sx={{ color: "rgba(255,255,255,0.3)", "&.Mui-checked": { color: "#6366f1" }, "&.MuiCheckbox-indeterminate": { color: "#6366f1" } }}
                        />
                      }
                    />
                  </Box>
                  <Divider sx={{ mb: 2, borderColor: "divider" }} />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {perms.map((perm) => (
                      <FormControlLabel
                        key={perm.permissionId}
                        control={
                          <Checkbox
                            size="small"
                            checked={selectedPermissions.includes(perm.permissionId)}
                            onChange={() => handlePermissionToggle(perm.permissionId)}
                            sx={{ color: "rgba(255,255,255,0.2)", "&.Mui-checked": { color: "#6366f1" } }}
                          />
                        }
                        label={<Typography variant="body2" sx={{ color: "text.primary" }}>{perm.actionName}</Typography>}
                      />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4, pt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={<SaveRounded />}
            sx={{
              bgcolor: "#6366f1",
              "&:hover": { bgcolor: "#4f46e5" },
              py: 1.5,
              px: 4,
            }}
          >
            {loading ? "Saving..." : "Save Role"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
