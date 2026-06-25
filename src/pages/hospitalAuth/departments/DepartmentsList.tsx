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
import { AddRounded, EditRounded, BlockRounded, CheckCircleRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";
import { TableRowsSkeleton } from "../../../components/TableRowsSkeleton";

interface Department {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  status: string;
  departmentType?: { typeName: string };
  headOfDepartment?: { firstName: string; lastName: string };
}

export default function DepartmentsList() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: departments = [], isLoading, isError, error, refetch } = useQuery<Department[]>({
    queryKey: ["hospital-departments"],
    queryFn: async () => (await axiosInstance.get("/hospital/departments")).data.data,
  });

  const handleToggleStatus = async (department: Department) => {
    try {
      const newStatus = department.status === "active" ? "inactive" : "active";
      await axiosInstance.put(`/hospital/departments/${department.departmentId}`, {
        status: newStatus,
      });
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to update department status");
    }
  };

  return (
    <Box>
      <PageHeader
        title="Departments"
        subtitle="Manage your hospital's departments and clinical units."
        actions={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => navigate("/hospital/departments/new")}
            sx={{
              bgcolor: "#6366f1",
              "&:hover": { bgcolor: "#4f46e5" },
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            Add Department
          </Button>
        }
      />

      <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Name</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Code</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Type</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Head of Department</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
              <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={6} columns={6} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                </TableCell>
              </TableRow>
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <Mascot pose="nothing-here-yet" title="No departments yet" subtitle="Create one to get started." size={120} />
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.departmentId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.departmentName}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.departmentCode}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.departmentType?.typeName || "-"}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.headOfDepartment ? `${dept.headOfDepartment.firstName} ${dept.headOfDepartment.lastName}` : "-"}
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                    <Chip
                      label={dept.status === "active" ? "Active" : "Inactive"}
                      size="small"
                      sx={{
                        bgcolor: dept.status === "active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: dept.status === "active" ? "#34d399" : "#f87171",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                    <Tooltip title="Edit Department">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hospital/departments/${dept.departmentId}/edit`)}
                        sx={{ color: "text.secondary", "&:hover": { color: "#6366f1", bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={dept.status === "active" ? "Disable Department" : "Enable Department"}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(dept)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": {
                            color: dept.status === "active" ? "#f87171" : "#34d399",
                            bgcolor: dept.status === "active" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                          },
                        }}
                      >
                        {dept.status === "active" ? <BlockRounded fontSize="small" /> : <CheckCircleRounded fontSize="small" />}
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
