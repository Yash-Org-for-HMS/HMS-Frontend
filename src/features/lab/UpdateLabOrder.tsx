import { orderStatusLabel } from "@/utils/statusColors";
import { evaluateCriticalValue, rangeFlag, isInternalTestCode, needsNumber, isNumberResult } from "@/utils/labFlags";
import { useState, useEffect } from "react";
import { usePrintWindow } from "@/utils/usePrintWindow";
import type { LabOrderDetail, LabReportRow } from "./labOrders.types";
import type { UnbilledItem } from "@/types";
import { DETAIL_PAGE_WIDTH } from "@/components/layout/pageWidth";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "@/components/ErrorState";
import {
  Box, Typography, Paper, Grid, TextField, Button, Alert, Chip, Divider, Avatar,
  Tooltip, LinearProgress,
  Checkbox, FormControlLabel,
} from "@mui/material";
import {
  SaveRounded, ArrowBackRounded, ScienceRounded, AccessTimeRounded, PrintRounded, VerifiedRounded,
  BadgeRounded, LocalHospitalRounded, WarningAmberRounded, CheckCircleRounded,
  ReceiptLongRounded, PaymentsRounded,
} from "@mui/icons-material";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { typeScale } from "@/styles/typography";
import { getInitials, formatDateTime } from "@/utils/format";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { axiosInstance } from "@/api/axios";
import { useParams, useNavigate } from "react-router-dom";
import PointOfCarePOS from "@/components/billing/PointOfCarePOS";
import { useLabVerification } from "./useLabVerification";

/** The editable result rows, keyed by labReportId. */
type ResultDraft = Record<string, { value: string; range: string; remarks: string; critical?: boolean }>;

const LAB = BRAND.action;
const LAB_DARK = BRAND.actionDark;

// The critical rules and the low/high reading are shared with the doctor's
// results and the printed report (utils/labFlags), mirroring the server.

