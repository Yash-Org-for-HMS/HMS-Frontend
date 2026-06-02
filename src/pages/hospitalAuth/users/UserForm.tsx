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
  Tabs,
  Tab,
  Divider,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

interface Role {
  roleId: string;
  roleName: string;
}

interface Department {
  departmentId: string;
  departmentName: string;
}

interface Branch {
  branchId: string;
  branchName: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roleId: "",
    employeeCode: "",
    departmentId: "",
    branchId: "",
    dateOfJoining: "",
    designation: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const ddRes = await axiosInstance.get("/hospital/users/dropdowns");
        setRoles(ddRes.data.data.roles);
        setDepartments(ddRes.data.data.departments);
        setBranches(ddRes.data.data.branches);

        if (isEditing) {
          const res = await axiosInstance.get(`/hospital/users/${id}`);
          const user = res.data.data;
          setFormData({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            phone: user.phone || "",
            roleId: user.roleId || "",
            employeeCode: user.employeeCode || "",
            departmentId: user.departmentId || "",
            branchId: user.branchId || "",
            dateOfJoining: user.dateOfJoining ? new Date(user.dateOfJoining).toISOString().split("T")[0] : "",
            designation: user.designation || "",
            addressLine1: user.addressLine1 || "",
            addressLine2: user.addressLine2 || "",
            city: user.city || "",
            state: user.state || "",
            postalCode: user.postalCode || "",
            emergencyContactName: user.emergencyContactName || "",
            emergencyContactPhone: user.emergencyContactPhone || "",
            emergencyContactRelation: user.emergencyContactRelation || "",
          });
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setInitialLoad(false);
      }
    };
    loadData();
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/users/${id}`, formData);
      } else {
        await axiosInstance.post("/hospital/users", formData);
      }
      navigate("/hospital/users");
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

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "#94a3b8" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "#f1f5f9",
        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
      },
      "& .MuiSvgIcon-root": { color: "#94a3b8" },
    },
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            {isEditing ? "Edit Staff" : "Add New Staff"}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {isEditing ? "Update staff member details." : "Create a new staff member profile."}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/users")}
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
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              borderBottom: 1,
              borderColor: "rgba(255,255,255,0.1)",
              "& .MuiTab-root": { color: "#94a3b8", textTransform: "none", fontSize: "1rem" },
              "& .Mui-selected": { color: "#6366f1" },
              "& .MuiTabs-indicator": { backgroundColor: "#6366f1" },
            }}
          >
            <Tab label="Personal & Role" />
            <Tab label="Employment" />
            <Tab label="Contact & Emergency" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isEditing}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="User Role / Type"
                  name="roleId"
                  value={formData.roleId}
                  onChange={handleChange}
                  required
                  {...textFieldProps}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.roleId} value={role.roleId}>
                      {role.roleName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Employee Code"
                  name="employeeCode"
                  value={formData.employeeCode}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Date of Joining"
                  name="dateOfJoining"
                  type="date"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  {...textFieldProps}
                  slotProps={{ inputLabel: { shrink: true, style: { color: "#94a3b8" } } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Assign Department"
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  {...textFieldProps}
                >
                  <MenuItem value="">None</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept.departmentId} value={dept.departmentId}>
                      {dept.departmentName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Assign Branch"
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleChange}
                  {...textFieldProps}
                >
                  <MenuItem value="">None</MenuItem>
                  {branches.map((branch) => (
                    <MenuItem key={branch.branchId} value={branch.branchId}>
                      {branch.branchName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2 }}>Contact Details</Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Address Line 1"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Address Line 2"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="State/Province"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Postal Code"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.1)" }} />
            <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2 }}>Emergency Contact</Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Name"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Phone"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Relationship"
                  name="emergencyContactRelation"
                  value={formData.emergencyContactRelation}
                  onChange={handleChange}
                  {...textFieldProps}
                />
              </Grid>
            </Grid>
          </TabPanel>

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4, borderTop: "1px solid rgba(255,255,255,0.1)", pt: 3 }}>
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
              {loading ? "Saving..." : "Save Staff Member"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
