import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, IconButton, Tooltip, Autocomplete,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded, ContentCopyRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasAction } from "@/constants/roles";
import { BRAND, SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";

/**
 * The nurses' duty roster (backend /roster): who is on which shift of which
 * day, ward by ward. The in-charge plans the wards they run; nursing
 * administration and admins every ward. The shifts are the hospital's own ward
 * shifts (Morning / Evening / Night until it sets them in the chart settings).
 * A nurse is on one ward a shift — a shift they work elsewhere shows greyed.
 */

interface WardChoice { wardId: string; wardName: string; wardCode: string | null; canPlan: boolean }
interface Shift { name: string; startTime: string; endTime: string }
interface Week {
  ward: { wardId: string; wardName: string };
  canPlan: boolean;
  shifts: Shift[];
  days: string[];
  occupied: number;
  plannedRatio: string | null;
  neededPerShift: number | null;
  nurses: { staffId: string; name: string; posted: boolean; status: string }[];
  duties: { staffId: string; dutyDate: string; shiftName: string }[];
  elsewhere: { staffId: string; dutyDate: string; shiftName: string; wardName: string }[];
}
interface NurseChoice { staffId: string; name: string; postedTo: string | null }

/** Monday of the week a day falls in. */
const mondayOf = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, "day").format("YYYY-MM-DD");

/** A shift's short mark: its first letter, or two when two shifts share one. */
function marks(shifts: Shift[]): Record<string, string> {
  const first = shifts.map((s) => s.name.charAt(0).toUpperCase());
  return Object.fromEntries(shifts.map((s, i) => [s.name, first.filter((f) => f === first[i]).length > 1 ? s.name.slice(0, 2) : first[i]]));
}

