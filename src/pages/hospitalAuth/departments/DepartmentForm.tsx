import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import { useToast } from "../../../contexts/ToastContext";

interface DepartmentType {
  departmentTypeId: number;
  typeName: string;
}

interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function DepartmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(isEditing);
  const toast = useToast();
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    departmentName: "",
    departmentCode: "",
    departmentTypeId: "",
    headOfDepartmentId: "",
    status: "active",
  });

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [typesRes, usersRes] = await Promise.all([
          axiosInstance.get("/hospital/departments/types"),
          axiosInstance.get("/hospital/departments/users")
        ]);
        setDepartmentTypes(typesRes.data.data || []);
        setUsers(usersRes.data.data || []);
      } catch (err) {
        console.error("Failed to load dropdown data");
      }
    };
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (isEditing) {
      const fetchDepartment = async () => {
        try {
          const response = await axiosInstance.get(`/hospital/departments/${id}`);
          const dept = response.data.data;
          setFormData({
            departmentName: dept.departmentName || "",
            departmentCode: dept.departmentCode || "",
            departmentTypeId: dept.departmentTypeId ? String(dept.departmentTypeId) : "",
            headOfDepartmentId: dept.headOfDepartmentId || "",
            status: dept.status || "active",
          });
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to load department data");
        } finally {
          setInitialLoad(false);
        }
      };
      fetchDepartment();
    }
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/departments/${id}`, formData);
      } else {
        await axiosInstance.post("/hospital/departments", formData);
      }
      navigate("/hospital/departments");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred");
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

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            {isEditing ? "Edit Department" : "Add New Department"}
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {isEditing ? "Update department details." : "Create a new department for your hospital."}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/departments")}
          sx={{ color: "text.secondary", borderColor: "divider" }}
        >
          Cancel
        </Button>
      </Box>
<Paper sx={{ p: 4, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Department Name"
                name="departmentName"
                value={formData.departmentName}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Department Code (e.g. CARDIO)"
                name="departmentCode"
                value={formData.departmentCode}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Department Type"
                name="departmentTypeId"
                value={formData.departmentTypeId}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "text.secondary" },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {departmentTypes.map((type) => (
                  <MenuItem key={type.departmentTypeId} value={type.departmentTypeId.toString()}>
                    {type.typeName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Head of Department"
                name="headOfDepartmentId"
                value={formData.headOfDepartmentId}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "text.secondary" },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.userId} value={user.userId}>
                    {user.firstName} {user.lastName} ({user.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "text.secondary" },
                }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
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
                  {loading ? "Saving..." : "Save Department"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}