// A small label/value stack for the summary facts row.
function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box sx={{ color: LAB, mt: 0.25, display: "flex" }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ ...typeScale.sectionLabel, mb: 0.25 }}>{label}</Typography>
        <Box sx={{ ...typeScale.bodyStrong, color: "text.primary" }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default function UpdateLabOrder() {
  const verifies = useLabVerification();
  const openPrint = usePrintWindow();
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  const [results, setResults] = useState<ResultDraft>({});
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);
  // Changing a result already entered is an amendment: it needs a reason.
  const [amendReason, setAmendReason] = useState("");

  const { data: order, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["lab-order", id],
    queryFn: async (): Promise<LabOrderDetail> => (await axiosInstance.get(`/lab/orders/${id}`)).data.data,
    enabled: !!id,
  });

  // Authoritative amount + per-line GST for the POS come from /billing/unbilled
  // (server-priced), not the client-summed report prices - same source the lab
  // billing queue uses, so the collection preview matches the invoice.
  const { data: posItem } = useQuery({
    queryKey: ["lab-order-unbilled", order?.patientId, id],
    enabled: showPOS && !!order?.patientId,
    queryFn: async () => {
      const items = (await axiosInstance.get(`/billing/unbilled/${order!.patientId}`)).data.data || [];
      return items.find((it: UnbilledItem) => it.id === order!.labOrderId) || null;
    },
  });

  // Seed the editable result rows when the order loads (or after a refetch).
  useEffect(() => {
    if (!order) return;
    const initialResults: ResultDraft = {};
    order.reports.forEach((r: LabReportRow) => {
      initialResults[r.labReportId] = {
        value: r.resultValue === "PENDING" ? "" : r.resultValue ?? "",
        range: r.normalRange === "N/A" ? "" : r.normalRange ?? "",
        remarks: r.remarks || "",
        // undefined = no explicit call yet, so the rules decide. Seeded only when
        // the saved flag DISAGREES with the rules, so reopening a report keeps a
        // human override instead of silently reverting to the automatic verdict.
        critical: r.isCritical !== evaluateCriticalValue(r.labTest?.testCode || "", r.resultValue || "", r.labTest?.testName) ? r.isCritical ?? undefined : undefined,
      };
    });
    setResults(initialResults);
  }, [order]);

  // Results already entered that the draft changes (amendments).
  const amendedCount = (order?.reports ?? []).filter((r: LabReportRow) => {
    const saved = (r.resultValue ?? "").trim();
    if (!saved || saved.toUpperCase() === "PENDING") return false;
    return saved !== (results[r.labReportId]?.value ?? "").trim();
  }).length;

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const payload = Object.entries(results).map(([labReportId, data]) => ({
        labReportId,
        resultValue: data.value || "PENDING",
        normalRange: data.range || "N/A",
        remarks: data.remarks || "",
        ...(typeof data.critical === "boolean" ? { isCritical: data.critical } : {}),
      }));

      await axiosInstance.put(`/lab/orders/${id}/results`, { results: payload, ...(amendedCount > 0 ? { amendmentReason: amendReason.trim() } : {}) });
      setMessage({ type: "success", text: amendedCount > 0 ? "Results amended. Any verification was cleared and the doctor has been notified." : "Lab results updated successfully!" });
      setAmendReason("");
      setTimeout(() => refetch(), 1000);
    } catch (err) {
      setMessage({ type: "error", text: getApiErrorMessage(err, "Failed to update results.") });
    } finally {
      setSaving(false);
    }
  };

  // Pathologist sign-off: stamps every result of this order as verified. Results
  // are already visible to the ordering doctor before this; verifying flips them
  // from "Unverified" to "Verified" (advisory, non-blocking).
  const handleVerify = async () => {
    try {
      setVerifying(true);
      setMessage(null);
      await axiosInstance.put(`/lab/orders/${id}/verify`);
      setMessage({ type: "success", text: "Results verified." });
      setTimeout(() => refetch(), 800);
    } catch (err) {
      setMessage({ type: "error", text: getApiErrorMessage(err, "Failed to verify results.") });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (isError || !order) {
    return <ErrorState title="Couldn't load lab order" message={getApiErrorMessage(error, "Order not found")} onRetry={() => refetch()} />;
  }

  const reports: LabReportRow[] = order.reports ?? [];
  const patientName = `${order.patient?.firstName || ""} ${order.patient?.lastName || ""}`.trim() || "Unknown patient";
  const doctorName = `${order.doctor?.user?.firstName || ""} ${order.doctor?.user?.lastName || ""}`.trim() || "-";
  const paid = order.paymentStatus === "PAID";
  // Inpatient (admission-linked) orders are settled on the discharge bill against
  // the deposit - they're never collected at the POS counter (the billing endpoint
  // excludes them, so a POS attempt 400s "not a billable item").
  const ipd = !!order.admissionId;
  const collected = !!order.sampleCollectedAt;
  const locked = !!order.billingLockActive;
  const gatedByCollection = order.status === "PENDING" && !collected;
  const canEdit = !locked && !gatedByCollection;

  const enteredCount = reports.filter((r) => (results[r.labReportId]?.value || "").trim()).length;
  const criticalCount = reports.filter((r) => evaluateCriticalValue(r.labTest?.testCode || "", results[r.labReportId]?.value || "", r.labTest?.testName)).length;
  const total = reports.length;
  const pct = total ? Math.round((enteredCount / total) * 100) : 0;

  const set = (rid: string, key: "value" | "range" | "remarks" | "critical", v: string | boolean) =>
    setResults({ ...results, [rid]: { ...results[rid], [key]: v } });

  return (
    <Box sx={{ maxWidth: DETAIL_PAGE_WIDTH, mx: "auto", width: "100%" }}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/lab/orders")} sx={{ mb: 2, color: "text.secondary" }}>
        Back to Queue
      </Button>

      {/* ── Header: title + primary actions ─────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: `${LAB}1a`, color: LAB_DARK, width: 44, height: 44 }}>
            <ScienceRounded />
          </Avatar>
          <Box>
            <Typography sx={{ ...typeScale.pageTitle }}>Lab Order</Typography>
            <Typography sx={{ ...typeScale.caption, fontFamily: "monospace", letterSpacing: "0.02em" }}>{order.sampleBarcode}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {!paid && !ipd && (
            <Button size="small" variant="outlined" color="success" startIcon={<PaymentsRounded />} onClick={() => setShowPOS(true)}>
              Collect Payment
            </Button>
          )}
          {!verifies ? null : order.verified ? (
            <Chip icon={<VerifiedRounded />} color="success" variant="outlined"
              label={`Verified${order.verifiedByName ? ` · ${order.verifiedByName}` : ""}`} sx={{ fontWeight: 700 }} />
          ) : order.status === "COMPLETED" && (
            <Button variant="contained" color="success" startIcon={<VerifiedRounded />} onClick={handleVerify} disabled={verifying || locked}>
              {verifying ? "Verifying…" : "Verify Results"}
            </Button>
          )}
          {(order.status === "COMPLETED" || order.status === "VERIFIED") && (
            <Button variant="contained" startIcon={<PrintRounded />}
              onClick={() => openPrint(`/lab/orders/${id}/print`)}
              sx={{ bgcolor: LAB_DARK, "&:hover": { bgcolor: LAB } }}>
              Print Report
            </Button>
          )}
        </Box>
      </Box>

      {message && <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>{message.text}</Alert>}

      {/* ── Summary card ────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ borderRadius: 3, mb: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ height: 4, bgcolor: LAB }} />
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar sx={{ bgcolor: `${LAB}14`, color: LAB_DARK, fontWeight: 700 }}>{getInitials(patientName)}</Avatar>
              <Box>
                <Typography sx={{ ...typeScale.cardTitle }}>{patientName}</Typography>
                <Typography sx={{ ...typeScale.caption }}>UHID {order.patient?.uhidNumber || "-"}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {ipd ? (
                <Chip size="small" label="Inpatient · billed at discharge" color="info" variant="outlined" sx={{ fontWeight: 700 }} />
              ) : (
                <Chip size="small" label={paid ? "Paid" : "Unpaid"} color={paid ? "success" : "error"}
                  variant={paid ? "filled" : "outlined"} sx={{ fontWeight: 700 }} />
              )}
              <Chip size="small" icon={collected ? <CheckCircleRounded /> : undefined}
                label={orderStatusLabel(order.status)}
                color={order.status === "COMPLETED" || order.status === "VERIFIED" ? "success" : "warning"}
                sx={{ fontWeight: 700 }} />
            </Box>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Fact icon={<LocalHospitalRounded fontSize="small" />} label="Referring Doctor">{doctorName}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Fact icon={<BadgeRounded fontSize="small" />} label="Sample">
                {collected
                  ? <Chip size="small" icon={<CheckCircleRounded />} label="Collected" color="success" variant="outlined" sx={{ height: 22 }} />
                  : <Chip size="small" label="Not collected" color="default" variant="outlined" sx={{ height: 22 }} />}
              </Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Fact icon={<AccessTimeRounded fontSize="small" />} label="Collected At">
                {collected ? formatDateTime(order.sampleCollectedAt) : "-"}
              </Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Fact icon={<ReceiptLongRounded fontSize="small" />} label="Tests">{total} test{total === 1 ? "" : "s"}</Fact>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* ── Results worksheet ───────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ p: 3, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ ...typeScale.cardTitle }}>Test Results</Typography>
            {criticalCount > 0 && (
              <Chip size="small" icon={<WarningAmberRounded />} color="error"
                label={`${criticalCount} critical`} sx={{ height: 22, fontWeight: 700 }} />
            )}
          </Box>
          <Box sx={{ minWidth: 160 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ ...typeScale.caption }}>Entered</Typography>
              <Typography sx={{ ...typeScale.caption, fontWeight: 700, color: "text.primary" }}>{enteredCount}/{total}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct}
              sx={{ height: 6, borderRadius: 3, bgcolor: "action.hover",
                "& .MuiLinearProgress-bar": { bgcolor: enteredCount === total && total > 0 ? SEMANTIC.success : LAB } }} />
          </Box>
        </Box>

        <Box sx={{ px: 3 }}>
          {locked && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              <strong>Billing lock active.</strong> The invoice for these tests hasn't been paid - result entry is disabled until payment is collected.
            </Alert>
          )}
          {gatedByCollection && !locked && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              <strong>Sample not collected.</strong> Collect the sample before entering results.
            </Alert>
          )}
        </Box>

        <Box sx={{ px: 3, pb: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {reports.map((report: LabReportRow) => {
            const rid = report.labReportId;
            const val = results[rid]?.value || "";
            const autoCritical = evaluateCriticalValue(report.labTest?.testCode || "", val, report.labTest?.testName);
            // Below or above the normal range - shown beside the result, as on any lab report.
            const flag = rangeFlag(val, results[rid]?.range);
            const notANumber = !!val.trim() && needsNumber(results[rid]?.range) && !isNumberResult(val);
            // An explicit call by the technician wins in both directions; the
            // automatic rules only cover five analytes, so anything else that is
            // clinically critical can ONLY be raised by a human.
            const override = results[rid]?.critical;
            const isCriticalNow = typeof override === "boolean" ? override : autoCritical;
            return (
              <Paper key={rid} elevation={0} sx={{
                p: 2, borderRadius: 2,
                border: "1px solid",
                borderColor: isCriticalNow ? SEMANTIC.danger : "divider",
                borderLeftWidth: isCriticalNow ? 4 : 1,
                borderLeftColor: isCriticalNow ? SEMANTIC.danger : "divider",
                bgcolor: isCriticalNow ? "rgba(239,68,68,0.04)" : "background.paper",
                transition: "border-color 0.2s, background-color 0.2s",
              }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {isCriticalNow && (
                      <Tooltip title="Critical panic value - the ordering doctor is alerted on save">
                        <WarningAmberRounded sx={{ color: SEMANTIC.danger, fontSize: 18 }} />
                      </Tooltip>
                    )}
                    <Typography sx={{ ...typeScale.bodyStrong, color: isCriticalNow ? SEMANTIC.danger : "text.primary" }}>
                      {report.labTest?.testName || "Test"}
                    </Typography>
                    {report.labTest?.testCode && !isInternalTestCode(report.labTest.testCode) && (
                      <Chip label={report.labTest.testCode} size="small" variant="outlined"
                        sx={{ height: 20, fontFamily: "monospace", "& .MuiChip-label": { px: 0.75, ...typeScale.chip } }} />
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {isCriticalNow && <Chip label="CRITICAL" size="small" color="error" sx={{ height: 22, fontWeight: 700 }} />}
                    <Tooltip title="Automatic detection only covers a few numeric analytes. Tick this for anything else that needs the ordering doctor's acknowledgement - a positive culture, a reactive screen, an incompatible cross-match.">
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={isCriticalNow}
                            disabled={!canEdit}
                            onChange={(e) => set(rid, "critical", e.target.checked)}
                            sx={{ color: SEMANTIC.danger, "&.Mui-checked": { color: SEMANTIC.danger } }}
                          />
                        }
                        label={<Typography sx={{ ...typeScale.chip, color: "text.secondary" }}>Mark critical</Typography>}
                        sx={{ mr: 0 }}
                      />
                    </Tooltip>
                  </Box>
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth size="small" label="Result" placeholder="-"
                      value={results[rid]?.value || ""}
                      onChange={(e) => set(rid, "value", e.target.value)}
                      disabled={!canEdit}
                      error={isCriticalNow || notANumber}
                      helperText={notANumber ? "Enter a number - the normal range is numeric" : flag ? (flag === "L" ? "Low - below the normal range" : "High - above the normal range") : undefined}
                      FormHelperTextProps={{ sx: { mx: 0, fontWeight: 700, color: notANumber ? undefined : SEMANTIC.warningDark } }}
                      InputProps={{ sx: { fontWeight: 700, ...(isCriticalNow ? { color: SEMANTIC.danger } : flag ? { color: SEMANTIC.warningDark } : {}) } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth size="small" label="Reference range" placeholder="e.g. 4.0–6.0"
                      value={results[rid]?.range || ""}
                      onChange={(e) => set(rid, "range", e.target.value)}
                      disabled={!canEdit}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth size="small" label="Remarks" placeholder="Optional"
                      value={results[rid]?.remarks || ""}
                      onChange={(e) => set(rid, "remarks", e.target.value)}
                      disabled={!canEdit}
                    />
                  </Grid>
                </Grid>
              </Paper>
            );
          })}
        </Box>

        <Box sx={{ p: 3, pt: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ ...typeScale.caption }}>
            {criticalCount > 0
              ? <Box component="span" sx={{ color: SEMANTIC.danger, fontWeight: 700 }}>Critical value(s) present - the doctor is notified on save.</Box>
              : "Results are visible to the ordering doctor as soon as they're saved."}
          </Typography>
          {amendedCount > 0 && (
            <TextField
              size="small" required sx={{ flex: 1, minWidth: 260 }}
              label={`Reason for amending ${amendedCount} result${amendedCount === 1 ? "" : "s"}`}
              placeholder="e.g. Transcription error, re-run on fresh sample"
              helperText="The old value is kept in the audit trail; any verification is cleared and the doctor is told."
              value={amendReason} onChange={(e) => setAmendReason(e.target.value)}
            />
          )}
          <Button
            variant="contained"
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            onClick={handleSave}
            disabled={saving || !canEdit || (amendedCount > 0 && amendReason.trim().length < 3)}
            sx={{ bgcolor: LAB_DARK, "&:hover": { bgcolor: LAB }, px: 3 }}
          >
            Save Results
          </Button>
        </Box>
      </Paper>

      {showPOS && (
        <PointOfCarePOS
          open={showPOS}
          onClose={() => setShowPOS(false)}
          onSuccess={() => {
            setShowPOS(false);
            refetch();
          }}
          patientId={order.patientId ?? ""}
          uhid={order.patient?.uhidNumber}
          patientName={`${order.patient?.firstName || ''} ${order.patient?.lastName || ''}`}
          item={{
            id: order.labOrderId,
            type: "LAB",
            description: posItem?.description || `Lab Tests: ${order.reports?.map((r) => r.labTest?.testName).filter(Boolean).join(', ') || 'Pending Tests'}`,
            amount: Number(posItem?.amount ?? order.reports?.reduce((sum: number, r) => sum + Number(r.labTest?.price || 0), 0) ?? 300),
            taxPercent: Number(posItem?.taxPercent ?? 0),
            typedPrices: posItem?.typedPrices,
            date: order.createdAt
          }}
        />
      )}
    </Box>
  );
}
