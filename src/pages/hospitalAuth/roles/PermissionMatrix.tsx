import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";

interface Permission {
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionName: string;
}

interface Role {
  roleId: string;
  roleName: string;
  roleCode: string;
  isSystemRole: boolean;
  status: string;
  rolePermissions: { permissionId: string }[];
}

export default function PermissionMatrix() {
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});

  // matrixState[roleId] = Set of permissionIds
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});

  const fetchData = async () => {
    try {
      setInitialLoad(true);
      const [permRes, roleRes] = await Promise.all([
        axiosInstance.get("/hospital/roles/permissions"),
        axiosInstance.get("/hospital/roles")
      ]);

      const permsData = permRes.data.data;
      const rolesData = roleRes.data.data;

      setGroupedPermissions(permsData);

      // Now fetch details for each role to get their permissions
      // Since /hospital/roles only gives summary, we fetch each role's permissions
      const roleDetailsPromises = rolesData.map((r: any) => 
        axiosInstance.get(`/hospital/roles/${r.roleId}`)
      );
      
      const roleDetailsRes = await Promise.all(roleDetailsPromises);
      const fullRoles = roleDetailsRes.map(res => res.data.data);
      
      setRoles(fullRoles);

      // Initialize Matrix State
      const newState: Record<string, Set<string>> = {};
      fullRoles.forEach(role => {
        const pIds = role.rolePermissions.map((rp: any) => rp.permissionId);
        newState[role.roleId] = new Set(pIds);
      });
      setMatrixState(newState);

    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = (roleId: string, permissionId: string, isSystemRole: boolean) => {
    if (isSystemRole) return; // Prevent modifying system roles
    
    setMatrixState(prev => {
      const nextSet = new Set(prev[roleId]);
      if (nextSet.has(permissionId)) {
        nextSet.delete(permissionId);
      } else {
        nextSet.add(permissionId);
      }
      return { ...prev, [roleId]: nextSet };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updates = roles
        .filter(r => !r.isSystemRole)
        .map(r => ({
          roleId: r.roleId,
          permissionIds: Array.from(matrixState[r.roleId])
        }));

      await axiosInstance.put("/hospital/roles/matrix", { updates });
      alert("Permission matrix saved successfully!");
      fetchData(); // Refresh to ensure sync
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save matrix");
    } finally {
      setSaving(false);
    }
  };

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Permission Matrix
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Comprehensive view of all roles and their assigned permissions.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            textTransform: "none",
            fontWeight: 600,
            px: 3,
          }}
        >
          {saving ? "Saving..." : "Save Matrix Changes"}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "70vh" }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ 
                  bgcolor: "background.paper", 
                  color: "text.secondary", 
                  borderBottom: "1px solid", borderColor: "divider",
                  minWidth: 250,
                  zIndex: 3
                }}
              >
                Module / Permission
              </TableCell>
              {roles.map(role => (
                <TableCell 
                  key={role.roleId} 
                  align="center"
                  sx={{ 
                    bgcolor: "background.paper", 
                    color: "text.primary", 
                    borderBottom: "1px solid", borderColor: "divider",
                    minWidth: 120,
                    fontWeight: 600,
                    borderLeft: "1px solid"
                  }}
                >
                  {role.roleName}
                  {role.isSystemRole && (
                    <Typography variant="caption" display="block" sx={{ color: "#60a5fa", mt: 0.5 }}>
                      System Role (Read-only)
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
              <React.Fragment key={moduleName}>
                {/* Module Header Row */}
                <TableRow>
                  <TableCell 
                    colSpan={roles.length + 1} 
                    sx={{ 
                      bgcolor: "action.hover", 
                      color: "text.primary", 
                      fontWeight: 700,
                      borderBottom: "1px solid", borderColor: "divider"
                    }}
                  >
                    {moduleName} Module
                  </TableCell>
                </TableRow>
                
                {/* Permission Rows */}
                {perms.map(perm => (
                  <TableRow key={perm.permissionId} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                    <TableCell sx={{ color: "text.secondary", pl: 4, borderBottom: "1px solid", borderColor: "divider" }}>
                      {perm.actionName}
                    </TableCell>
                    
                    {roles.map(role => {
                      const isChecked = matrixState[role.roleId]?.has(perm.permissionId) || false;
                      return (
                        <TableCell 
                          key={role.roleId} 
                          align="center" 
                          sx={{ 
                            borderBottom: "1px solid",
                            borderLeft: "1px solid", borderColor: "divider",
                            bgcolor: isChecked ? "rgba(99, 102, 241, 0.05)" : "transparent"
                          }}
                        >
                          <Checkbox
                            checked={isChecked}
                            onChange={() => handleToggle(role.roleId, perm.permissionId, role.isSystemRole)}
                            disabled={role.isSystemRole}
                            size="small"
                            sx={{ 
                              color: "rgba(255,255,255,0.2)", 
                              "&.Mui-checked": { color: role.isSystemRole ? "#94a3b8" : "#6366f1" } 
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
