import { useState } from "react";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Tabs, Tab, TextField, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, LinearProgress, Alert,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";

/**
 * The six theatre reports.
 *
 * Every number here comes from the six timestamps on the operative record, so
 * each report says how much of its data it could actually measure. A
 * utilisation figure of 12% means either a quiet theatre or an unfilled record,
 * and a report that cannot tell you which is worse than no report.
 */

const REPORTS = [
  { key: "utilisation", label: "Utilisation" },
  { key: "turnaround", label: "Turnaround" },
  { key: "cases", label: "Case mix" },
  { key: "cancellations", label: "Cancellations" },
  { key: "complications", label: "Complications" },
  { key: "revenue", label: "Revenue" },
] as const;

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inr = (n: string | number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const Tile = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
    <Typography variant="h5" sx={{ fontWeight: 800, color: color ?? BRAND.action }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, display: "block" }}>{label}</Typography>
    {sub && <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>{sub}</Typography>}
  </Paper>
);

/** A bar that reads as a proportion without needing a chart library. */
const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, pct))}
    sx={{ height: 8, borderRadius: 4, bgcolor: `${color}22`, "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 4 } }} />
);

export default function OtReports() {
  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [theatreId, setTheatreId] = useState("");
  const [openHours, setOpenHours] = useState("8");

  const report = REPORTS[tab].key;
  const { data: theatres } = useQuery({
    queryKey: ["ot-theatres-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/theatres")).data.data,
  });

  const params = new URLSearchParams({ from, to });
  if (theatreId) params.set("theatreId", theatreId);
  if (report === "utilisation") params.set("openHoursPerDay", openHours || "8");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-report", report, from, to, theatreId, openHours],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/reports/${report}?${params.toString()}`)).data.data,
  });

  const theatreRows = (theatres?.theatres ?? []) as { operatingTheatreId: string; theatreName: string }[];

  return (
    <Box>
      <PageHeader title="Theatre reports" subtitle="Utilisation, turnaround, case mix, cancellations, complications and revenue" />

      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <TextField size="small" select label="Theatre" sx={{ minWidth: 200 }} value={theatreId} onChange={(e) => setTheatreId(e.target.value)}>
            <MenuItem value=""><em>All theatres</em></MenuItem>
            {theatreRows.map((t) => <MenuItem key={t.operatingTheatreId} value={t.operatingTheatreId}>{t.theatreName}</MenuItem>)}
          </TextField>
          {report === "utilisation" && (
            <TextField size="small" type="number" label="Open hours a day" sx={{ width: 170 }}
              value={openHours} onChange={(e) => setOpenHours(e.target.value)}
              helperText="The denominator" />
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 700 } }}>
          {REPORTS.map((r) => <Tab key={r.key} label={r.label} />)}
        </Tabs>
      </Paper>

      {isLoading ? <ListSkeleton />
        : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        : report === "utilisation" ? <Utilisation d={data} />
        : report === "turnaround" ? <Turnaround d={data} />
        : report === "cases" ? <CaseMix d={data} />
        : report === "cancellations" ? <Cancellations d={data} />
        : report === "complications" ? <Complications d={data} />
        : <Revenue d={data} />}
    </Box>
  );
}

type Any = Record<string, never>;
const rows = <T,>(d: unknown, key: string): T[] => ((d as Record<string, T[]>)?.[key] ?? []);
const val = (d: unknown, path: string[]): unknown =>
  path.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], d);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
    {children}
  </Paper>
);

const Empty = ({ what }: { what: string }) => (
  <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>
    No {what} in this period.
  </Typography>
);

