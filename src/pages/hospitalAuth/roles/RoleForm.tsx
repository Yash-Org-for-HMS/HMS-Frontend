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
  Checkbox,
  FormControlLabel,
  Divider,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

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
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    roleName: "",
    roleCode: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Fetch all available permissions
        const permRes = await axiosInstance.get("/hospital/roles/permissions");
        setGroupedPermissions(permRes.data.data);

        // 2. Fetch role data if editing or cloning
        if (isEditing || isCloning) {
          const roleIdToFetch = isEditing ? id : cloneId;
          const roleRes = await axiosInstance.get(`/hospital/roles/${roleIdToFetch}`);
          const role = roleRes.data.data;

          if (isEditing) {
            setFormData({
              roleName: role.roleName,
              roleCode: role.roleCode,
            });
          } else {
            // When cloning, prefix the name and append something to the code
            setFormData({
              roleName: `${role.roleName} (Copy)`,
              roleCode: `${role.roleCode}_COPY`,
            });
          }
          
          // Pre-select permissions
          const pIds = role.rolePermissions.map((rp: any) => rp.permissionId);
          setSelectedPermissions(pIds);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setInitialLoad(false);
      }
    };
    loadData();
  }, [id, cloneId, isEditing, isCloning]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
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
    setError(null);

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
    },
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            {isEditing ? "Edit Role" : isCloning ? "Clone Role" : "Create New Role"}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Configure role details and module permissions.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/roles")}
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

      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, mb: 4 }}>
          <Typography variant="h6" sx={{ color: "#f8fafc", mb: 3 }}>Role Details</Typography>
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

        <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2 }}>Module Permissions</Typography>
        <Grid container spacing={3}>
          {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
            const allModulePermsSelected = perms.every(p => selectedPermissions.includes(p.permissionId));
            const someModulePermsSelected = perms.some(p => selectedPermissions.includes(p.permissionId));
            const indeterminate = someModulePermsSelected && !allModulePermsSelected;

            return (
              <Grid size={{ xs: 12, md: 6 }} key={moduleName}>
                <Paper sx={{ p: 3, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, height: "100%" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: "#f8fafc", fontWeight: 600 }}>
                      {moduleName}
                    </Typography>
                    <FormControlLabel
                      label={<Typography variant="body2" sx={{ color: "#94a3b8" }}>Select All</Typography>}
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
                  <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.1)" }} />
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
                        label={<Typography variant="body2" sx={{ color: "#cbd5e1" }}>{perm.actionName}</Typography>}
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
