import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
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
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";

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
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const config = LOOKUP_CONFIGS[selectedType];

  const { data = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["hospital-lookups", selectedType],
    queryFn: async () => (await axiosInstance.get(`/hospital/lookups?type=${selectedType}`)).data.data,
  });

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
      refetch();
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
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to toggle status");
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <PageHeader
        title="Master Data Management"
        subtitle="Configure system dropdowns and settings without code changes."
      />

      <Paper sx={{ p: 3, mb: 4, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              fullWidth
              label="Select Lookup Table"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              InputLabelProps={{ style: { color: "text.secondary" } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "text.primary",
                  "& fieldset": { borderColor: "divider" },
                  "&:hover fieldset": { borderColor: "divider" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" }
                },
              }}
            >
              {Object.entries(LOOKUP_CONFIGS).map(([key, c]) => (
                <MenuItem key={key} value={key}>{c.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: "right" }}>
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
{loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                {config.columns.map((col: any) => (
                  <TableCell key={col.field} sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>
                  Status
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={config.columns.length + 2} sx={{ py: 3, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle={`No records found for ${config.label}.`} size={120} />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item[config.idField]} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    {config.columns.map((col: any) => (
                      <TableCell key={col.field} sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                        {item[col.field]}
                      </TableCell>
                    ))}
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
      <Dialog open={modalOpen} onClose={handleClose} PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", width: "400px" } }}>
        <DialogTitle sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
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
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiInputLabel-root": { color: "text.secondary" }
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleClose} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