function Utilisation({ d }: { d: Any }) {
  const t = rows<Record<string, number | string | null>>(d, "theatres");
  const totals = val(d, ["totals"]) as Record<string, number | null> | undefined;
  const cov = val(d, ["coverage"]) as Record<string, number | string> | undefined;
  const measured = Number(cov?.casesWithBothTimes ?? 0);
  const inRange = Number(cov?.casesInRange ?? 0);

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Cases" value={totals?.cases ?? 0} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Hours used" value={totals?.actualHours ?? 0} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Hours available" value={totals?.availableHours ?? 0} sub={`${val(d, ["openHoursPerDay"])} h a day × ${val(d, ["days"])} days`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Utilisation" value={totals?.utilisationPct == null ? "—" : `${totals.utilisationPct}%`}
          sub={totals?.utilisationPct == null ? "Nothing measurable yet" : undefined}
          color={totals?.utilisationPct == null ? undefined : SEMANTIC.success} /></Grid>
      </Grid>

      {/* The number is only as good as the records behind it, and saying so is
          the difference between a report and a guess. */}
      {inRange > 0 && measured < inRange && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {measured} of {inRange} cases have both a wheel-in and a wheel-out time. The rest are not counted here,
          so this figure understates how busy the theatres were.
        </Alert>
      )}

      <Card title="By theatre">
        {t.length === 0 ? <Empty what="theatres" /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Theatre</TableCell>
                <TableCell align="right">Cases</TableCell>
                <TableCell align="right">Measured</TableCell>
                <TableCell align="right">Hours used</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell sx={{ width: 180 }}>Utilisation</TableCell>
                <TableCell align="right">Ran to plan</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {t.map((r) => (
                <TableRow key={String(r.operatingTheatreId)}>
                  <TableCell sx={{ fontWeight: 700 }}>{String(r.theatreName)}</TableCell>
                  <TableCell align="right">{r.cases}</TableCell>
                  <TableCell align="right" sx={{ color: r.casesMeasured !== r.cases ? SEMANTIC.warning : "inherit" }}>{r.casesMeasured}</TableCell>
                  <TableCell align="right">{r.actualHours}</TableCell>
                  <TableCell align="right">{r.availableHours}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: 1 }}><Bar pct={Number(r.utilisationPct ?? 0)} color={BRAND.action} /></Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 34 }}>{r.utilisationPct == null ? "—" : `${r.utilisationPct}%`}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {r.planAccuracyPct == null ? "—" : (
                      <Chip size="small" label={`${r.planAccuracyPct}%`}
                        sx={{
                          height: 20, fontWeight: 700,
                          bgcolor: Number(r.planAccuracyPct) > 110 ? `${SEMANTIC.danger}1a` : `${SEMANTIC.success}1a`,
                          color: Number(r.planAccuracyPct) > 110 ? SEMANTIC.danger : SEMANTIC.success,
                        }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 2 }}>
          "Ran to plan" is actual time against booked time. Over 100% means lists routinely run late.
        </Typography>
      </Card>
    </>
  );
}

