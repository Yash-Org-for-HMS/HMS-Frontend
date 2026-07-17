import { useRef, useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip, Divider, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from "@mui/material";
import {
  CloudUploadRounded, DeleteOutlineRounded, VisibilityRounded, CheckCircleRounded,
  RadioButtonUncheckedRounded, DescriptionRounded,
} from "@mui/icons-material";
import { ACCENTS } from "@/styles/accents";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { CLAIM_DOC_CATALOG, DOC_STAGE_LABEL, docTypeLabel, type DocStage } from "./claimMeta";

const ACCENT = ACCENTS.reception;
const STAGES: DocStage[] = ["PREAUTH", "FINAL"];

export default function ClaimDocumentsSection({ claimId }: { claimId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [uploadFor, setUploadFor] = useState<{ code: string; stage: DocStage } | null>(null);

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["claim-docs", claimId],
    queryFn: async () => (await axiosInstance.get(`/claims/${claimId}/documents`)).data.data as any[],
  });

  const docsFor = (code: string) => docs.filter((d) => d.docType === code);

  const remove = async (doc: any) => {
    const ok = await confirm({ title: "Delete document", message: `Delete "${doc.fileName}"? This cannot be undone.`, confirmText: "Delete", destructive: true });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/claims/documents/${doc.claimDocumentId}`);
      toast.success("Document deleted");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete"));
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
        <DescriptionRounded fontSize="small" sx={{ color: ACCENT }} /> Documents
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", mb: 2, display: "block" }}>
        Upload the papers you'd submit to the TPA / government portal. Required items are marked.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><HeartbeatLoader size={28} /></Box>
      ) : (
        STAGES.map((stage) => {
          const items = CLAIM_DOC_CATALOG.filter((d) => d.stage === stage);
          const requiredItems = items.filter((d) => d.required);
          const requiredDone = requiredItems.filter((d) => docsFor(d.code).length > 0).length;
          return (
            <Box key={stage} sx={{ mb: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{DOC_STAGE_LABEL[stage]}</Typography>
                <Chip size="small" label={`${requiredDone}/${requiredItems.length} required`}
                  sx={{ bgcolor: requiredDone === requiredItems.length ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: requiredDone === requiredItems.length ? "#10b981" : "#f59e0b", fontWeight: 700 }} />
              </Box>
              <Divider sx={{ mb: 1 }} />
              <Stack spacing={0.5}>
                {items.map((item) => {
                  const uploaded = docsFor(item.code);
                  const has = uploaded.length > 0;
                  return (
                    <Box key={item.code} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, flexWrap: "wrap" }}>
                      {has ? <CheckCircleRounded fontSize="small" sx={{ color: "#10b981" }} /> : <RadioButtonUncheckedRounded fontSize="small" sx={{ color: item.required ? "#f59e0b" : "text.disabled" }} />}
                      <Typography variant="body2" sx={{ minWidth: 200, fontWeight: has ? 600 : 400 }}>
                        {item.label}{item.required && <Box component="span" sx={{ color: "#ef4444", ml: 0.5 }}>*</Box>}
                      </Typography>
                      <Box sx={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {uploaded.map((d) => (
                          <Chip key={d.claimDocumentId} size="small" variant="outlined" label={d.fileName}
                            onClick={() => window.open(d.fileUrl, "_blank")}
                            onDelete={() => remove(d)}
                            deleteIcon={<DeleteOutlineRounded />}
                            icon={<VisibilityRounded />}
                            sx={{ maxWidth: 260 }}
                          />
                        ))}
                      </Box>
                      <Button size="small" startIcon={<CloudUploadRounded fontSize="small" />} onClick={() => setUploadFor({ code: item.code, stage })} sx={{ textTransform: "none", color: ACCENT }}>
                        Upload
                      </Button>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          );
        })
      )}

      {uploadFor && (
        <UploadDialog
          claimId={claimId}
          docType={uploadFor.code}
          stage={uploadFor.stage}
          onClose={() => setUploadFor(null)}
          onDone={() => { setUploadFor(null); refetch(); }}
        />
      )}
    </Paper>
  );
}

function UploadDialog({ claimId, docType, stage, onClose, onDone }: { claimId: string; docType: string; stage: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) { toast.error("Choose a file"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", docType);
      fd.append("stage", stage);
      await axiosInstance.post(`/claims/${claimId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Document uploaded");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Upload — {docTypeLabel(docType)}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Button variant="outlined" component="label" startIcon={<CloudUploadRounded />} fullWidth sx={{ py: 2, borderStyle: "dashed" }}>
            {file ? file.name : "Choose file (PDF / image, max 10 MB)"}
            <input ref={inputRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !file} startIcon={saving ? <HeartbeatLoader size={22} /> : <CloudUploadRounded />} sx={{ bgcolor: ACCENT }}>Upload</Button>
      </DialogActions>
    </Dialog>
  );
}
