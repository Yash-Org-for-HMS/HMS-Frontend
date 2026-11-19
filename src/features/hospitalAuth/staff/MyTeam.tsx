import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Paper, Typography, Chip, Skeleton, Stack, ToggleButton, ToggleButtonGroup, MenuItem, TextField, Autocomplete,
  Table, TableHead, TableRow, TableCell, TableBody, Grid,
} from "@mui/material";
import { GroupsRounded, AccountTreeRounded, EventAvailableRounded, EventBusyRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import StatCard from "@/components/StatCard";
import { BRAND, SEMANTIC } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";

/**
 * "My team" (backend /hospital/staff/my-team): the people who report to this
 * login, from the reporting lines kept in the Staff Directory - the same ones
 * the organisation chart draws. Read-only: who they are, where they work, and
 * today's duty or leave. The hospital admin and HR may open anyone's team.
 */

type Line = "ANY" | "ADMINISTRATIVE" | "FUNCTIONAL";
interface Member {
  staffId: string; name: string; designation: string | null; category: string;
  departments: { departmentId: string; departmentName: string; roleInDept: string; isHome: boolean }[];
  phone: string | null; branches: string[]; posting: string | null;
  login: { roleName: string; isActive: boolean } | null;
  depth: number; managerName: string; via: "ADMINISTRATIVE" | "FUNCTIONAL" | "BOTH";
  dutiesToday: { wardName: string; shiftName: string; shiftStart: string; shiftEnd: string }[];
  leaveToday: { reason: string | null; startTime: string | null; endTime: string | null } | null;
}
interface Team {
  lead: { staffId: string; name: string; designation: string | null } | null;
  people: Member[];
  summary: { total: number; direct: number; onDutyToday: number; onLeaveToday: number };
}
interface ChartPerson { staffId: string; name: string; designation: string | null }

const DEPT_ROLE: Record<string, string> = { HOD: "Head", DEPUTY_HOD: "Deputy head", VISITING: "Visiting" };
const VIA: Record<Member["via"], string> = { ADMINISTRATIVE: "Administrative", FUNCTIONAL: "Functional", BOTH: "Both lines" };

export default function MyTeam() {
  const { user } = useHospitalAuth();
  const canPick = hasRole(user, "H_ADMIN", "HR_ADMIN");
  const [whole, setWhole] = useState(false);
  const [line, setLine] = useState<Line>("ANY");
  const [picked, setPicked] = useState<ChartPerson | null>(null);

  const q = useQuery<Team>({
    queryKey: ["my-team", picked?.staffId ?? "me", whole, line],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/my-team", {
      params: { whole: whole ? "1" : undefined, line, staffId: picked?.staffId },
    })).data.data,
    placeholderData: keepPreviousData,
  });
  // The people an admin can choose from: the organisation chart's list.
  const chart = useQuery<ChartPerson[]>({
    queryKey: ["org-chart-people"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/org-chart")).data.data.people,
    enabled: canPick,
    staleTime: 5 * 60_000,
  });

  const team = q.data;
  const s = team?.summary;
  const whose = picked ? `${picked.name}'s team` : "My team";

  return (
    <Box>
      <PageHeader
        title={whose}
        subtitle={`The people who report to ${picked ? picked.name : "you"}, from the reporting lines in the Staff Directory. Today's duty comes from the ward roster.`}
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={whole ? "whole" : "direct"} onChange={(_, v) => v && setWhole(v === "whole")}>
          <ToggleButton value="direct">Direct reports</ToggleButton>
          <ToggleButton value="whole">Whole team</ToggleButton>
        </ToggleButtonGroup>
        <TextField select size="small" label="Reporting line" value={line} onChange={(e) => setLine(e.target.value as Line)} sx={{ minWidth: 200 }}>
          <MenuItem value="ANY">Both lines</MenuItem>
          <MenuItem value="ADMINISTRATIVE">Administrative only</MenuItem>
          <MenuItem value="FUNCTIONAL">Functional only</MenuItem>
        </TextField>
        {canPick && (
          <Autocomplete
            size="small" sx={{ minWidth: 280 }}
            options={chart.data ?? []} loading={chart.isLoading}
            value={picked} onChange={(_, v) => setPicked(v)}
            getOptionLabel={(p) => (p.designation ? `${p.name} - ${p.designation}` : p.name)}
            isOptionEqualToValue={(a, b) => a.staffId === b.staffId}
            renderInput={(params) => <TextField {...params} label="Whose team" placeholder="Mine" />}
          />
        )}
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<GroupsRounded />} color={BRAND.action} label="In the team" value={s?.total ?? "-"} loading={q.isLoading}
            info="Everyone listed below: with Whole team on, the people under your reports too. Staff who have left are not counted." />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<AccountTreeRounded />} color="#8b5cf6" label="Report to you directly" value={s?.direct ?? "-"} loading={q.isLoading}
            info="People whose administrative or functional manager (as chosen above) is you, in the Staff Directory." />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<EventAvailableRounded />} color={SEMANTIC.success} label="On duty today" value={s?.onDutyToday ?? "-"} loading={q.isLoading}
            info="Team members with a shift on today's ward duty roster. Staff who are not on a ward roster do not show here." />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<EventBusyRounded />} color={SEMANTIC.warning} label="Doctors on leave today" value={s?.onLeaveToday ?? "-"} loading={q.isLoading}
            info="Doctors in the team with leave recorded for today (whole day or part of it). Leave for other staff is not recorded in the system yet." />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {q.isLoading ? (
          <Box sx={{ p: 2.5, display: "grid", gap: 1.5 }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={36} />)}</Box>
        ) : q.isError ? (
          <ErrorState message={apiErrorText(q.error) ?? "Couldn't load the team"} onRetry={() => q.refetch()} />
        ) : !team?.lead ? (
          <Typography variant="body2" sx={{ px: 2.5, py: 2, color: "text.secondary" }}>
            Your login is not linked to a staff record yet, so there is no team to show. The hospital admin links it in the Staff Directory.
          </Typography>
        ) : team.people.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2.5, py: 2, color: "text.secondary" }}>
            Nobody reports to {picked ? picked.name : "you"} on this reporting line. Reporting lines are set in the Staff Directory.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Works at</TableCell>
                <TableCell>Today</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Login</TableCell>
                <TableCell>Reports to</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {team.people.map((p) => (
                <TableRow key={p.staffId} hover>
                  <TableCell sx={{ pl: 2 + (p.depth - 1) * 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: p.depth === 1 ? 700 : 600 }}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.designation ?? p.category}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {p.departments.length === 0 ? <Typography variant="body2" sx={{ color: "text.disabled" }}>-</Typography> : p.departments.map((d) => (
                        <Chip key={d.departmentId} size="small" variant={d.isHome ? "filled" : "outlined"}
                          label={DEPT_ROLE[d.roleInDept] ? `${d.departmentName} (${DEPT_ROLE[d.roleInDept]})` : d.departmentName} />
                      ))}
                    </Box>
                    {p.posting && <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.posting}</Typography>}
                  </TableCell>
                  <TableCell><Typography variant="body2">{p.branches.join(", ") || "-"}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {p.leaveToday && (
                        <Chip size="small" sx={{ bgcolor: `${SEMANTIC.warning}22`, color: SEMANTIC.warning, fontWeight: 600 }}
                          label={p.leaveToday.startTime && p.leaveToday.endTime ? `On leave ${p.leaveToday.startTime}-${p.leaveToday.endTime}` : "On leave"} />
                      )}
                      {p.dutiesToday.map((d) => (
                        <Chip key={d.shiftName} size="small" variant="outlined" sx={{ borderColor: BRAND.action, color: BRAND.action, fontWeight: 600 }}
                          label={`${d.shiftName} ${d.shiftStart}-${d.shiftEnd} - ${d.wardName}`} />
                      ))}
                      {!p.leaveToday && p.dutiesToday.length === 0 && <Typography variant="body2" sx={{ color: "text.disabled" }}>-</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2">{p.phone || "-"}</Typography></TableCell>
                  <TableCell>
                    {p.login
                      ? <Typography variant="body2" sx={{ color: p.login.isActive ? undefined : "text.disabled" }}>{p.login.roleName}{p.login.isActive ? "" : " (inactive)"}</Typography>
                      : <Typography variant="body2" sx={{ color: "text.disabled" }}>No login</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{p.managerName}</Typography>
                    {line === "ANY" && <Typography variant="caption" sx={{ color: "text.secondary" }}>{VIA[p.via]}</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