function Turnaround({ d }: { d: Any }) {
  const t = rows<Record<string, number | string | null>>(d, "theatres");
  const longest = rows<Record<string, number | string>>(d, "longest");
  const overall = val(d, ["overall"]) as Record<string, number | null> | undefined;

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 4 }}><Tile label="Gaps measured" value={overall?.gaps ?? 0} /></Grid>
        <Grid size={{ xs: 6, md: 4 }}><Tile label="Average turnaround" value={overall?.averageMinutes == null ? "—" : `${overall.averageMinutes} min`} /></Grid>
      </Grid>
      <Card title="By theatre">
        {t.length === 0 ? <Empty what="back-to-back cases" /> : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Theatre</TableCell><TableCell align="right">Gaps</TableCell>
              <TableCell align="right">Average</TableCell><TableCell align="right">Shortest</TableCell><TableCell align="right">Longest</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {t.map((r) => (
                <TableRow key={String(r.theatreName)}>
                  <TableCell sx={{ fontWeight: 700 }}>{String(r.theatreName)}</TableCell>
                  <TableCell align="right">{r.gaps}</TableCell>
                  <TableCell align="right">{r.averageMinutes} min</TableCell>
                  <TableCell align="right">{r.shortestMinutes} min</TableCell>
                  <TableCell align="right" sx={{ color: Number(r.longestMinutes) > 60 ? SEMANTIC.danger : "inherit", fontWeight: 700 }}>
                    {r.longestMinutes} min
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Card title="The longest gaps — the ones worth asking about">
        {longest.length === 0 ? <Empty what="gaps" /> : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Theatre</TableCell><TableCell>Day</TableCell><TableCell>After</TableCell><TableCell>Before</TableCell><TableCell align="right">Gap</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {longest.map((g, i) => (
                <TableRow key={i}>
                  <TableCell>{String(g.theatreName)}</TableCell>
                  <TableCell>{String(g.day)}</TableCell>
                  <TableCell>{String(g.afterCase)}</TableCell>
                  <TableCell>{String(g.beforeCase)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{g.minutes} min</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function CaseMix({ d }: { d: Any }) {
  const total = Number(val(d, ["total"]) ?? 0);
  const groups: { title: string; key: string }[] = [
    { title: "By surgeon", key: "bySurgeon" },
    { title: "By procedure", key: "byProcedure" },
    { title: "By anaesthesia", key: "byAnaesthesia" },
    { title: "Major / minor", key: "byType" },
    { title: "Planned / emergency", key: "byUrgency" },
    { title: "By ASA grade", key: "byAsaGrade" },
  ];
  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}><Tile label="Cases" value={total} sub="Cancelled cases excluded" /></Grid>
      </Grid>
      <Grid container spacing={2}>
        {groups.map((g) => {
          const list = rows<{ key: string; count: number }>(d, g.key);
          return (
            <Grid size={{ xs: 12, md: 6 }} key={g.key}>
              <Card title={g.title}>
                {list.length === 0 ? <Empty what="cases" /> : (
                  <Stack spacing={1.25}>
                    {list.slice(0, 10).map((r) => (
                      <Box key={r.key}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: "75%" }}>{r.key}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.count}</Typography>
                        </Box>
                        <Bar pct={total ? (r.count / total) * 100 : 0} color={BRAND.action} />
                      </Box>
                    ))}
                    {list.length > 10 && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        and {list.length - 10} more
                      </Typography>
                    )}
                  </Stack>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </>
  );
}

function Cancellations({ d }: { d: Any }) {
  const byReason = rows<Record<string, string | number>>(d, "byReason");
  const cases = rows<Record<string, string | null>>(d, "cases");
  const rate = val(d, ["cancellationRatePct"]) as number | null;
  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4, md: 3 }}><Tile label="Booked" value={Number(val(d, ["booked"]) ?? 0)} /></Grid>
        <Grid size={{ xs: 4, md: 3 }}><Tile label="Cancelled" value={Number(val(d, ["cancelled"]) ?? 0)} color={SEMANTIC.danger} /></Grid>
        <Grid size={{ xs: 4, md: 3 }}><Tile label="Cancellation rate" value={rate == null ? "—" : `${rate}%`} color={SEMANTIC.danger} /></Grid>
      </Grid>
      <Card title="Why cases were cancelled">
        {byReason.length === 0 ? <Empty what="cancellations" /> : (
          <Stack spacing={1.5}>
            {byReason.map((r) => (
              <Box key={String(r.reason)}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(r.label)}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.count} · {r.sharePct}%</Typography>
                </Box>
                <Bar pct={Number(r.sharePct)} color={SEMANTIC.danger} />
              </Box>
            ))}
          </Stack>
        )}
      </Card>
      <Card title="The cases">
        {cases.length === 0 ? <Empty what="cancellations" /> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Procedure</TableCell><TableCell>Was booked for</TableCell><TableCell>Reason</TableCell></TableRow></TableHead>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={String(c.surgeryId)}>
                  <TableCell sx={{ fontWeight: 600 }}>{String(c.procedureName)}</TableCell>
                  <TableCell>{c.scheduledStart ? new Date(String(c.scheduledStart)).toLocaleString() : "—"}</TableCell>
                  <TableCell>{String(c.reason ?? "—").replace(/_/g, " ").toLowerCase()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Complications({ d }: { d: Any }) {
  const list = rows<Record<string, string | null>>(d, "complications");
  const returns = rows<Record<string, string | number | null>>(d, "unplannedReturns");
  const cov = val(d, ["coverage"]) as Record<string, number | string> | undefined;
  const cases = Number(val(d, ["cases"]) ?? 0);
  const withRecord = Number(cov?.casesWithARecord ?? 0);

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Cases" value={cases} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="With complications" value={list.length} color={SEMANTIC.danger} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Rate" value={val(d, ["complicationRatePct"]) == null ? "—" : `${val(d, ["complicationRatePct"])}%`} color={SEMANTIC.danger} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Unplanned returns" value={returns.length} sub="Back in theatre within 30 days" color={SEMANTIC.warning} /></Grid>
      </Grid>

      {cases > 0 && withRecord < cases && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {withRecord} of {cases} cases have an operative record. A case without one cannot report a
          complication either way, so this rate is a floor, not a measurement.
        </Alert>
      )}

      <Card title="Complications recorded">
        {list.length === 0 ? <Empty what="complications" /> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Patient</TableCell><TableCell>Procedure</TableCell><TableCell>When</TableCell><TableCell>What happened</TableCell></TableRow></TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={String(c.surgeryId)}>
                  <TableCell sx={{ fontWeight: 600 }}>{c.patientName} <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>{c.uhid}</Typography></TableCell>
                  <TableCell>{c.procedureName}</TableCell>
                  <TableCell>{c.at ? new Date(String(c.at)).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{c.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title="Unplanned returns to theatre">
        {returns.length === 0 ? <Empty what="returns" /> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Patient</TableCell><TableCell>First operation</TableCell><TableCell>Came back for</TableCell><TableCell align="right">Days later</TableCell></TableRow></TableHead>
            <TableBody>
              {returns.map((r, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.patientName} <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>{r.uhid}</Typography></TableCell>
                  <TableCell>{r.firstProcedure}</TableCell>
                  <TableCell>{r.returnProcedure}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: Number(r.daysBetween) <= 7 ? SEMANTIC.danger : "inherit" }}>{r.daysBetween}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Revenue({ d }: { d: Any }) {
  const byType = rows<Record<string, string | number>>(d, "byType");
  const byDoctor = rows<Record<string, string>>(d, "byDoctor");
  const notItemised = val(d, ["notItemised"]) as Record<string, string | number> | undefined;

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}><Tile label="Itemised theatre revenue" value={inr(val(d, ["itemisedTotal"]) as string)} color={SEMANTIC.success} /></Grid>
      </Grid>

      {Number(notItemised?.cases ?? 0) > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notItemised?.cases} case{Number(notItemised?.cases) === 1 ? "" : "s"} worth {inr(notItemised?.total as string)} carry
          a single price and cannot be split by line type, so they are excluded from the breakdown below.
        </Alert>
      )}

      <Card title="What theatre revenue is made of">
        {byType.length === 0 ? <Empty what="itemised charges" /> : (
          <Stack spacing={1.5}>
            {byType.map((r) => (
              <Box key={String(r.chargeType)}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(r.label)}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{inr(r.total as string)} · {r.sharePct}%</Typography>
                </Box>
                <Bar pct={Number(r.sharePct)} color={BRAND.action} />
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      <Card title="Fees by doctor">
        {byDoctor.length === 0 ? <Empty what="attributed fees" /> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Doctor</TableCell><TableCell align="right">Earned</TableCell></TableRow></TableHead>
            <TableBody>
              {byDoctor.map((r) => (
                <TableRow key={String(r.doctorId)}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{inr(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 2 }}>
          Only fees recorded against a named doctor appear here. An unattributed fee is revenue, but not anybody's earnings.
        </Typography>
      </Card>
    </>
  );
}
