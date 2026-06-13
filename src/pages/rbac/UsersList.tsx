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
  Alert,
} from "@mui/material";
import {
  AddRounded,
  SearchRounded,
  EditRounded,
  DeleteRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";

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
    <PageContainer>
      <PageHeader
        title="Hospital Staff Management"
        subtitle="Global Support Mode: Manage hospital administrators and staff members across any tenant"
        actions={
          <ActionButton
            accentFrom="#6366f1"
            accentTo="#4f46e5"
            startIcon={<AddRounded />}
            onClick={() => navigate("/rbac/users/add")}
          >
            Add User
          </ActionButton>
        }
      />

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Global Support Mode:</strong> You are viewing staff user accounts for all hospitals on the platform. When adding a user, you will assign them to a specific hospital tenant.
      </Alert>

      <FilterBar>
        <TextField
          placeholder="Search by name, email, or employee code..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            width: 350,
            "& .MuiOutlinedInput-root": {
              color: "text.primary",
              bgcolor: "background.paper",
              "& fieldset": { borderColor: "divider" },
              "&:hover fieldset": { borderColor: "divider" },
              "&.Mui-focused fieldset": { borderColor: "#6366f1" },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        />
      </FilterBar>

      <Card
        sx={{
          bgcolor: "background.paper",
          backgroundImage: "none",
          borderRadius: 3,
          border: "1px solid", borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Name</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Hospital</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Role</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Contact</TableCell>
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Actions</TableCell>
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
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary", borderBottom: "none" }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.userId}
                    sx={{
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary" }}>
                      <Typography variant="body2" fontWeight={600}>
                        {user.firstName} {user.lastName}
                      </Typography>
                      {user.employeeCode && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          ID: {user.employeeCode}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary" }}>
                      {user.hospital?.hospitalName}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary" }}>
                      <Typography variant="body2">{user.email}</Typography>
                      {user.phone && <Typography variant="caption">{user.phone}</Typography>}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Tooltip title="Edit">
                        <IconButton
                          onClick={() => navigate(`/rbac/users/edit/${user.userId}`)}
                          sx={{ color: "text.secondary", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => setDeleteId(user.userId)}
                          sx={{ color: "text.secondary", "&:hover": { color: "#ef4444", bgcolor: "rgba(239, 68, 68, 0.1)" } }}
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
            color: "text.secondary",
            borderTop: "1px solid", borderColor: "divider",
            "& .MuiTablePagination-selectIcon": { color: "text.secondary" },
          }}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => !deleteLoading && setDeleteId(null)}
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            borderRadius: 3,
            border: "1px solid", borderColor: "divider",
          }
        }}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary" }}>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setDeleteId(null)} 
            disabled={deleteLoading}
            sx={{ color: "text.secondary" }}
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
    </PageContainer>
  );
}
