import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  AddRounded,
  SearchRounded,
  EditRounded,
  DeleteRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  status: string;
  isActive: boolean;
  hospital: { hospitalName: string };
  role: { roleName: string };
}

export default function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Delete Dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/rbac/users", {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: search || undefined,
        },
      });
      setUsers(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [page, rowsPerPage, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(`/rbac/users/${deleteId}`);
      setDeleteId(null);
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#f8fafc", mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Manage hospital administrators and staff members
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/rbac/users/add")}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            px: 3,
            py: 1,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          Add User
        </Button>
      </Box>

      <Card
        sx={{
          bgcolor: "#1e293b",
          backgroundImage: "none",
          borderRadius: 3,
          border: "1px solid rgba(255, 255, 255, 0.05)",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 2, display: "flex", gap: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
          <TextField
            placeholder="Search by name, email, or employee code..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              width: 350,
              "& .MuiOutlinedInput-root": {
                color: "#f1f5f9",
                bgcolor: "rgba(15, 23, 42, 0.5)",
                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                "&.Mui-focused fieldset": { borderColor: "#6366f1" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded sx={{ color: "#64748b" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.5)" }}>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Name</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Hospital</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Role</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Contact</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Status</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <CircularProgress sx={{ color: "#6366f1" }} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "#64748b", borderBottom: "none" }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.userId}
                    sx={{
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" },
                    }}
                  >
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f1f5f9" }}>
                      <Typography variant="body2" fontWeight={600}>
                        {user.firstName} {user.lastName}
                      </Typography>
                      {user.employeeCode && (
                        <Typography variant="caption" sx={{ color: "#64748b" }}>
                          ID: {user.employeeCode}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                      {user.hospital?.hospitalName}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Chip
                        label={user.role?.roleName}
                        size="small"
                        sx={{
                          bgcolor: "rgba(99, 102, 241, 0.1)",
                          color: "#818cf8",
                          borderRadius: 1,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                      <Typography variant="body2">{user.email}</Typography>
                      {user.phone && <Typography variant="caption">{user.phone}</Typography>}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Chip
                        label={user.status}
                        size="small"
                        sx={{
                          bgcolor: user.status === "active" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                          color: user.status === "active" ? "#34d399" : "#fbbf24",
                          textTransform: "capitalize",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Tooltip title="Edit">
                        <IconButton
                          onClick={() => navigate(`/rbac/users/edit/${user.userId}`)}
                          sx={{ color: "#94a3b8", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => setDeleteId(user.userId)}
                          sx={{ color: "#94a3b8", "&:hover": { color: "#ef4444", bgcolor: "rgba(239, 68, 68, 0.1)" } }}
                        >
                          <DeleteRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{
            color: "#94a3b8",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            "& .MuiTablePagination-selectIcon": { color: "#94a3b8" },
          }}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => !deleteLoading && setDeleteId(null)}
        PaperProps={{
          sx: {
            bgcolor: "#1e293b",
            color: "#f1f5f9",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }
        }}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "#94a3b8" }}>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setDeleteId(null)} 
            disabled={deleteLoading}
            sx={{ color: "#94a3b8" }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
