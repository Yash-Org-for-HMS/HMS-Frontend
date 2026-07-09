import { useState } from "react";
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
  TextField,
  InputAdornment,
} from "@mui/material";
import { AddRounded, EditRounded, DeleteRounded, DynamicFormRounded, SearchRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import PageHeader from "../../../components/layout/PageHeader";
import { ListSkeleton } from "../../../components/TableRowsSkeleton";
import { useTableSort } from "../../../components/table/useTableSort";
import SortableHeadCell from "../../../components/table/SortableHeadCell";
import { useConfirm } from "../../../contexts/ConfirmContext";

// Match the file's existing sentence-case fontWeight-600 header look (override SortableHeadCell's default uppercase/700 style).
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 600, fontSize: "0.875rem", py: undefined };

export default function FormTemplatesList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [q, setQ] = useState("");

  const { data: templates = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["hospital-form-templates"],
    queryFn: async () => (await axiosInstance.get("/hospital/form-builder")).data.data,
  });

  const term = q.trim().toLowerCase();
  const filtered = term
    ? templates.filter((t) => (t.formName || "").toLowerCase().includes(term) || (t.formType || "").toLowerCase().includes(term) || (t.description || "").toLowerCase().includes(term))
    : templates;

  const { sorted, orderBy, order, onSort } = useTableSort(filtered, {
    name: (t) => t.formName ?? null,
    category: (t) => t.formType ?? null,
    fields: (t) => t.fieldsCount ?? null,
    status: (t) => (t.isActive ? "Active" : "Inactive"),
  });

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete form template",
      message: "Are you sure you want to delete this form template? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/hospital/form-builder/${id}`);
      refetch();
    } catch (error) {
      alert((error as any)?.response?.data?.message || "Failed to delete template");
    }
  };

  return (
    <Box>
      <PageHeader
        title="Form Builder"
        subtitle="Design and manage custom forms for Patient Registration, Consent, and more."
        actions={
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
        }
      />

      <TextField
        size="small"
        placeholder="Search forms by name, type, or description…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, width: "100%", maxWidth: 400 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary" }} /></InputAdornment> }}
      />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Form Name" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Category" sortKey="category" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Total Fields" sortKey="fields" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 600, bgcolor: "background.default" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 3, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" title={term ? "No matching forms" : "No custom forms yet"} subtitle={term ? "Try a different search." : 'Click "Create Form" to begin.'} size={120} />
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((t) => (
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
