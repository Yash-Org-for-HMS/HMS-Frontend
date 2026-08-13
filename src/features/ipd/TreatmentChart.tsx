import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Typography, Tabs, Tab, Button, Chip, IconButton, Divider, Table,
  TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PrintRounded, ChevronLeftRounded, ChevronRightRounded, ArrowBackRounded,
  WarningAmberRounded, CheckCircleRounded, RadioButtonUncheckedRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { apiErrorText } from "@/utils/apiError";
import dayjs from "dayjs";

/**
 * The ward file: one page per admission, showing the whole chart day at once.
 *
 * The dialogs on the ward page are for RECORDING — quick, one thing at a time,
 * at the bedside. This is for READING: the day on one surface, in time order,
 * the way the paper file works and the reason it works. It is also what gets
 * printed and signed at discharge, so the print is a first-class output rather
 * than a browser afterthought.
 */

const ROW_H = 34;

export default function TreatmentChart() {
  const { admissionId = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ["ward-chart-profile"],
    queryFn: async () => (await axiosInstance.get("/ipd/chart-profile")).data.data,
    staleTime: 5 * 60_000,
  });
  const chartDayStart: string = profile?.chartDayStart ?? "08:00";
  const [startH, startM] = chartDayStart.split(":").map(Number);

  const anchor = dayjs().hour(startH).minute(startM).second(0).millisecond(0);
  const dayStart = (dayjs().isBefore(anchor) ? anchor.subtract(1, "day") : anchor).add(dayOffset, "day");
  const from = dayStart.toISOString();
  const to = dayStart.add(1, "day").subtract(1, "millisecond").toISOString();
  const dateStr = dayStart.format("YYYY-MM-DD");

  const { data: header, isLoading: headerLoading, isError, error, refetch } = useQuery({
    queryKey: ["chart-header", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/chart-header`)).data.data,
    enabled: !!admissionId,
  });

  const { data: obs } = useQuery({
    queryKey: ["ipd-observations", admissionId, from, to],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/observations`, { params: { from, to } })).data.data,
    enabled: !!admissionId,
  });

  const { data: fluid } = useQuery({
    queryKey: ["ipd-fluid-balance", admissionId, from, to],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/fluid-balance`, { params: { from, to } })).data.data,
    enabled: !!admissionId,
  });

  const { data: handover } = useQuery({
    queryKey: ["ipd-handover", admissionId, dateStr],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/handover`, { params: { date: dateStr } })).data.data,
    enabled: !!admissionId,
  });

  if (headerLoading) return <Box sx={{ p: 3 }}><ListSkeleton rows={8} /></Box>;
  if (isError) return <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>;

  const observations: any[] = (obs?.observations ?? []).filter((o: any) => !o.supersededByObservationId);
  // Already narrowed to this patient's ward by the server, and still carrying
  // any switched-off field a reading on this day used.
  const obsFields: any[] = obs?.fields ?? [];
  const entries: any[] = (fluid?.entries ?? []).filter((e: any) => !e.supersededByEntryId);
  const totals = fluid?.totals;
  const medsGiven: any[] = fluid?.medicationsGiven ?? [];
  const allergies: any[] = header?.allergies ?? [];

  const cell = (v: any, suffix = "") => (v === null || v === undefined ? "" : `${v}${suffix}`);

  /**
   * Pins the time column while a chart wide enough to scroll does so. Dropped
   * under print, where nothing scrolls and a sticky cell only risks painting
   * over a neighbour.
   */
  const STICKY_TIME = {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    backgroundColor: "inherit",
    boxShadow: "1px 0 0 rgba(0,0,0,0.08)",
    "@media print": { position: "static" as const, boxShadow: "none" },
  };

  /** Outside the hospital's own normal range for that observation. Marked, never refused. */
  const outOfNormal = (f: any, raw: any) => {
    if (f?.dataType !== "NUMBER" || raw === undefined || raw === "") return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    return (f.normalLow !== null && n < f.normalLow) || (f.normalHigh !== null && n > f.normalHigh);
  };

  return (
    <Box sx={{
      pb: 6,
      // Print as a ward file, not as a web page: no app chrome, no controls, and
      // the tables kept whole rather than split across a page break.
      "@media print": {
        "& .no-print": { display: "none !important" },
        "& .print-block": { breakInside: "avoid" },
        p: 0,
      },
    }}>
      {/* Print as a ward file: the app shell has no place on a sheet that goes
          into a patient's folder. Scoped to this page (the style tag unmounts
          with it) and to print media only, so nothing on screen is affected. */}
      <style>{`@media print {
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #fff; }
        .MuiDrawer-root, .MuiAppBar-root, .MuiToolbar-root { display: none !important; }
        main { padding: 0 !important; width: 100% !important; min-height: 0 !important; }
        /* A hospital that charts its own observations can push this table past
           the width of the sheet, and a chart that prints with its last columns
           guillotined off is worse than one that prints small. Tables are
           compacted to fit the page rather than being allowed to overflow it. */
        .MuiTableContainer-root { overflow: visible !important; }
        table { width: 100% !important; }
        th, td {
          font-size: 8.5pt !important;
          padding: 3px 4px !important;
          /* Wrap, but only at spaces: "Head circumference (cm)" over three
             lines reads fine, "HEAD CIRCUM FERENC E" does not. Column widths
             stay automatic so TIME gets a sliver and REMARK gets the room. */
          white-space: normal !important;
          overflow-wrap: normal;
          word-break: normal;
        }
      }`}</style>

      <Box className="no-print" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ textTransform: "none" }}>Back to ward</Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setDayOffset((d) => d - 1)}><ChevronLeftRounded /></IconButton>
          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 150, textAlign: "center" }}>
            {dayOffset === 0 ? "Today" : dayStart.format("DD MMM YYYY")} · {chartDayStart}–{chartDayStart}
          </Typography>
          <IconButton size="small" onClick={() => setDayOffset((d) => d + 1)} disabled={dayOffset >= 0}><ChevronRightRounded /></IconButton>
          <Button variant="outlined" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ textTransform: "none", ml: 1 }}>Print</Button>
        </Box>
      </Box>

      {/* ── The header every sheet in the file carries ────────────────────── */}
      <Paper elevation={0} className="print-block" sx={{ p: 2.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>{header?.patientName}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {[header?.uhid, header?.admissionNumber, header?.age, header?.gender, header?.bloodGroup].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {[header?.wardName, header?.bedLabel].filter(Boolean).join(" · ") || "No bed"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              {header?.admittingDoctor ?? "—"}
              {header?.admissionDate ? ` · admitted ${dayjs(header.admissionDate).format("DD MMM")}` : ""}
              {header?.dayOfStay ? ` · day ${header.dayOfStay}` : ""}
            </Typography>
            {header?.weightKg != null && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Weight {header.weightKg} kg</Typography>
            )}
          </Box>
        </Box>

        {/* Allergies belong at the top of a chart, where they are read before an
            order is written — not buried in a patient profile. */}
        <Divider sx={{ my: 1.5 }} />
        {allergies.length === 0 ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>No known allergies recorded.</Typography>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <WarningAmberRounded sx={{ color: SEMANTIC.danger, fontSize: 18 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: SEMANTIC.danger }}>ALLERGIES</Typography>
            {allergies.map((a, i) => (
              <Chip key={i} size="small" label={`${a.allergen}${a.severity ? ` (${a.severity})` : ""}`}
                sx={{ bgcolor: alpha(SEMANTIC.danger, 0.12), color: SEMANTIC.danger, fontWeight: 700 }} />
            ))}
          </Box>
        )}
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} className="no-print" sx={{ mb: 2 }}>
        <Tab label="Nursing chart" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab label="Handover" sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>

      {/* Both sheets print; only the selected one shows on screen. */}
      <Box sx={{ display: tab === 0 ? "block" : "none", "@media print": { display: "block" } }}>
        <Paper elevation={0} className="print-block" sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", mb: 2 }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Observations</Typography>
          </Box>
          {observations.length === 0 ? (
            <Box sx={{ p: 3 }}><Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing recorded for this chart day.</Typography></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {[
                      "Time", "Temp", "Pulse", "Resp", "BP", "SpO₂", "RBS", "Pain",
                      // This hospital's own columns, in the order it set. They
                      // print with the rest — a sheet in the folder has to be
                      // the whole chart, not the standard part of it.
                      ...obsFields.map((f: any) => (f.unit ? `${f.label} (${f.unit})` : f.label)),
                      "Remark", "By",
                    ].map((h, i) => (
                      <TableCell key={h}
                        sx={{
                          fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase",
                          color: "text.secondary", whiteSpace: "nowrap",
                          // Time stays put while a wide chart scrolls — see the
                          // observation dialog for why. Released for print, where
                          // the whole width is on the page anyway.
                          ...(i === 0 ? STICKY_TIME : null),
                        }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {observations.map((o) => (
                    <TableRow key={o.observationId} sx={{ height: ROW_H, bgcolor: "background.paper" }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", ...STICKY_TIME }}>{dayjs(o.observedAt).format("HH:mm")}</TableCell>
                      <TableCell>{o.temperature === null ? "" : `${o.temperature}°${o.temperatureUnit ?? ""}`}</TableCell>
                      <TableCell>{cell(o.pulseRate)}</TableCell>
                      <TableCell>{cell(o.respiratoryRate)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{o.bpSystolic === null ? "" : `${o.bpSystolic}/${o.bpDiastolic}`}</TableCell>
                      <TableCell>{cell(o.spo2, "%")}</TableCell>
                      <TableCell>{cell(o.bloodSugar)}</TableCell>
                      <TableCell>{cell(o.painScore)}</TableCell>
                      {obsFields.map((f: any) => {
                        const v = o.extras?.[f.observationFieldId];
                        const flag = outOfNormal(f, v);
                        return (
                          <TableCell key={f.observationFieldId}
                            sx={{ whiteSpace: "nowrap", color: flag ? SEMANTIC.danger : undefined, fontWeight: flag ? 700 : undefined }}>
                            {v === undefined || v === "" ? "" : String(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ fontSize: "0.8rem" }}>{o.remark || ""}</TableCell>
                      <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>{o.recordedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Paper elevation={0} className="print-block" sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Intake &amp; output</Typography>
            {totals && (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                In {totals.intakeMl} ml · Out {totals.outputMl} ml ·{" "}
                <Box component="span" sx={{ color: totals.balanceMl < 0 ? SEMANTIC.danger : SEMANTIC.success }}>
                  Balance {totals.balanceMl} ml
                </Box>
                {totals.previousBalanceMl ? ` · carried ${totals.previousBalanceMl} ml → running ${totals.runningBalanceMl} ml` : ""}
              </Typography>
            )}
          </Box>
          {entries.length === 0 ? (
            <Box sx={{ p: 3 }}><Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing recorded for this chart day.</Typography></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Time", "In / Out", "Type", "What", "Volume", "Times", "By"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.fluidEntryId} sx={{ height: ROW_H }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{dayjs(e.occurredAt).format("HH:mm")}</TableCell>
                      <TableCell>{e.direction === "IN" ? "In" : "Out"}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{e.fluidType}</TableCell>
                      <TableCell>{e.label || ""}</TableCell>
                      <TableCell>{e.volumeMl != null ? `${e.volumeMl} ml` : ""}</TableCell>
                      <TableCell>{e.occurrences != null ? `×${e.occurrences}` : ""}</TableCell>
                      <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>{e.recordedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        {medsGiven.length > 0 && (
          <Paper elevation={0} className="print-block" sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", mt: 2 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Medicines given</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                From the medication record — shown here so a drug is not written on the chart twice.
                Not added to the intake total, since the volume a dose contributes is unknown.
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Time", "Medicine", "Dose", "Route", "Note", "Given by"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {medsGiven.map((m: any) => (
                    <TableRow key={m.ipMedAdminId} sx={{ height: ROW_H }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{dayjs(m.administeredAt).format("HH:mm")}</TableCell>
                      <TableCell>{m.medicineName}</TableCell>
                      <TableCell>{m.dosage || ""}</TableCell>
                      <TableCell>{m.route || ""}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{m.notes || ""}</TableCell>
                      <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>{m.givenBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>

      <Box sx={{ display: tab === 1 ? "block" : "none", "@media print": { display: "block", pageBreakBefore: "always" } }}>
        {(handover?.shifts ?? []).map((s: any) => (
          <Paper key={s.shiftName} elevation={0} className="print-block"
            sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", mb: 2 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.shiftName}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.shiftStart} – {s.shiftEnd}</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 2 }}>
              {s.notes.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>Nothing handed over.</Typography>
              ) : (
                s.notes.map((n: any) => (
                  <Box key={n.handoverEntryId} sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{n.noteText}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{n.author} · {dayjs(n.createdAt).format("DD MMM, HH:mm")}</Typography>
                  </Box>
                ))
              )}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {s.signOffs.map((so: any) => (
                  <Box key={so.role} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {so.signed
                      ? <CheckCircleRounded sx={{ fontSize: 16, color: SEMANTIC.success }} />
                      : <RadioButtonUncheckedRounded sx={{ fontSize: 16, color: NEUTRAL.muted }} />}
                    <Typography variant="caption" sx={{ color: so.signed ? "text.primary" : "text.secondary", fontWeight: so.signed ? 600 : 400 }}>
                      {so.role}{so.signed ? ` — ${so.by}, ${dayjs(so.at).format("HH:mm")}` : " — not signed"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
