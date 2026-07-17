import { ACCENTS } from "../../styles/accents";
import { getApiErrorMessage, apiErrorText } from "../../utils/apiError";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Chip, Button, Divider, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, ToggleButton,
  ToggleButtonGroup, Stack,
} from "@mui/material";
import {
  AssignmentTurnedInRounded, AddRounded, GestureRounded, UploadFileRounded,
  OpenInNewRounded, CloseRounded, DoNotDisturbRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../HeartbeatLoader";
import { ListSkeleton } from "../TableRowsSkeleton";
import ErrorState from "../ErrorState";
import { useToast } from "../../contexts/ToastContext";
import { assetUrl } from "../../utils/assetUrl";
import dayjs from "dayjs";
import DynamicFormRenderer, { validateFormResponses, type FormValues } from "../DynamicFormRenderer";

const ACCENT = ACCENTS.reception;
const STATUS_META: Record<string, { label: string; color: string }> = {
  ISSUED: { label: "Issued", color: "#f59e0b" },
  SIGNED: { label: "Signed", color: "#10b981" },
  DECLINED: { label: "Declined", color: "#ef4444" },
  CANCELLED: { label: "Cancelled", color: "#64748b" },
};

export default function ConsentFormsSection({ patientId, patientName, readOnly = false }: { patientId: string; patientName?: string; readOnly?: boolean }) {
  const toast = useToast();
  const [issueOpen, setIssueOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<any>(null);
  const [responsesTarget, setResponsesTarget] = useState<any>(null);

  const { data: forms = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["consent-forms", patientId],
    queryFn: async () => (await axiosInstance.get("/reception/consent-forms", { params: { patientId } })).data.data,
  });

  const setStatus = async (id: string, status: string) => {
    try {
      await axiosInstance.put(`/reception/consent-forms/${id}/status`, { status });
      toast.success(`Consent ${status.toLowerCase()}`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update consent"));
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AssignmentTurnedInRounded sx={{ color: ACCENT }} fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>Consent Forms</Typography>
        </Box>
        {!readOnly && (
          <Button size="small" variant="outlined" startIcon={<AddRounded />} onClick={() => setIssueOpen(true)}
            sx={{ textTransform: "none", color: ACCENT, borderColor: "rgba(8,145,178,0.4)" }}>
            Issue Consent
          </Button>
        )}
      </Box>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : forms.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>No consent forms issued yet</Typography>
      ) : (
        <Box>
          {forms.map((f, idx) => {
            const sm = STATUS_META[f.status] || { label: f.status, color: "#64748b" };
            return (
              <Box key={f.consentFormId}>
                {idx > 0 && <Divider sx={{ borderColor: "divider" }} />}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{f.title}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {dayjs(f.createdAt).format("DD MMM YYYY")}
                      {f.status === "SIGNED" && f.signedByName ? ` • Signed by ${f.signedByName}${f.signedByRelation ? ` (${f.signedByRelation})` : ""}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, fontWeight: 700 }} />
                    {f.responseDataJson && Object.keys(f.responseDataJson).length > 0 && (
                      <Button size="small" onClick={() => setResponsesTarget(f)} sx={{ textTransform: "none", color: ACCENT }}>Responses</Button>
                    )}
                    {f.signatureUrl && (
                      <Button size="small" startIcon={<GestureRounded />} onClick={() => window.open(assetUrl(f.signatureUrl), "_blank")} sx={{ textTransform: "none", color: ACCENT }}>Signature</Button>
                    )}
                    {f.documentUrl && (
                      <Button size="small" startIcon={<OpenInNewRounded />} onClick={() => window.open(assetUrl(f.documentUrl), "_blank")} sx={{ textTransform: "none", color: ACCENT }}>File</Button>
                    )}
                    {!readOnly && f.status === "ISSUED" && (
                      <>
                        <Button size="small" variant="contained" onClick={() => setSignTarget(f)} sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#0e7490" } }}>Capture</Button>
                        <Button size="small" startIcon={<DoNotDisturbRounded />} onClick={() => setStatus(f.consentFormId, "CANCELLED")} sx={{ textTransform: "none", color: "text.secondary" }}>Cancel</Button>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {issueOpen && (
        <IssueConsentDialog patientId={patientId} onClose={() => setIssueOpen(false)} onIssued={() => { setIssueOpen(false); refetch(); }} />
      )}
      {signTarget && (
        <SignConsentDialog form={signTarget} patientName={patientName} onClose={() => setSignTarget(null)} onSigned={() => { setSignTarget(null); refetch(); }} />
      )}
      {responsesTarget && (
        <Dialog open onClose={() => setResponsesTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{responsesTarget.title} — responses</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.2}>
              {Object.entries(responsesTarget.responseDataJson as Record<string, any>).map(([k, v]) => (
                <Box key={k} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>
                    {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—") || "—"}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setResponsesTarget(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
}

function IssueConsentDialog({ patientId, onClose, onIssued }: { patientId: string; onClose: () => void; onIssued: () => void }) {
  const toast = useToast();
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["form-templates"],
    queryFn: async () => (await axiosInstance.get("/hospital/form-builder")).data.data,
  });

  // Load the selected template's fields so they can be filled at issue time.
  const { data: template } = useQuery({
    queryKey: ["form-template", templateId],
    queryFn: async () => (await axiosInstance.get(`/hospital/form-builder/${templateId}`)).data.data,
    enabled: !!templateId,
  });
  const fields = (template?.fields || []) as any[];

  const submit = async () => {
    if (!templateId && !title.trim()) return;

    // Validate the template's fields (required + rules) before issuing.
    if (fields.length > 0) {
      const errs = validateFormResponses(fields, values);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        toast.error("Please fix the highlighted fields");
        return;
      }
    }

    setSaving(true);
    try {
      await axiosInstance.post("/reception/consent-forms", {
        patientId,
        formTemplateId: templateId || undefined,
        title: title.trim() || undefined,
        responseData: fields.length > 0 ? values : undefined,
      });
      toast.success("Consent form issued");
      onIssued();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to issue consent form"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Issue Consent Form</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField select fullWidth label="Consent template" value={templateId}
            onChange={(e) => { setTemplateId(e.target.value); setValues({}); setErrors({}); const t = templates.find((x) => x.formTemplateId === e.target.value); if (t) setTitle(t.formName || ""); }}>
            <MenuItem value="">— Custom (no template) —</MenuItem>
            {templates.map((t) => (
              <MenuItem key={t.formTemplateId} value={t.formTemplateId}>{t.formName} {t.formType ? `(${t.formType})` : ""}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Surgical Consent" helperText="Pre-filled from the template; edit if needed" />

          {fields.length > 0 && (
            <>
              <Divider textAlign="left" sx={{ "&::before, &::after": { borderColor: "divider" } }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Form fields</Typography>
              </Divider>
              <DynamicFormRenderer fields={fields} values={values} onChange={setValues} errors={errors} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || (!templateId && !title.trim())}
          sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: "#0e7490" } }}>Issue</Button>
      </DialogActions>
    </Dialog>
  );
}

function SignConsentDialog({ form, patientName, onClose, onSigned }: { form: any; patientName?: string; onClose: () => void; onSigned: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [signedByName, setSignedByName] = useState(patientName || "");
  const [signedByRelation, setSignedByRelation] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawn, setDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [mode]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDrawn(true);
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDrawn(false);
  };

  const canSubmit = signedByName.trim().length > 0 && (mode === "draw" ? drawn : !!uploadFile);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("signedByName", signedByName.trim());
      if (signedByRelation.trim()) fd.append("signedByRelation", signedByRelation.trim());
      if (witnessName.trim()) fd.append("witnessName", witnessName.trim());

      if (mode === "draw") {
        const blob: Blob = await new Promise((resolve) => canvasRef.current!.toBlob((b) => resolve(b!), "image/png"));
        fd.append("fileKind", "signature");
        fd.append("file", new File([blob], "signature.png", { type: "image/png" }));
      } else {
        fd.append("fileKind", "document");
        fd.append("file", uploadFile!);
      }

      await axiosInstance.post(`/reception/consent-forms/${form.consentFormId}/sign`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Consent signed and filed");
      onSigned();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to capture consent"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Capture consent — {form.title}
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}><CloseRounded /></Button>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" required label="Signed by" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} placeholder="Patient / guardian name" />
            <TextField fullWidth size="small" label="Relationship" value={signedByRelation} onChange={(e) => setSignedByRelation(e.target.value)} placeholder="Self / parent / spouse" />
          </Stack>
          <TextField fullWidth size="small" label="Witness (optional)" value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />

          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}
            sx={{ "& .MuiToggleButton-root.Mui-selected": { bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#0e7490" } } }}>
            <ToggleButton value="draw" sx={{ textTransform: "none", px: 2 }}><GestureRounded fontSize="small" sx={{ mr: 0.5 }} /> Draw signature</ToggleButton>
            <ToggleButton value="upload" sx={{ textTransform: "none", px: 2 }}><UploadFileRounded fontSize="small" sx={{ mr: 0.5 }} /> Upload scan</ToggleButton>
          </ToggleButtonGroup>

          {mode === "draw" ? (
            <Box>
              <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, overflow: "hidden", bgcolor: "#fff" }}>
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  style={{ width: "100%", height: 180, touchAction: "none", cursor: "crosshair", display: "block" }}
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerLeave={end}
                />
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Sign inside the box</Typography>
                <Button size="small" onClick={clear} sx={{ textTransform: "none", color: "text.secondary" }}>Clear</Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Button variant="outlined" component="label" startIcon={<UploadFileRounded />} sx={{ textTransform: "none" }}>
                {uploadFile ? uploadFile.name : "Choose signed document (PDF/JPG/PNG)"}
                <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </Button>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <HeartbeatLoader size={22} /> : undefined}
          sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: "#0e7490" } }}>
          Sign & File
        </Button>
      </DialogActions>
    </Dialog>
  );
}
