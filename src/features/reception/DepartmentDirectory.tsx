import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, TextField, InputAdornment,
  Avatar, Stack, Divider, Tooltip,
} from "@mui/material";
import {
  SearchRounded, PlaceRounded, CallRounded, ScheduleRounded, PersonRounded,
  ApartmentRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { CardGridSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";

export default function DepartmentDirectory() {
  const [search, setSearch] = useState("");

  const { data: departments = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["department-directory"],
    queryFn: async () => (await axiosInstance.get("/reception/directory")).data.data,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return departments;
    return departments.filter((d) =>
      [d.departmentName, d.departmentCode, d.location, d.headOfDepartment, d.departmentType]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)) ||
      (d.doctors || []).some((doc: any) => doc.name.toLowerCase().includes(s))
    );
  }, [departments, search]);

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Department Directory"
        subtitle="Where to send patients, who to call, and OPD timings"
        actions={
          <TextField
            placeholder="Search departments, doctors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
            sx={{ minWidth: 280 }}
          />
        }
      />

      {isLoading ? (
        <CardGridSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <Mascot pose="all-caught-up" title="No departments" subtitle={search ? "No departments match your search." : "No departments have been set up yet."} />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((d) => (
            <Grid key={d.departmentId} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: "#0891b2", width: 44, height: 44 }}><ApartmentRounded /></Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>{d.departmentName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {d.departmentCode}{d.departmentType ? ` • ${d.departmentType}` : ""}
                    </Typography>
                  </Box>
                  {d.status !== "active" && (
                    <Chip label="Inactive" size="small" sx={{ bgcolor: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 700 }} />
                  )}
                </Box>

                <Divider sx={{ borderColor: "divider" }} />

                <Stack spacing={1}>
                  <InfoRow icon={<PlaceRounded sx={{ fontSize: 18 }} />} value={d.location} placeholder="Location not set" />
                  <InfoRow icon={<CallRounded sx={{ fontSize: 18 }} />} value={d.phoneExtension ? `Ext. ${d.phoneExtension}` : null} placeholder="No extension" />
                  <InfoRow icon={<ScheduleRounded sx={{ fontSize: 18 }} />} value={d.opdHours} placeholder="OPD hours not set" />
                  <InfoRow icon={<PersonRounded sx={{ fontSize: 18 }} />} value={d.headOfDepartment ? `Head: ${d.headOfDepartment}` : null} placeholder="No head assigned" />
                </Stack>

                <Box sx={{ mt: "auto", pt: 1 }}>
                  {d.doctorCount > 0 ? (
                    <Tooltip title={d.doctors.map((doc: any) => doc.name).join(", ")}>
                      <Chip label={`${d.doctorCount} doctor${d.doctorCount === 1 ? "" : "s"}`} size="small" sx={{ bgcolor: "action.hover", color: "text.primary", fontWeight: 700 }} />
                    </Tooltip>
                  ) : (
                    <Chip label="No doctors" size="small" sx={{ bgcolor: "action.hover", color: "text.secondary", fontWeight: 600 }} />
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function InfoRow({ icon, value, placeholder }: { icon: React.ReactNode; value: string | null; placeholder: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: value ? "text.primary" : "text.disabled" }}>
      <Box sx={{ color: value ? "#0891b2" : "text.disabled", display: "flex" }}>{icon}</Box>
      <Typography variant="body2" sx={{ color: "inherit", fontStyle: value ? "normal" : "italic" }}>
        {value || placeholder}
      </Typography>
    </Box>
  );
}
