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
import { AddRounded, EditRounded, BlockRounded, CheckCircleRounded, KeyRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  isActive: boolean;
  role?: { roleName: string };
  department?: { departmentName: string };
  branch?: { branchName: string };
}

export default function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get("/hospital/users");
      setUsers(response.data.data);
    } catch (error) {
      console.error("Error fetching users", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: User) => {
    try {
      await axiosInstance.put(`/hospital/users/${user.userId}/deactivate`, {
        isActive: !user.isActive,
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status", error);
    }
  };

  const handleResetPassword = async (user: User) => {
    if (window.confirm(`Are you sure you want to reset the password for ${user.firstName}?`)) {
      try {
        await axiosInstance.post(`/hospital/users/${user.userId}/reset-password`);
        alert("Password reset to default (Password@123)");
      } catch (error) {
        console.error("Error resetting password", error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            Staff & Users
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Manage your hospital's staff, roles, and assignments.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/hospital/users/new")}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            textTransform: "none",
            fontWeight: 600,
            px: 3,
          }}
        >
          Add Staff
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Name</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Role</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Department</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Branch</TableCell>
              <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Status</TableCell>
              <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8", borderBottom: "none" }}>
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.userId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Typography variant="body2" sx={{ color: "#f8fafc", fontWeight: 500 }}>
                      {user.firstName} {user.lastName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                      {user.email} {user.employeeCode && `| ${user.employeeCode}`}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {user.role?.roleName || "-"}
                  </TableCell>
                  <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {user.department?.departmentName || "-"}
                  </TableCell>
                  <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {user.branch?.branchName || "-"}
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Chip
                      label={user.isActive ? "Active" : "Inactive"}
                      size="small"
                      sx={{
                        bgcolor: user.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: user.isActive ? "#34d399" : "#f87171",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <Tooltip title="Reset Password">
                      <IconButton
                        size="small"
                        onClick={() => handleResetPassword(user)}
                        sx={{ color: "#94a3b8", "&:hover": { color: "#eab308", bgcolor: "rgba(234, 179, 8, 0.1)" } }}
                      >
                        <KeyRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Staff">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hospital/users/${user.userId}/edit`)}
                        sx={{ color: "#94a3b8", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.isActive ? "Deactivate User" : "Activate User"}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(user)}
                        sx={{
                          color: "#94a3b8",
                          "&:hover": {
                            color: user.isActive ? "#f87171" : "#34d399",
                            bgcolor: user.isActive ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                          },
                        }}
                      >
                        {user.isActive ? <BlockRounded fontSize="small" /> : <CheckCircleRounded fontSize="small" />}
                      </IconButton>
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
