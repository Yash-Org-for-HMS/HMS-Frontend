import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import {
  Box,
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
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Typography,
} from "@mui/material";
import { AddRounded, EditRounded, BlockRounded, CheckCircleRounded, SearchRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import type { Department as DepartmentBase } from "@/types";

// Match the file's existing sentence-case header look (override SortableHeadCell's default uppercase/bold style).
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 400, fontSize: "0.875rem", py: undefined };

interface Department extends DepartmentBase {
  departmentCode: string;
  status: string;
  departmentType?: { typeName: string };
  headOfDepartment?: { firstName: string; lastName: string };
  /** Set when this department was copied from the platform's standard list. */
  sysDepartmentCode?: string | null;
  sysDepartment?: { name: string; canAdmitPatients: boolean; hasOpd: boolean; ownsWard: boolean; category?: { name: string } } | null;
}

export default function DepartmentsList() {
  const navigate = useNavigate();
  const toast = useToast();

  // Every hospital holds the whole standard list (126 departments) as copies it
  // switches on as it needs them, so the page asks for all of them — the
  // default page of 50 would silently cut the list — and splits it in two.
  const { data: allDepartments = [], isLoading, isError, error, refetch } = useQuery<Department[]>({
    queryKey: ["hospital-departments"],
    queryFn: async () => (await axiosInstance.get("/hospital/departments", { params: { limit: 1000 } })).data.data,
  });
  const [view, setView] = useState<"active" | "inactive">("active");
  const [q, setQ] = useState("");
  const inUse = useMemo(() => allDepartments.filter((d) => d.status === "active"), [allDepartments]);
  const off = useMemo(() => allDepartments.filter((d) => d.status !== "active"), [allDepartments]);
  const departments = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = view === "active" ? inUse : off;
    if (!term) return list;
    return list.filter((d) => `${d.departmentName} ${d.departmentCode} ${d.sysDepartment?.category?.name ?? ""}`.toLowerCase().includes(term));
  }, [view, inUse, off, q]);

  const { sorted, orderBy, order, onSort } = useTableSort(departments, {
    name: (d) => d.departmentName,
    code: (d) => d.departmentCode,
    type: (d) => d.sysDepartment?.category?.name ?? d.departmentType?.typeName ?? null,
    head: (d) => d.headOfDepartment ? `${d.headOfDepartment.firstName} ${d.headOfDepartment.lastName}` : null,
    status: (d) => d.status,
  });

  const handleToggleStatus = async (department: Department) => {
    try {
      const newStatus = department.status === "active" ? "inactive" : "active";
      await axiosInstance.put(`/hospital/departments/${department.departmentId}`, {
        status: newStatus,
      });
      toast.success(newStatus === "active" ? `${department.departmentName} is now in use` : `${department.departmentName} switched off`);
      refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update department status"));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Departments"
        subtitle="The departments your hospital runs. The standard list holds every department a hospital might have — switch on the ones you use."
        actions={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => navigate("/hospital/departments/new")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              px: 3,
            }}
          >
            Add Department
          </Button>
        }
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 40, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40 } }}>
          <Tab value="active" label={`In use (${inUse.length})`} />
          <Tab value="inactive" label={`Switched off (${off.length})`} />
        </Tabs>
        <TextField
          size="small" placeholder={view === "active" ? "Search departments" : "Search the standard list"}
          value={q} onChange={(e) => setQ(e.target.value)} sx={{ ml: "auto", minWidth: 260 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "calc(100vh - 300px)" }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <SortableHeadCell label="Name" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
              <SortableHeadCell label="Code" sortKey="code" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
              <SortableHeadCell label="Group" sortKey="type" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
              <SortableHeadCell label="Head of Department" sortKey="head" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
              <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
              <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={6} columns={6} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                  <Mascot
                    pose="nothing-here-yet"
                    title={q ? "Nothing matches" : view === "active" ? "No departments in use yet" : "Nothing switched off"}
                    subtitle={q ? "Try another word." : view === "active" ? "Switch one on from the standard list, or add your own." : "Every department is in use."}
                    size={120}
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((dept) => (
                <TableRow key={dept.departmentId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.departmentName}
                    {dept.sysDepartment && (
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                        Standard
                        {[dept.sysDepartment.canAdmitPatients && "admits", dept.sysDepartment.hasOpd && "OPD", dept.sysDepartment.ownsWard && "owns a ward"].filter(Boolean).map((t) => ` · ${t}`).join("")}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.departmentCode}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {dept.sysDepartment?.category?.name || dept.departmentType?.typeName || "-"}
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
                        color: dept.status === "active" ? SEMANTIC.successLight : SEMANTIC.dangerLight,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                    {view === "inactive" && (
                      <Button size="small" variant="outlined" startIcon={<CheckCircleRounded />} onClick={() => handleToggleStatus(dept)}
                        sx={{ textTransform: "none", fontWeight: 600, mr: 1 }}>
                        Switch on
                      </Button>
                    )}
                    <Tooltip title="Edit Department">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/hospital/departments/${dept.departmentId}/edit`)}
                        sx={{ color: "text.secondary", "&:hover": { color: BRAND.action, bgcolor: "rgba(12, 115, 181, 0.1)" } }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {view === "active" && <Tooltip title="Switch off">
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(dept)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": {
                            color: dept.status === "active" ? SEMANTIC.dangerLight : SEMANTIC.successLight,
                            bgcolor: dept.status === "active" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                          },
                        }}
                      >
                        {dept.status === "active" ? <BlockRounded fontSize="small" /> : <CheckCircleRounded fontSize="small" />}
                      </IconButton>
                    </Tooltip>}
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
