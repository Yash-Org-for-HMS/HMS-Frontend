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
  CircularProgress,
} from "@mui/material";
import { AddRounded, EditRounded, DeleteRounded, DynamicFormRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

export default function FormTemplatesList() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axiosInstance.get("/hospital/form-builder");
      setTemplates(response.data.data);
    } catch (error) {
      console.error("Error fetching templates", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this form template?")) return;
    try {
      await axiosInstance.delete(`/hospital/form-builder/${id}`);
      fetchTemplates();
    } catch (error) {
      alert("Failed to delete template");
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Form Builder
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Design and manage custom forms for Patient Registration, Consent, and more.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/hospital/form-builder/new")}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            textTransform: "none",
            fontWeight: 600,
            px: 3,
          }}
        >
          Create Form
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress sx={{ color: "#6366f1" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Form Name</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Total Fields</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary", borderBottom: "none" }}>
                    No custom forms found. Click "Create Form" to begin.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.formTemplateId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 500 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <DynamicFormRounded sx={{ color: "#818cf8", fontSize: 20 }} />
                        {t.formName}
                      </Box>
                      <Typography variant="caption" display="block" sx={{ color: "text.secondary", mt: 0.5, ml: 3.5 }}>
                        {t.description}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip label={t.formType} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.primary" }} />
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip label={`${t.fieldsCount} Fields`} size="small" sx={{ bgcolor: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" }} />
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {t.isActive ? (
                        <Chip label="Active" size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }} />
                      ) : (
                        <Chip label="Inactive" size="small" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }} />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Tooltip title="Edit Form">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hospital/form-builder/${t.formTemplateId}/edit`)}
                          sx={{ color: "#6366f1", mr: 1, "&:hover": { bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Form">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(t.formTemplateId)}
                          sx={{ color: "#f43f5e", "&:hover": { bgcolor: "rgba(244, 63, 94, 0.1)" } }}
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
      )}
    </Box>
  );
}
