import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Paper, Typography, Chip, Skeleton, Stack, ToggleButton, ToggleButtonGroup, MenuItem, TextField, Autocomplete,
  Table, TableHead, TableRow, TableCell, TableBody, Grid, InputAdornment,
} from "@mui/material";
import { GroupsRounded, AccountTreeRounded, NoAccountsRounded, PhoneDisabledRounded, SearchRounded } from "@mui/icons-material";
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
  summary: { total: number; direct: number; noLogin: number; noPhone: number };
}
interface ChartPerson { staffId: string; name: string; designation: string | null }

const DEPT_ROLE: Record<string, string> = { HOD: "Head", DEPUTY_HOD: "Deputy head", VISITING: "Visiting" };
type Only = "noLogin" | "noPhone" | null;
const VIA: Record<Member["via"], string> = { ADMINISTRATIVE: "Administrative", FUNCTIONAL: "Functional", BOTH: "Both lines" };

export default function MyTeam() {
  const { user } = useHospitalAuth();
  const canPick = hasRole(user, "H_ADMIN", "HR_ADMIN");
  const [whole, setWhole] = useState(false);
  const [line, setLine] = useState<Line>("ANY");
  const [picked, setPicked] = useState<ChartPerson | null>(null);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<Only>(null);

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
  // The same rules as the backend's summary counts, so a card and its filter agree.
  const needle = search.trim().toLowerCase();
  const shown = (team?.people ?? []).filter((p) =>
    (only !== "noLogin" || !p.login?.isActive) &&
    (only !== "noPhone" || !p.phone?.trim()) &&
    (!needle || p.name.toLowerCase().includes(needle) || (p.designation ?? "").toLowerCase().includes(needle)));
  const toggle = (o: Only) => setOnly((cur) => (cur === o ? null : o));

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
        <TextField
          size="small" placeholder="Search name or designation" value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
        />
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
          <StatCard icon={<NoAccountsRounded />} color={SEMANTIC.warning} label="No login" value={s?.noLogin ?? "-"} loading={q.isLoading}
            onClick={() => toggle("noLogin")} sub={only === "noLogin" ? "Showing only these - click to show all" : undefined}
            info="Team members who cannot sign in to Dolphin: no login at all, or a login that has been switched off. Logins are given in Logins & roles. Click to list only them." />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<PhoneDisabledRounded />} color={SEMANTIC.danger} label="No phone on file" value={s?.noPhone ?? "-"} loading={q.isLoading}
            onClick={() => toggle("noPhone")} sub={only === "noPhone" ? "Showing only these - click to show all" : undefined}
            info="Team members with no phone number in the Staff Directory, so you cannot reach them from here. Click to list only them." />
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
        ) : shown.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2.5, py: 2, color: "text.secondary" }}>
            Nobody in the team matches the search or the card chosen above.
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
              {shown.map((p) => (
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
