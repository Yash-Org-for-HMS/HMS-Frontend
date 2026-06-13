import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Pagination,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  SearchRounded,
  CleaningServicesRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";

// Mirrors backend/src/lib/roleCatalog.ts — the standard set seeded into every
// hospital. Anything outside this list is treated as a custom (tenant) role.
const SYSTEM_ROLES: { code: string; name: string }[] = [
  { code: "H_ADMIN", name: "Hospital Admin" },
  { code: "B_ADMIN", name: "Branch Admin" },
  { code: "DOCTOR", name: "Doctor" },
  { code: "NURSE", name: "Nurse" },
  { code: "RECEPTIONIST", name: "Receptionist" },
  { code: "PHARMACIST", name: "Pharmacist" },
  { code: "LAB_TECH", name: "Lab Technician" },
];
const SYSTEM_ROLE_CODES = SYSTEM_ROLES.map((r) => r.code);

export default function RolesList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  // Role cleanup (remove non-standard roles that have no users)
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const res = await axiosInstance.post("/rbac/roles/cleanup");
      setCleanupOpen(false);
      setCleanupResult(res.data.data);
      fetchRoles();
    } catch (error) {
      console.error("Failed to clean up roles", error);
    } finally {
      setCleaning(false);
    }
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      // Fetch all roles so we can group them; the page is presentational, not paged.
      const response = await axiosInstance.get("/rbac/roles", {
        params: { limit: 1000, search }
      });
      setRoles(response.data.data);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [search]);

  const q = search.trim().toLowerCase();
  const matches = (code: string, name: string) =>
    !q || code.toLowerCase().includes(q) || (name || "").toLowerCase().includes(q);

  // Standard roles: aggregate the per-hospital copies into one row per code.
  const systemRows = SYSTEM_ROLES
    .map((sr) => {
      const copies = roles.filter((r) => r.roleCode === sr.code);
      return {
        code: sr.code,
        name: sr.name,
        hospitals: copies.length,
        users: copies.reduce((sum, r) => sum + (r._count?.users || 0), 0),
      };
    })
    .filter((row) => matches(row.code, row.name));

  // Custom roles: anything not in the standard set, grouped by hospital.
  const customRoles = roles.filter(
    (r) => !SYSTEM_ROLE_CODES.includes(r.roleCode) && matches(r.roleCode, r.roleName),
  );
  const customByHospital = Object.values(
    customRoles.reduce((acc: Record<string, { hospitalName: string; roles: any[] }>, r) => {
      const key = r.hospital?.hospitalName || "Unknown";
      if (!acc[key]) acc[key] = { hospitalName: key, roles: [] };
      acc[key].roles.push(r);
      return acc;
    }, {}),
  ).sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));

  return (
    <PageContainer>
      <PageHeader
        title={t("rbac.title", "Hospital Roles")}
        subtitle={t("rbac.subtitle", "Global Support Mode: Manage hospital-level roles across any tenant")}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<CleaningServicesRounded />}
              onClick={() => setCleanupOpen(true)}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2, borderColor: "divider", color: "text.secondary" }}
            >
              Clean up roles
            </Button>
            <ActionButton
              accentFrom="#14b8a6"
              accentTo="#0d9488"
              startIcon={<AddRounded />}
              onClick={() => navigate("/rbac/roles/new")}
            >
              {t("rbac.addRole", "Add Role")}
            </ActionButton>
          </>
        }
      />

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Standard roles</strong> are seeded into every hospital and shown once below.
        <strong> Custom roles</strong> are listed under the hospital that owns them. Roles are
        always tenant-scoped — editing one changes only that hospital's staff.
      </Alert>

      {/* Filters */}
      <FilterBar>
        <TextField
          placeholder={t("rbac.searchPlaceholder", "Search by role name or code...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        />
      </FilterBar>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#14b8a6" }} />
        </Box>
      ) : (
        <>
          {/* ── Standard (System) Roles — shown once across all hospitals ── */}
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 1.5 }}>
            Standard Roles
          </Typography>
          <Paper
            elevation={2}
            sx={{ bgcolor: "background.paper", backgroundImage: "none", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", mb: 4 }}
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "background.paper" }}>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Code</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Role Name</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Hospitals</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Total Users</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemRows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>No matching standard roles</TableCell></TableRow>
                  ) : systemRows.map((row) => (
                    <TableRow key={row.code} hover>
                      <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontWeight: 600 }}>{row.code}</TableCell>
                      <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>{row.name}</TableCell>
                      <TableCell>
                        <Chip label="System Role" size="small" sx={{ bgcolor: "rgba(20, 184, 166, 0.1)", color: "#2dd4bf", fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{row.hospitals}</TableCell>
                      <TableCell sx={{ color: "text.primary" }}>{row.users}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ── Custom Roles grouped by hospital ── */}
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 1.5 }}>
            Custom Roles by Hospital
          </Typography>
          {customByHospital.length === 0 ? (
            <Paper elevation={2} sx={{ bgcolor: "background.paper", backgroundImage: "none", border: "1px solid", borderColor: "divider", borderRadius: 3, p: 4, textAlign: "center" }}>
              <Typography sx={{ color: "text.secondary" }}>No custom roles — every hospital uses the standard set.</Typography>
            </Paper>
          ) : (
            customByHospital.map((group) => (
              <Paper
                key={group.hospitalName}
                elevation={2}
                sx={{ bgcolor: "background.paper", backgroundImage: "none", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", mb: 2 }}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
                  <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{group.hospitalName}</Typography>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "background.paper" }}>
                        <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Code</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Role Name</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>Users</TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.roles.map((role) => (
                        <TableRow key={role.roleId} hover>
                          <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontWeight: 600 }}>{role.roleCode}</TableCell>
                          <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>{role.roleName}</TableCell>
                          <TableCell sx={{ color: "text.primary" }}>{role._count?.users || 0}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => navigate(`/rbac/roles/${role.roleId}/edit`)} sx={{ color: "text.secondary" }}>
                              <EditRounded />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ))
          )}
        </>
      )}

      {/* Cleanup confirm */}
      <Dialog open={cleanupOpen} onClose={() => !cleaning && setCleanupOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Clean up roles</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary" }}>
            This removes non-standard roles (anything outside the standard set:
            H_ADMIN, B_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, LAB_TECH).
            A role is only deleted if it has <strong>no users assigned</strong> — roles still
            in use are kept and reported. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCleanupOpen(false)} disabled={cleaning} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button onClick={handleCleanup} variant="contained" disabled={cleaning} sx={{ bgcolor: "#14b8a6", "&:hover": { bgcolor: "#0d9488" } }}>
            {cleaning ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Clean up"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cleanup result */}
      <Dialog open={Boolean(cleanupResult)} onClose={() => setCleanupResult(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: "#14b8a6" }}>Cleanup complete</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Removed <strong>{cleanupResult?.removedCount ?? 0}</strong> non-standard role(s).
          </Typography>
          {cleanupResult?.skippedCount > 0 && (
            <>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, mb: 0.5 }}>
                Kept {cleanupResult.skippedCount} role(s) that still have users assigned:
              </Typography>
              <Box component="ul" sx={{ pl: 3, m: 0 }}>
                {cleanupResult.skipped?.map((s: any, i: number) => (
                  <li key={i}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {s.roleCode} — {s.hospitalName || "Unknown"} ({s.users} user{s.users === 1 ? "" : "s"})
                    </Typography>
                  </li>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCleanupResult(null)} variant="contained" sx={{ bgcolor: "#14b8a6", "&:hover": { bgcolor: "#0d9488" } }}>Done</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#14b8a6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
