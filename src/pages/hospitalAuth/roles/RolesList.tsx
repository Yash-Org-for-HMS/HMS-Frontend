import { useQuery } from "@tanstack/react-query";
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
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";

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
  const navigate = useNavigate();
  const toast = useToast();

  const { data: roles = [], isError, error, refetch } = useQuery<Role[]>({
    queryKey: ["hospital-roles"],
    queryFn: async () => (await axiosInstance.get("/hospital/roles")).data.data,
  });

  const handleToggleStatus = async (role: Role) => {
    if (role.isSystemRole && role.status === 'active') {
      toast.error("Cannot disable standard system roles.");
      return;
    }

    try {
      const newStatus = role.status === 'active' ? 'inactive' : 'active';
      await axiosInstance.put(`/hospital/roles/${role.roleId}/status`, {
        status: newStatus,
      });
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to update role status");
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Role Management (RBAC)
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
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

      <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Role Name</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Code</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Type</TableCell>
              <TableCell align="center" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Users Assigned</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
              <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <Mascot pose="nothing-here-yet" subtitle="No roles found." size={120} />
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.roleId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 500 }}>
                    {role.roleName}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Chip label={role.roleCode} size="small" sx={{ bgcolor: "action.hover", color: "text.secondary", fontFamily: "monospace" }} />
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {role.isSystemRole ? (
                       <Chip label="System Default" size="small" sx={{ bgcolor: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", fontWeight: 600 }} />
                    ) : (
                       <Chip label="Custom Role" size="small" sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#a78bfa", fontWeight: 600 }} />
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {role._count?.users || 0}
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
                  <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                    <Tooltip title="Clone Role">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hospital/roles/new?clone=${role.roleId}`)}
                        sx={{ color: "text.secondary", "&:hover": { color: "#38bdf8", bgcolor: "rgba(56, 189, 248, 0.1)" } }}
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
                          sx={{ color: "text.secondary", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
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
                            color: "text.secondary",
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
