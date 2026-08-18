import { useState } from "react";
import { apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, TextField, InputAdornment, Alert,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import FilterBar from "@/components/layout/FilterBar";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import PageSkeleton from "@/components/PageSkeleton";

const headSx = { color: "text.secondary", fontWeight: 600, textTransform: "none", letterSpacing: "normal", fontSize: "0.875rem", bgcolor: "background.paper" } as const;

// Mirrors backend/src/lib/roleCatalog.ts — the standard set seeded into every
// hospital. Custom (tenant) roles are not offered: access is by these fixed roles.
const SYSTEM_ROLES: { code: string; name: string }[] = [
  { code: "H_ADMIN", name: "Hospital Admin" },
  { code: "B_ADMIN", name: "Branch Admin" },
  { code: "DOCTOR", name: "Doctor" },
  { code: "NURSE", name: "Nurse" },
  { code: "RECEPTIONIST", name: "Receptionist" },
  { code: "PHARMACIST", name: "Pharmacist" },
  { code: "LAB_TECH", name: "Lab Technician" },
];

export default function RolesList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  // Fetch all roles so we can aggregate the per-hospital copies; presentational.
  const { data: roles = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["rbac-roles", search],
    queryFn: async () => (await axiosInstance.get("/rbac/roles", { params: { limit: 1000, search } })).data.data,
  });

  const q = search.trim().toLowerCase();
  const matches = (code: string, name: string) => !q || code.toLowerCase().includes(q) || (name || "").toLowerCase().includes(q);

  // Standard roles: aggregate the per-hospital copies into one row per code.
  const systemRows = SYSTEM_ROLES
    .map((sr) => {
      const copies = roles.filter((r) => r.roleCode === sr.code);
      return { code: sr.code, name: sr.name, hospitals: copies.length, users: copies.reduce((sum, r) => sum + (r._count?.users || 0), 0) };
    })
    .filter((row) => matches(row.code, row.name));

  const { sorted: sortedSystemRows, orderBy, order, onSort } = useTableSort(systemRows, {
    code: (r) => r.code,
    name: (r) => r.name,
    hospitals: (r) => r.hospitals,
    users: (r) => r.users,
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("rbac.title", "Hospital Roles")}
        subtitle="The standard roles every hospital uses. Roles are fixed — grant access by assigning staff to a role on the Users screen."
      />

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        Every hospital uses the same <strong>standard role set</strong> below. There are no custom roles — assign staff to one of these roles from the Users screen.
      </Alert>

      <FilterBar>
        <TextField
          placeholder={t("rbac.searchPlaceholder", "Search by role name or code...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary" }} /></InputAdornment> }}
        />
      </FilterBar>

      {loading ? (
        <PageSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <Paper elevation={2} sx={{ bgcolor: "background.paper", backgroundImage: "none", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: "background.paper" }}>
                  <SortableHeadCell label="Code" sortKey="code" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <SortableHeadCell label="Role Name" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <TableCell sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>Type</TableCell>
                  <SortableHeadCell label="Hospitals" sortKey="hospitals" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <SortableHeadCell label="Total Users" sortKey="users" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSystemRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>No matching roles</TableCell></TableRow>
                ) : sortedSystemRows.map((row) => (
                  <TableRow key={row.code} hover>
                    <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontWeight: 600 }}>{row.code}</TableCell>
                    <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>{row.name}</TableCell>
                    <TableCell><Chip label="System Role" size="small" sx={{ bgcolor: "rgba(20, 184, 166, 0.1)", color: "#2dd4bf", fontWeight: 600 }} /></TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{row.hospitals}</TableCell>
                    <TableCell sx={{ color: "text.primary" }}>{row.users}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </PageContainer>
  );
}
