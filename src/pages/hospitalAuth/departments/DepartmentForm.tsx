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
  const [error, setError] = useState<string | null>(null);

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
          setError(err.response?.data?.message || "Failed to load department data");
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
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/departments/${id}`, formData);
      } else {
        await axiosInstance.post("/hospital/departments", formData);
      }
      navigate("/hospital/departments");
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

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            {isEditing ? "Edit Department" : "Add New Department"}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {isEditing ? "Update department details." : "Create a new department for your hospital."}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/departments")}
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

      <Paper sx={{ p: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
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
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
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
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
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
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "#94a3b8" },
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
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "#94a3b8" },
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
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiSvgIcon-root": { color: "#94a3b8" },
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
