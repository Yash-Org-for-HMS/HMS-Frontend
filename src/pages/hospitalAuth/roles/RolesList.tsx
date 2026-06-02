import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import { AddRounded, EditRounded, BlockRounded, CheckCircleRounded, ContentCopyRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

interface Role {
  roleId: string;
  roleName: string;
  roleCode: string;
  isSystemRole: boolean;
  status: string;
  _count?: {
    users: number;
  };
}

export default function RolesList() {
  const [roles, setRoles] = useState<Role[]>([]);
  const navigate = useNavigate();

  const fetchRoles = async () => {
    try {
      const response = await axiosInstance.get("/hospital/roles");
      setRoles(response.data.data);
    } catch (error) {
      console.error("Error fetching roles", error);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleToggleStatus = async (role: Role) => {
    if (role.isSystemRole && role.status === 'active') {
      alert("Cannot disable standard system roles.");
      return;
    }
    
    try {
      const newStatus = role.status === 'active' ? 'inactive' : 'active';
      await axiosInstance.put(`/hospital/roles/${role.roleId}/status`, {
        status: newStatus,
      });
      fetchRoles();
    } catch (error) {
      console.error("Error toggling role status", error);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            Role Management (RBAC)
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Manage hospital roles, system permissions, and view user assignments.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/hospital/roles/new")}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            textTransform: "none",
            fontWeight: 600,
            px: 3,
          }}
        >
          Create Custom Role
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Role Name</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Code</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Type</TableCell>
              <TableCell align="center" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Users Assigned</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Status</TableCell>
              <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8", borderBottom: "none" }}>
                  No roles found.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.roleId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f8fafc", fontWeight: 500 }}>
                    {role.roleName}
                  </TableCell>
                  <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Chip label={role.roleCode} size="small" sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#94a3b8", fontFamily: "monospace" }} />
                  </TableCell>
                  <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {role.isSystemRole ? (
                       <Chip label="System Default" size="small" sx={{ bgcolor: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", fontWeight: 600 }} />
                    ) : (
                       <Chip label="Custom Role" size="small" sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#a78bfa", fontWeight: 600 }} />
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {role._count?.users || 0}
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Chip
                      label={role.status === 'active' ? "Active" : "Inactive"}
                      size="small"
                      sx={{
                        bgcolor: role.status === 'active' ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: role.status === 'active' ? "#34d399" : "#f87171",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Tooltip title="Clone Role">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hospital/roles/new?clone=${role.roleId}`)}
                        sx={{ color: "#94a3b8", "&:hover": { color: "#38bdf8", bgcolor: "rgba(56, 189, 248, 0.1)" } }}
                      >
                        <ContentCopyRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={role.isSystemRole ? "System Roles Cannot Be Edited" : "Edit Role"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={role.isSystemRole}
                          onClick={() => navigate(`/hospital/roles/${role.roleId}/edit`)}
                          sx={{ color: "#94a3b8", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title={role.status === 'active' ? "Disable Role" : "Enable Role"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={role.isSystemRole}
                          onClick={() => handleToggleStatus(role)}
                          sx={{
                            color: "#94a3b8",
                            "&:hover": {
                              color: role.status === 'active' ? "#f87171" : "#34d399",
                              bgcolor: role.status === 'active' ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                            },
                          }}
                        >
                          {role.status === 'active' ? <BlockRounded fontSize="small" /> : <CheckCircleRounded fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