export default function DutyRoster() {
  const { user } = useHospitalAuth();
  const plans = hasAction(user, "nurse.roster");
  const toast = useToast();
  const qc = useQueryClient();
  const [chosenWard, setWardId] = useState("");
  const [week, setWeek] = useState(() => mondayOf(dayjs()));
  const [added, setAdded] = useState<Record<string, NurseChoice[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const wards = useQuery<WardChoice[]>({
    queryKey: ["roster-wards"],
    queryFn: async () => (await axiosInstance.get("/roster/wards")).data.data,
  });
  // Until one is chosen: the first ward this login plans, else the first ward.
  const wardId = chosenWard || (wards.data?.find((x) => x.canPlan) ?? wards.data?.[0])?.wardId || "";

  const key = ["roster", wardId, week];
  const q = useQuery<Week>({
    queryKey: key,
    queryFn: async () => (await axiosInstance.get(`/roster/wards/${wardId}`, { params: { from: week, days: 7 } })).data.data,
    enabled: !!wardId,
  });
  const choices = useQuery<NurseChoice[]>({
    queryKey: ["roster-nurses"],
    queryFn: async () => (await axiosInstance.get("/roster/nurses")).data.data,
    enabled: plans && !!q.data?.canPlan,
    staleTime: 5 * 60_000,
  });

  const w = q.data;
  const mark = useMemo(() => marks(w?.shifts ?? []), [w?.shifts]);
  const rows = useMemo(() => {
    const list = [...(w?.nurses ?? [])];
    for (const n of added[wardId] ?? []) if (!list.some((x) => x.staffId === n.staffId)) list.push({ staffId: n.staffId, name: n.name, posted: false, status: "ACTIVE" });
    return list;
  }, [w?.nurses, added, wardId]);
  const isOn = (staffId: string, day: string, shift: string) => !!w?.duties.some((d) => d.staffId === staffId && d.dutyDate === day && d.shiftName === shift);
  const away = (staffId: string, day: string, shift: string) => w?.elsewhere.find((d) => d.staffId === staffId && d.dutyDate === day && d.shiftName === shift);
  const cover = (day: string, shift: string) => w?.duties.filter((d) => d.dutyDate === day && d.shiftName === shift).length ?? 0;

  const toggle = async (staffId: string, day: string, shift: string) => {
    const id = `${staffId}|${day}|${shift}`;
    setBusy(id);
    try {
      await axiosInstance.put("/roster/duty", { wardId, staffId, dutyDate: day, shiftName: shift, on: !isOn(staffId, day, shift) });
      await qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't change the roster"));
    } finally {
      setBusy(null);
    }
  };

  const copyLastWeek = async () => {
    setBusy("copy");
    try {
      const from = dayjs(week).subtract(7, "day").format("YYYY-MM-DD");
      const { copied, skipped } = (await axiosInstance.post("/roster/copy-week", { wardId, fromWeek: from, toWeek: week })).data.data as { copied: number; skipped: number };
      toast.success(copied || skipped
        ? `Copied ${copied} dut${copied === 1 ? "y" : "ies"}${skipped ? ` · ${skipped} skipped (already on that shift)` : ""}`
        : "Last week had nothing to copy");
      await qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't copy last week"));
    } finally {
      setBusy(null);
    }
  };

  const canPlan = !!w?.canPlan && plans;
  const today = dayjs().format("YYYY-MM-DD");

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Duty roster"
        subtitle={w
          ? `${w.ward.wardName}: ${w.occupied} patient${w.occupied === 1 ? "" : "s"} now${w.plannedRatio ? ` · planning ratio ${w.plannedRatio}${w.neededPerShift ? ` → ${w.neededPerShift} nurse${w.neededPerShift === 1 ? "" : "s"} a shift` : ""}` : ""}. Under each day, how many are on each shift${w.neededPerShift ? " (red when short)" : ""}.`
          : "Who is on which shift, ward by ward."}
      />

      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField id="roster-ward" select size="small" label="Ward" value={wardId} onChange={(e) => setWardId(e.target.value)} sx={{ minWidth: 220 }} disabled={!wards.data?.length}>
          {(wards.data ?? []).map((x) => <MenuItem key={x.wardId} value={x.wardId}>{x.wardName}{x.canPlan ? "" : " (view)"}</MenuItem>)}
        </TextField>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton aria-label="Previous week" onClick={() => setWeek(dayjs(week).subtract(7, "day").format("YYYY-MM-DD"))}><ChevronLeftRounded /></IconButton>
          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 170, textAlign: "center" }}>
            {dayjs(week).format("D MMM")} – {dayjs(week).add(6, "day").format("D MMM YYYY")}
          </Typography>
          <IconButton aria-label="Next week" onClick={() => setWeek(dayjs(week).add(7, "day").format("YYYY-MM-DD"))}><ChevronRightRounded /></IconButton>
          {week !== mondayOf(dayjs()) && <Button size="small" onClick={() => setWeek(mondayOf(dayjs()))}>This week</Button>}
        </Box>
        <Box sx={{ flex: 1 }} />
        {canPlan && (
          <>
            <Autocomplete
              size="small"
              options={(choices.data ?? []).filter((n) => !rows.some((r) => r.staffId === n.staffId))}
              getOptionLabel={(n) => n.name}
              renderOption={(props, n) => (
                <li {...props} key={n.staffId}>
                  <Box>
                    <Typography variant="body2">{n.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{n.postedTo ? `Posted to ${n.postedTo}` : "Not posted to a ward"}</Typography>
                  </Box>
                </li>
              )}
              value={null}
              onChange={(_e, n) => { if (n) setAdded((s) => ({ ...s, [wardId]: [...(s[wardId] ?? []), n] })); }}
              renderInput={(params) => <TextField {...params} id="roster-add-nurse" label="Add a nurse" />}
              sx={{ width: 240 }}
              loading={choices.isLoading}
            />
            <Button variant="outlined" startIcon={<ContentCopyRounded />} disabled={busy === "copy"} onClick={copyLastWeek}>Copy last week</Button>
          </>
        )}
      </Paper>

      {w && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
          {w.shifts.map((s) => (
            <Typography key={s.name} variant="caption" sx={{ color: "text.secondary" }}>
              <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{mark[s.name]}</Box> {s.name} {s.startTime}–{s.endTime}
            </Typography>
          ))}
        </Box>
      )}

      {wards.isError || q.isError ? (
        <ErrorState title="Couldn't load the roster" message={apiErrorText(wards.error ?? q.error)} onRetry={() => { wards.refetch(); q.refetch(); }} />
      ) : wards.data && !wards.data.length ? (
        <Paper sx={{ p: 3 }}><Mascot pose="all-caught-up" title="No wards set up yet" /></Paper>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 160 }}>Nurse</TableCell>
                {(w?.days ?? []).map((d) => (
                  <TableCell key={d} align="center" sx={{ minWidth: 104, px: 1, bgcolor: d === today ? `${BRAND.action}0f` : undefined }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, display: "block" }}>{dayjs(d).format("ddd D")}</Typography>
                    {/* How many are on each shift, sitting over that shift's column of marks below. */}
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                      {w!.shifts.map((s) => {
                        const n = cover(d, s.name);
                        const need = w!.neededPerShift;
                        const short = !!need && n < need;
                        return (
                          <Tooltip key={s.name} title={`${s.name}: ${n} on duty${need ? ` of ${need} needed` : ""}`}>
                            <Typography variant="caption" sx={{ width: 28, textAlign: "center", fontVariantNumeric: "tabular-nums", color: short ? SEMANTIC.danger : "text.secondary", fontWeight: short ? 800 : 500 }}>
                              {need ? `${n}/${need}` : n}
                            </Typography>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading || !w ? <TableRowsSkeleton rows={4} columns={8} /> : !rows.length ? (
                <TableRow><TableCell colSpan={8}><Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>No nurse is posted to this ward{canPlan ? " — add one above" : ""}.</Typography></TableCell></TableRow>
              ) : rows.map((n) => (
                <TableRow key={n.staffId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{n.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{n.posted ? "Posted here" : "From another ward"}{n.status !== "ACTIVE" ? ` · ${n.status.replace("_", " ").toLowerCase()}` : ""}</Typography>
                  </TableCell>
                  {w.days.map((d) => (
                    <TableCell key={d} align="center" sx={{ px: 1, bgcolor: d === today ? `${BRAND.action}0a` : undefined }}>
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                        {w.shifts.map((s) => {
                          const on = isOn(n.staffId, d, s.name);
                          const there = away(n.staffId, d, s.name);
                          const label = there ? `${s.name}: on ${there.wardName}` : `${s.name}: ${on ? "on duty" : "off"}`;
                          // Looking, not planning: marks, not buttons (a disabled
                          // button greys "on" and "off" alike).
                          if (!canPlan) return (
                            <Tooltip key={s.name} title={label}>
                              <Box
                                aria-label={`${n.name}, ${dayjs(d).format("ddd D MMM")}, ${label}`}
                                sx={{
                                  width: 28, height: 28, borderRadius: 1, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12,
                                  ...(on ? { bgcolor: BRAND.action, color: "#fff" } : there ? { border: "1px dashed", borderColor: "divider", color: "text.secondary", bgcolor: "action.hover" } : { color: "text.disabled" }),
                                }}
                              >
                                {on || there ? mark[s.name] : "·"}
                              </Box>
                            </Tooltip>
                          );
                          return (
                            <Tooltip key={s.name} title={label}>
                              <span>
                                <Button
                                  size="small"
                                  aria-label={`${n.name}, ${dayjs(d).format("ddd D MMM")}, ${label}`}
                                  aria-pressed={on}
                                  disabled={!canPlan || !!there || busy === `${n.staffId}|${d}|${s.name}`}
                                  onClick={() => toggle(n.staffId, d, s.name)}
                                  variant={on ? "contained" : "outlined"}
                                  sx={{
                                    minWidth: 28, width: 28, height: 28, p: 0, fontWeight: 800, fontSize: 12,
                                    ...(there ? { bgcolor: "action.disabledBackground", borderStyle: "dashed" } : {}),
                                    ...(!on && !there ? { color: "text.disabled", borderColor: "divider" } : {}),
                                  }}
                                >
                                  {mark[s.name]}
                                </Button>
                              </span>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
