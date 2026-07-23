import { useState, useEffect } from "react";
import { ACCENTS } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import FormSkeleton from "@/components/skeletons/FormSkeleton";
import { validate, hasErrors, required, type Errors } from "@/utils/validation";

interface DepartmentType {
  departmentTypeId: number;
  typeName: string;
}

import type { StaffUser as User } from "@/types";

export default function DepartmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    departmentName: "",
    departmentCode: "",
    departmentTypeId: "",
    headOfDepartmentId: "",
    status: "active",
    location: "",
    phoneExtension: "",
    opdHours: "",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  const { data: departmentTypes = [] } = useQuery<DepartmentType[]>({
    queryKey: ["department-types"],
    queryFn: async () => (await axiosInstance.get("/hospital/departments/types")).data.data || [],
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["department-head-users"],
    queryFn: async () => (await axiosInstance.get("/hospital/departments/users")).data.data || [],
  });

  const { data: deptData, isLoading: initialLoad, isError, error, refetch } = useQuery({
    queryKey: ["department", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/departments/${id}`)).data.data,
    enabled: isEditing,
  });

  // Seed the form with the existing department when editing.
  useEffect(() => {
    if (!deptData) return;
    const dept = deptData;
    setFormData({
      departmentName: dept.departmentName || "",
      departmentCode: dept.departmentCode || "",
      departmentTypeId: dept.departmentTypeId ? String(dept.departmentTypeId) : "",
      headOfDepartmentId: dept.headOfDepartmentId || "",
      status: dept.status || "active",
      location: dept.location || "",
      phoneExtension: dept.phoneExtension || "",
      opdHours: dept.opdHours || "",
    });
  }, [deptData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name as keyof typeof formData] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate(formData, {
      departmentName: [required("Department name")],
      departmentCode: [required("Department code")],
    });
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/departments/${id}`, formData);
      } else {
        await axiosInstance.post("/hospital/departments", formData);
      }
      navigate("/hospital/departments");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "An error occurred"));
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <FormSkeleton />
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load department" message={apiErrorText(error)} onRetry={() => refetch()} />;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <PageHeader
        title={isEditing ? "Edit Department" : "Add New Department"}
        subtitle={isEditing ? "Update department details." : "Create a new department for your hospital."}
        actions={
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/departments")}
            sx={{ color: "text.secondary", borderColor: "divider" }}
          >
            Cancel
          </Button>
        }
      />
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
                error={!!errors.departmentName}
                helperText={errors.departmentName}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
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
                error={!!errors.departmentCode}
                helperText={errors.departmentCode}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
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
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
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
                helperText="Optional — you can assign this later, after adding staff."
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
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

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Location (e.g. Block B, 2nd Floor)"
                name="location"
                value={formData.location}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Phone Extension (e.g. 204)"
                name="phoneExtension"
                value={formData.phoneExtension}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="OPD Hours (e.g. Mon–Sat, 9:00 AM – 1:00 PM)"
                name="opdHours"
                value={formData.opdHours}
                onChange={handleChange}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
                  },
                }}
              />
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
                    "&.Mui-focused fieldset": { borderColor: ACCENTS.hospital },
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
                    bgcolor: ACCENTS.hospital,
                    "&:hover": { bgcolor: ACCENTS.hospitalDark },
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
