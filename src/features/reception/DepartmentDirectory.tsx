import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, TextField, InputAdornment,
  Avatar, Divider, Button, Tooltip,
} from "@mui/material";
import {
  SearchRounded, PlaceRounded, CallRounded, ScheduleRounded,
  ApartmentRounded, ArrowForwardRounded, WarningAmberRounded, GroupsRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { CardGridSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import { apiErrorText } from "@/utils/apiError";
import { SEMANTIC, BRAND } from "@/styles/accents";

/**
 * Where to send a patient, who to call, and which doctors work there.
 *
 * The doctors were the one thing here nobody else shows, and they were hidden in
 * a hover tooltip behind a count — invisible when scanning, unreachable on a
 * touch screen. They are named on the card now, and the card hands off to Doctor
 * Availability filtered to the department, so "the patient needs Cardiology"
 * leads to "and Dr X is free at 3:30" instead of ending here.
 *
 * Missing location/extension/OPD hours used to fill each card with three italic
 * "not set" rows, which made a half-configured directory look emptier than it
 * is. What is known is shown; what is missing is one quiet line, and counted at
 * the top so somebody can go and fix it.
 */
interface DeptDoctor { doctorId: string; name: string }
interface Dept {
  departmentId: string;
  departmentName: string;
  departmentCode: string | null;
  departmentType: string | null;
  status: string;
  location: string | null;
  phoneExtension: string | null;
  opdHours: string | null;
  headOfDepartment: string | null;
  doctorCount: number;
  doctors: DeptDoctor[];
}

export default function DepartmentDirectory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: departments = [], isLoading, isError, error, refetch } = useQuery<Dept[]>({
    queryKey: ["department-directory"],
    queryFn: async () => (await axiosInstance.get("/reception/directory")).data.data,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return departments;
    return departments.filter((d) =>
      [d.departmentName, d.departmentCode, d.location, d.headOfDepartment, d.departmentType]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)) ||
      (d.doctors || []).some((doc) => doc.name.toLowerCase().includes(s)),
    );
  }, [departments, search]);

  const totals = useMemo(() => {
    const doctors = departments.reduce((n, d) => n + d.doctorCount, 0);
    // A department reception cannot route to — no location and no extension — is
    // worth counting, because the card for it can only say "ask someone else".
    const unreachable = departments.filter((d) => !d.location && !d.phoneExtension).length;
    const empty = departments.filter((d) => d.doctorCount === 0).length;
    return { doctors, unreachable, empty };
  }, [departments]);

  return (
    <Box sx={{ pb: 5 }}>
      <PageHeader
        title="Department Directory"
        subtitle="Where to send patients, who to call, and which doctors work there"
        actions={
          <TextField
            placeholder="Search department or doctor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
            sx={{ minWidth: 300 }}
          />
        }
      />

      {!isLoading && !isError && departments.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
          <Chip size="small" icon={<ApartmentRounded fontSize="small" />}
            label={`${departments.length} department${departments.length === 1 ? "" : "s"}`}
            sx={{ fontWeight: 700, bgcolor: "action.hover", color: "text.primary" }} />
          <Chip size="small" icon={<GroupsRounded fontSize="small" />}
            label={`${totals.doctors} doctor${totals.doctors === 1 ? "" : "s"}`}
            sx={{ fontWeight: 700, bgcolor: `${BRAND.action}1a`, color: BRAND.action }} />
          {totals.empty > 0 && (
            <Tooltip title="No doctor is assigned to these departments, so reception has nobody to send a patient to">
              <Chip size="small" icon={<WarningAmberRounded fontSize="small" />} label={`${totals.empty} with no doctors`}
                sx={{ fontWeight: 700, bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning }} />
            </Tooltip>
          )}
          {totals.unreachable > 0 && (
            <Tooltip title="Neither a location nor a phone extension is set, so this page cannot say where to send a patient or who to call">
              <Chip size="small" icon={<WarningAmberRounded fontSize="small" />} label={`${totals.unreachable} missing contact details`}
                sx={{ fontWeight: 700, bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning }} />
            </Tooltip>
          )}
        </Box>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <Mascot pose="all-caught-up" title="No departments" subtitle={search ? "No department or doctor matches your search." : "No departments have been set up yet."} />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((d) => (
            <Grid key={d.departmentId} size={{ xs: 12, sm: 6, lg: 4 }}>
              <DeptCard
                d={d}
                onSeeAvailability={() => navigate(`/reception/doctors?dept=${encodeURIComponent(d.departmentName)}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

/** One item stays as-is; two join with "or"; three read "a, b or c". */
function joinOr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

function DeptCard({ d, onSeeAvailability }: { d: Dept; onSeeAvailability: () => void }) {
  const known = [
    d.location ? { icon: <PlaceRounded sx={{ fontSize: 17 }} />, text: d.location } : null,
    d.phoneExtension ? { icon: <CallRounded sx={{ fontSize: 17 }} />, text: `Ext. ${d.phoneExtension}` } : null,
    d.opdHours ? { icon: <ScheduleRounded sx={{ fontSize: 17 }} />, text: d.opdHours } : null,
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];

  // Named once, quietly, rather than a row of italic placeholders per field.
  // Joined with "or" — a bare comma list read as "No location, OPD hours set".
  const missing = joinOr([
    !d.location ? "location" : null,
    !d.phoneExtension ? "extension" : null,
    !d.opdHours ? "OPD hours" : null,
  ].filter(Boolean) as string[]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%",
        display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "background.paper",
        transition: "all 0.15s ease",
        "&:hover": { borderColor: `${BRAND.action}66`, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: `${BRAND.action}1f`, color: BRAND.action, width: 44, height: 44 }}>
          <ApartmentRounded />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>
            {d.departmentName}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {[d.departmentCode, d.departmentType].filter(Boolean).join(" • ") || "—"}
          </Typography>
        </Box>
        {d.status !== "active" && (
          <Chip label="Inactive" size="small" sx={{ bgcolor: `${SEMANTIC.danger}1f`, color: SEMANTIC.danger, fontWeight: 700 }} />
        )}
      </Box>

      {d.headOfDepartment && (
        <Typography variant="body2" sx={{ color: "text.primary" }} noWrap>
          <Box component="span" sx={{ color: "text.secondary" }}>Head — </Box>
          <Box component="span" sx={{ fontWeight: 600 }}>{d.headOfDepartment}</Box>
        </Typography>
      )}

      <Divider sx={{ borderColor: "divider" }} />

      {known.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {known.map((k, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ color: BRAND.action, display: "flex" }}>{k.icon}</Box>
              <Typography variant="body2" sx={{ color: "text.primary" }}>{k.text}</Typography>
            </Box>
          ))}
          {missing && (
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              No {missing} set
            </Typography>
          )}
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 600 }}>
          No location, extension or OPD hours set — add them under Departments
        </Typography>
      )}

      {/* The part of this page nothing else shows. Named, not counted. */}
      <Box sx={{ mt: "auto", pt: 0.5 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4, display: "block", mb: 0.75 }}>
          {d.doctorCount > 0 ? `${d.doctorCount} DOCTOR${d.doctorCount === 1 ? "" : "S"}` : "DOCTORS"}
        </Typography>
        {d.doctorCount > 0 ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {d.doctors.map((doc) => (
              <Chip
                key={doc.doctorId} size="small" label={doc.name}
                sx={{ fontWeight: 600, bgcolor: "action.hover", color: "text.primary", maxWidth: "100%" }}
              />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 600 }}>
            Nobody assigned — reception has no one to send a patient to
          </Typography>
        )}
      </Box>

      {d.doctorCount > 0 && (
        <Button
          fullWidth size="small" variant="outlined" endIcon={<ArrowForwardRounded />}
          onClick={onSeeAvailability}
          sx={{ textTransform: "none", fontWeight: 700, color: BRAND.action, borderColor: `${BRAND.action}55`, mt: 0.5 }}
        >
          See who's free
        </Button>
      )}
    </Paper>
  );
}
