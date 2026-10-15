import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { USER_DROPDOWNS_KEY } from "@/features/hospitalAuth/users/queryKeys";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Typography,
  Collapse,
  Skeleton,
} from "@mui/material";
import { AddRounded, EditRounded, BlockRounded, CheckCircleRounded, SearchRounded, ExpandMoreRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import type { Department as DepartmentBase } from "@/types";

interface Department extends DepartmentBase {
  departmentCode: string;
  status: string;
  headOfDepartment?: { firstName: string; lastName: string } | null;
  /** Set when this department was copied from the platform's standard list. */
  sysDepartmentCode?: string | null;
  sysDepartment?: { canAdmitPatients: boolean; hasOpd: boolean; ownsWard: boolean; category?: { code: string; name: string; sortOrder: number } } | null;
}

interface Group { key: string; name: string; order: number; rows: Department[] }

/** The workbook's ten department groups, in its order; the hospital's own departments last. */
function groupDepartments(list: Department[]): Group[] {
  const groups = new Map<string, Group>();
  for (const d of list) {
    const c = d.sysDepartment?.category;
    const key = c?.code ?? "OWN";
    const g = groups.get(key) ?? { key, name: c?.name ?? "Added by the hospital", order: c?.sortOrder ?? 10_000, rows: [] };
    g.rows.push(d);
    groups.set(key, g);
  }
  for (const g of groups.values()) g.rows.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export default function DepartmentsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Every hospital holds the whole standard list (126 departments) as copies it
  // switches on as it needs them. One lean request; grouping happens here.
  const { data: allDepartments = [], isLoading, isError, error, refetch } = useQuery<Department[]>({
    queryKey: ["hospital-departments"],
    queryFn: async () => (await axiosInstance.get("/hospital/departments", { params: { limit: 1000 } })).data.data,
  });
  const [view, setView] = useState<"active" | "inactive">("active");
  const [q, setQ] = useState("");
  const inUse = useMemo(() => allDepartments.filter((d) => d.status === "active"), [allDepartments]);
  const off = useMemo(() => allDepartments.filter((d) => d.status !== "active"), [allDepartments]);
  // A search looks in both tabs; each tab's count says how many it matched there.
  const term = q.trim().toLowerCase();
  const [inUseHits, offHits] = useMemo(() => {
    if (!term) return [inUse, off];
    const hit = (d: Department) => `${d.departmentName} ${d.departmentCode} ${d.sysDepartment?.category?.name ?? ""}`.toLowerCase().includes(term);
    return [inUse.filter(hit), off.filter(hit)];
  }, [inUse, off, term]);
  const departments = view === "active" ? inUseHits : offHits;
  const otherHits = view === "active" ? offHits.length : inUseHits.length;
  const groups = useMemo(() => groupDepartments(departments), [departments]);

  // In use: every group open (it's short). Switched off: groups closed until
  // opened - or while searching, when the matching groups open by themselves.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => (term ? true : toggled[`${view}:${key}`] ?? view === "active");
  const toggle = (key: string) => setToggled((t) => ({ ...t, [`${view}:${key}`]: !isOpen(key) }));

  const handleToggleStatus = async (department: Department) => {
    try {
      const newStatus = department.status === "active" ? "inactive" : "active";
      await axiosInstance.put(`/hospital/departments/${department.departmentId}`, {
        status: newStatus,
      });
      toast.success(newStatus === "active" ? `${department.departmentName} is now in use` : `${department.departmentName} switched off`);
      refetch();
      // The user form offers departments in use, and holds its list for a while.
      void queryClient.invalidateQueries({ queryKey: USER_DROPDOWNS_KEY });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update department status"));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Departments"
        subtitle="The departments your hospital runs, by group. The standard list holds every department a hospital might have - switch on the ones you use."
        actions={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => navigate("/hospital/departments/new")}
            sx={{ textTransform: "none", fontWeight: 600, px: 3 }}
          >
            Add Department
          </Button>
        }
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 40, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40 } }}>
          <Tab value="active" label={`In use (${inUseHits.length})`} />
          <Tab value="inactive" label={`Switched off (${offHits.length})`} />
        </Tabs>
        <TextField
          size="small" placeholder="Search all departments"
          value={q} onChange={(e) => setQ(e.target.value)} sx={{ ml: "auto", minWidth: 260 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
        />
      </Box>

      {isLoading ? (
        <Box sx={{ display: "grid", gap: 1.5 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="rounded" height={52} />)}</Box>
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : groups.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 3, borderRadius: 2 }}>
          <Mascot
            pose="nothing-here-yet"
            title={q ? (otherHits ? `Not ${view === "active" ? "in use" : "switched off"}` : "Nothing matches") : view === "active" ? "No departments in use yet" : "Nothing switched off"}
            subtitle={q ? (otherHits ? "" : "Try another word.") : view === "active" ? "Switch one on from the standard list, or add your own." : "Every department is in use."}
            size={120}
          />
          {q && otherHits > 0 && (
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Button variant="outlined" onClick={() => setView(view === "active" ? "inactive" : "active")} sx={{ textTransform: "none", fontWeight: 600 }}>
                Show {otherHits} {view === "active" ? "switched off" : "in use"}
              </Button>
            </Box>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {groups.map((g) => {
            const open = isOpen(g.key);
            return (
              <Paper key={g.key} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Box
                  role="button" tabIndex={0} aria-expanded={open}
                  onClick={() => toggle(g.key)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(g.key); } }}
                  sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, cursor: term ? "default" : "pointer", bgcolor: "background.default", "&:hover": { bgcolor: term ? undefined : "action.hover" } }}
                >
                  <ExpandMoreRounded fontSize="small" sx={{ color: "text.secondary", transition: "transform .15s", transform: open ? "none" : "rotate(-90deg)" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{g.name}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>· {g.rows.length}</Typography>
                </Box>
                <Collapse in={open} unmountOnExit>
                  <Table size="small">
                    <TableBody>
                      {g.rows.map((dept) => (
                        <TableRow key={dept.departmentId} hover sx={{ "&:last-child td": { border: 0 } }}>
                          <TableCell sx={{ pl: 6.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{dept.departmentName}</Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {dept.sysDepartment
                                ? ["Standard", dept.sysDepartment.canAdmitPatients && "admits", dept.sysDepartment.hasOpd && "OPD", dept.sysDepartment.ownsWard && "owns a ward"].filter(Boolean).join(" · ")
                                : "Added by the hospital"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ width: 120, color: "text.secondary", fontFamily: "monospace" }}>{dept.departmentCode}</TableCell>
                          <TableCell sx={{ width: 220, color: "text.secondary" }}>
                            {dept.headOfDepartment ? `Head: ${dept.headOfDepartment.firstName} ${dept.headOfDepartment.lastName}` : ""}
                          </TableCell>
                          <TableCell align="right" sx={{ width: 190, whiteSpace: "nowrap" }}>
                            {view === "inactive" && (
                              <Button size="small" variant="outlined" startIcon={<CheckCircleRounded />} onClick={() => handleToggleStatus(dept)}
                                sx={{ textTransform: "none", fontWeight: 600, mr: 1 }}>
                                Switch on
                              </Button>
                            )}
                            <Tooltip title="Edit Department">
                              <IconButton size="small" onClick={() => navigate(`/hospital/departments/${dept.departmentId}/edit`)}
                                sx={{ color: "text.secondary", "&:hover": { color: BRAND.action, bgcolor: "rgba(12, 115, 181, 0.1)" } }}>
                                <EditRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {view === "active" && (
                              <Tooltip title="Switch off">
                                <IconButton size="small" onClick={() => handleToggleStatus(dept)}
                                  sx={{ color: "text.secondary", "&:hover": { color: SEMANTIC.dangerLight, bgcolor: "rgba(239, 68, 68, 0.1)" } }}>
                                  <BlockRounded fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
