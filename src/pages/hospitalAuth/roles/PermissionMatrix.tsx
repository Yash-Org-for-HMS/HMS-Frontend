import React, { useState, useEffect, useMemo } from "react";
import { getApiErrorMessage } from "../../../utils/apiError";
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  alpha,
} from "@mui/material";
import {
  SaveRounded,
  KeyboardArrowDownRounded,
  KeyboardArrowRightRounded,
  MoreVertRounded,
  ChecklistRounded,
  RemoveDoneRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";
import HeartbeatLoader from "../../../components/HeartbeatLoader";
import DetailSkeleton from "../../../components/skeletons/DetailSkeleton";

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
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  
  // State for collapsible modules
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // matrixState[roleId] = Set of permissionIds
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});

  // Anchor for Role Bulk Actions Menu
  const [anchorEl, setAnchorEl] = useState<{ element: null | HTMLElement; roleId: string | null }>({ element: null, roleId: null });

  const fetchData = async () => {
    try {
      setInitialLoad(true);
      setLoadError(null);
      const [permRes, roleRes] = await Promise.all([
        axiosInstance.get("/hospital/roles/permissions"),
        axiosInstance.get("/hospital/roles"),
      ]);

      const permsData = permRes.data.data;
      const rolesData = roleRes.data.data;

      setGroupedPermissions(permsData);

      // Expand all modules by default
      const initialExpanded: Record<string, boolean> = {};
      Object.keys(permsData).forEach((mod) => (initialExpanded[mod] = true));
      setExpandedModules(initialExpanded);

      // Fetch details for each role
      const roleDetailsPromises = rolesData.map((r: any) => axiosInstance.get(`/hospital/roles/${r.roleId}`));
      const roleDetailsRes = await Promise.all(roleDetailsPromises);
      const fullRoles = roleDetailsRes.map((res) => res.data.data);

      setRoles(fullRoles);

      // Initialize Matrix State
      const newState: Record<string, Set<string>> = {};
      fullRoles.forEach((role) => {
        const pIds = role.rolePermissions.map((rp: any) => rp.permissionId);
        newState[role.roleId] = new Set(pIds);
      });
      setMatrixState(newState);
    } catch (err: any) {
      const msg = getApiErrorMessage(err, "Failed to load data");
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPermissionsCount = useMemo(() => {
    return Object.values(groupedPermissions).flat().length;
  }, [groupedPermissions]);

  const handleToggle = (roleId: string, permissionId: string, isSystemRole: boolean) => {
    if (isSystemRole) return;
    setMatrixState((prev) => {
      const nextSet = new Set(prev[roleId]);
      if (nextSet.has(permissionId)) {
        nextSet.delete(permissionId);
      } else {
        nextSet.add(permissionId);
      }
      return { ...prev, [roleId]: nextSet };
    });
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const handleBulkActionOpen = (event: React.MouseEvent<HTMLElement>, roleId: string) => {
    setAnchorEl({ element: event.currentTarget, roleId });
  };

  const handleBulkActionClose = () => {
    setAnchorEl({ element: null, roleId: null });
  };

  const handleBulkEnable = () => {
    if (anchorEl.roleId) {
      const allPermIds = Object.values(groupedPermissions).flat().map((p) => p.permissionId);
      setMatrixState((prev) => ({ ...prev, [anchorEl.roleId as string]: new Set(allPermIds) }));
    }
    handleBulkActionClose();
  };

  const handleBulkDisable = () => {
    if (anchorEl.roleId) {
      setMatrixState((prev) => ({ ...prev, [anchorEl.roleId as string]: new Set() }));
    }
    handleBulkActionClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = roles
        .filter((r) => !r.isSystemRole)
        .map((r) => ({
          roleId: r.roleId,
          permissionIds: Array.from(matrixState[r.roleId]),
        }));

      await axiosInstance.put("/hospital/roles/matrix", { updates });
      alert("Permission matrix saved successfully!");
      fetchData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to save matrix"));
    } finally {
      setSaving(false);
    }
  };

  if (initialLoad) {
    return (
      <DetailSkeleton />
    );
  }

  if (loadError) {
    return <ErrorState title="Couldn't load permissions" message={loadError} onRetry={fetchData} />;
  }

  return (
    <Box>
      {/* Header Area */}
      <PageHeader
        title="Permission Matrix"
        subtitle="Fine-tune access control across your hospital. Expand modules to assign granular actions to specific staff roles."
        actions={
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            sx={{
              bgcolor: "#6366f1",
              "&:hover": { bgcolor: "#4f46e5" },
              textTransform: "none",
              fontWeight: 700,
              px: 4,
              py: 1.2,
              borderRadius: 3,
              boxShadow: "0 8px 16px rgba(99, 102, 241, 0.2)",
            }}
          >
            {saving ? "Saving Matrix..." : "Save Changes"}
          </Button>
        }
      />
{/* Main Matrix Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          overflow: "auto",
          maxHeight: "calc(100vh - 220px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.02)",
        }}
      >
        <Table stickyHeader sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(8px)",
                  color: "text.primary",
                  borderBottom: "2px solid",
                  borderColor: "divider",
                  minWidth: 280,
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  zIndex: 3,
                }}
              >
                Module & Permissions
              </TableCell>
              {roles.map((role) => {
                const activeCount = matrixState[role.roleId]?.size || 0;
                const isAllActive = activeCount === totalPermissionsCount;
                return (
                  <TableCell
                    key={role.roleId}
                    align="center"
                    sx={{
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      backdropFilter: "blur(8px)",
                      color: "text.primary",
                      borderBottom: "2px solid",
                      borderColor: "divider",
                      minWidth: 160,
                      borderLeft: "1px solid",
                      borderLeftColor: "divider",
                    }}
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {role.roleName}
                        </Typography>
                        {!role.isSystemRole && (
                          <IconButton size="small" onClick={(e) => handleBulkActionOpen(e, role.roleId)}>
                            <MoreVertRounded fontSize="small" sx={{ color: "text.secondary" }} />
                          </IconButton>
                        )}
                      </Box>

                      {role.isSystemRole ? (
                        <Chip label="System Role" size="small" sx={{ height: 22, fontSize: "0.75rem", fontWeight: 700, bgcolor: alpha("#3b82f6", 0.1), color: "#3b82f6" }} />
                      ) : (
                        <Tooltip title={`${activeCount} out of ${totalPermissionsCount} permissions granted`}>
                          <Chip
                            label={`${activeCount} / ${totalPermissionsCount}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              bgcolor: isAllActive ? alpha("#10b981", 0.1) : alpha("#6366f1", 0.1),
                              color: isAllActive ? "#10b981" : "#6366f1",
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
              const isExpanded = expandedModules[moduleName];
              return (
                <React.Fragment key={moduleName}>
                  {/* Accordion Style Header Row */}
                  <TableRow
                    hover
                    onClick={() => toggleModule(moduleName)}
                    sx={{ cursor: "pointer", "& > *": { borderBottom: "unset" }, bgcolor: isExpanded ? alpha("#6366f1", 0.02) : "transparent" }}
                  >
                    <TableCell
                      colSpan={roles.length + 1}
                      sx={{
                        py: 2,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        borderTop: "4px solid",
                        borderTopColor: "background.default"
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <IconButton size="small" sx={{ color: "text.secondary", bgcolor: "background.default" }}>
                          {isExpanded ? <KeyboardArrowDownRounded /> : <KeyboardArrowRightRounded />}
                        </IconButton>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
                          {moduleName} Module
                        </Typography>
                        <Chip label={`${perms.length} actions`} size="small" sx={{ height: 20, fontSize: "0.75rem", fontWeight: 600 }} />
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Collapsible Permission Rows */}
                  {isExpanded &&
                    perms.map((perm) => (
                      <TableRow key={perm.permissionId} sx={{ "&:last-child td": { borderBottom: isExpanded ? "1px solid rgba(224, 224, 224, 1)" : 0 } }}>
                        <TableCell sx={{ color: "text.secondary", pl: 6, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {perm.actionName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 0.2 }}>
                            {perm.permissionCode}
                          </Typography>
                        </TableCell>

                        {roles.map((role) => {
                          const isChecked = matrixState[role.roleId]?.has(perm.permissionId) || false;
                          return (
                            <TableCell
                              key={role.roleId}
                              align="center"
                              sx={{
                                borderBottom: "1px solid",
                                borderLeft: "1px solid",
                                borderColor: "divider",
                                bgcolor: isChecked ? alpha("#10b981", 0.03) : "transparent",
                                py: 1,
                              }}
                            >
                              <Tooltip title={role.isSystemRole ? "System roles cannot be modified" : `Toggle ${perm.actionName} for ${role.roleName}`}>
                                <span>
                                  <Switch
                                    checked={isChecked}
                                    onChange={() => handleToggle(role.roleId, perm.permissionId, role.isSystemRole)}
                                    disabled={role.isSystemRole}
                                    size="small"
                                    sx={{
                                      "& .MuiSwitch-switchBase.Mui-checked": {
                                        color: "#10b981",
                                        "&:hover": { bgcolor: alpha("#10b981", 0.1) },
                                      },
                                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                        bgcolor: "#10b981",
                                      },
                                    }}
                                  />
                                </span>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bulk Action Menu */}
      <Menu anchorEl={anchorEl.element} open={Boolean(anchorEl.element)} onClose={handleBulkActionClose} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <MenuItem onClick={handleBulkEnable} sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#10b981", py: 1.5 }}>
          <ChecklistRounded fontSize="small" sx={{ mr: 1.5 }} /> Enable All
        </MenuItem>
        <MenuItem onClick={handleBulkDisable} sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#ef4444", py: 1.5 }}>
          <RemoveDoneRounded fontSize="small" sx={{ mr: 1.5 }} /> Disable All
        </MenuItem>
      </Menu>
    </Box>
  );
}
