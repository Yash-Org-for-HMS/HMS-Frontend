import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import { AddRounded, EditRounded, PowerSettingsNewRounded } from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";

const LOOKUP_CONFIGS: Record<string, any> = {
  specialization: {
    label: "Specializations",
    idField: "specializationId",
    columns: [
      { field: "specializationCode", label: "Code" },
      { field: "specializationName", label: "Name" },
      { field: "associatedDepartment", label: "Associated Department" }
    ],
  },
  departmentType: {
    label: "Department Types",
    idField: "departmentTypeId",
    columns: [
      { field: "typeName", label: "Type Name" }
    ],
  },
  documentType: {
    label: "Document Types",
    idField: "documentTypeId",
    columns: [
      { field: "typeCode", label: "Type Code" },
      { field: "typeName", label: "Type Name" }
    ],
  },
  appointmentStatus: {
    label: "Appointment Statuses",
    idField: "appointmentStatusId",
    columns: [
      { field: "statusCode", label: "Status Code" },
      { field: "statusLabel", label: "Status Label" },
      { field: "colorHex", label: "Color Hex" },
      { field: "allowReschedule", label: "Allow Reschedule (Yes/No)" }
    ],
  }
};

export default function LookupManager() {
  const [selectedType, setSelectedType] = useState("specialization");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const config = LOOKUP_CONFIGS[selectedType];

  useEffect(() => {
    fetchData(selectedType);
  }, [selectedType]);

  const fetchData = async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`/hospital/lookups?type=${type}`);
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load lookup data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({});
    setIsEditing(false);
    setEditingId(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setFormData({ ...item });
    setIsEditing(true);
    setEditingId(item[config.idField]);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setFormData({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (isEditing && editingId) {
        await axiosInstance.put(`/hospital/lookups/${editingId}?type=${selectedType}`, formData);
      } else {
        await axiosInstance.post(`/hospital/lookups?type=${selectedType}`, formData);
      }
      handleClose();
      fetchData(selectedType);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save");
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      const id = item[config.idField];
      await axiosInstance.put(`/hospital/lookups/${id}/status?type=${selectedType}`, {
        isActive: !item.isActive
      });
      fetchData(selectedType);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to toggle status");
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            Master Data Management
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Configure system dropdowns and settings without code changes.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Select Lookup Table"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              InputLabelProps={{ style: { color: "#94a3b8" } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#f1f5f9",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" }
                },
              }}
            >
              {Object.entries(LOOKUP_CONFIGS).map(([key, c]) => (
                <MenuItem key={key} value={key}>{c.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: "right" }}>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={handleOpenAdd}
              sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1.5, px: 3, fontWeight: 600 }}
            >
              Add New Record
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress sx={{ color: "#6366f1" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                {config.columns.map((col: any) => (
                  <TableCell key={col.field} sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>
                  Status
                </TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={config.columns.length + 2} align="center" sx={{ py: 4, color: "#94a3b8", borderBottom: "none" }}>
                    No records found for {config.label}.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item[config.idField]} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    {config.columns.map((col: any) => (
                      <TableCell key={col.field} sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {item[col.field]}
                      </TableCell>
                    ))}
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Chip
                        label={item.isActive ? "Active" : "Inactive"}
                        size="small"
                        sx={{
                          bgcolor: item.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: item.isActive ? "#34d399" : "#f87171",
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Tooltip title="Edit Record">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(item)}
                          sx={{ color: "#38bdf8", mr: 1, "&:hover": { bgcolor: "rgba(56, 189, 248, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={item.isActive ? "Deactivate" : "Activate"}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(item)}
                          sx={{
                            color: item.isActive ? "#f87171" : "#10b981",
                            "&:hover": { bgcolor: item.isActive ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)" }
                          }}
                        >
                          <PowerSettingsNewRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dynamic Modal */}
      <Dialog open={modalOpen} onClose={handleClose} PaperProps={{ sx: { bgcolor: "#1e293b", color: "#f1f5f9", width: "400px" } }}>
        <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", mb: 2 }}>
          {isEditing ? `Edit ${config.label.slice(0, -1)}` : `Add ${config.label.slice(0, -1)}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {config.columns.map((col: any) => (
              <TextField
                key={col.field}
                fullWidth
                label={col.label}
                name={col.field}
                value={formData[col.field] || ""}
                onChange={handleChange}
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "#f1f5f9",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiInputLabel-root": { color: "#94a3b8" }
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleClose} sx={{ color: "#94a3b8" }}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
