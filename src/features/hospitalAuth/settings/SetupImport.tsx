import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { UploadFileRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";

interface SheetInfo {
  key: string;
  title: string;
  sheetName: string;
  notes: string[];
  after: string[];
  allowed: boolean;
  module: string | null;
}

type RowStatus = "add" | "skip" | "error";
interface RowResult { row: number; label: string; status: RowStatus; messages: string[]; details?: string }
interface ImportResult { sheet: string; applied: boolean; counts: Record<RowStatus, number>; rows: RowResult[] }

const STATUS: Record<RowStatus, { label: string; done: string; color: "success" | "default" | "error" }> = {
  add: { label: "Will add", done: "Added", color: "success" },
  skip: { label: "Already there", done: "Already there", color: "default" },
  error: { label: "Fix in sheet", done: "Not added", color: "error" },
};

/**
 * Fills the hospital in from the Dolphin data collection workbook, one sheet at
 * a time: Check judges every row (nothing saved), Add saves the rows that pass.
 * Rows already in the hospital are skipped, so a fixed file can be uploaded again.
 */
export default function SetupImport() {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetKey, setSheetKey] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [show, setShow] = useState<"all" | RowStatus>("all");

  const { data: sheets, isLoading, isError, error, refetch } = useQuery<SheetInfo[]>({
    queryKey: ["setup-import-sheets"],
    queryFn: async () => (await axiosInstance.get("/hospital/setup-import/sheets")).data.data,
  });
  const sheet = sheets?.find((s) => s.key === sheetKey) ?? null;

  const run = useMutation({
    mutationFn: async (mode: "preview" | "apply") => {
      const fd = new FormData();
      fd.append("file", file as File);
      return (await axiosInstance.post(`/hospital/setup-import/${sheetKey}/${mode}`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data.data as ImportResult;
    },
    onSuccess: (res) => {
      setResult(res);
      setShow(res.counts.error ? "error" : "all");
      if (res.applied) toast.success(`${res.counts.add} added to ${sheet?.title ?? "the hospital"}`);
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Couldn't read the workbook")),
  });

  const rows = useMemo(() => (result?.rows ?? []).filter((r) => show === "all" || r.status === show), [result, show]);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState title="Couldn't load the import screen" message={apiErrorText(error)} onRetry={() => refetch()} />;

  const pickFile = (f: File | null) => { setFile(f); setResult(null); };
  const pickSheet = (k: string) => { setSheetKey(k); setResult(null); };

  const apply = async () => {
    if (!result) return;
    const ok = await confirm({
      title: `Add ${result.counts.add} to ${sheet?.title}?`,
      message: `${result.counts.add} rows are added now.${result.counts.error ? ` ${result.counts.error} rows with errors are left out - fix them in the workbook and upload it again; rows already added are skipped.` : ""}`,
      confirmText: "Add",
    });
    if (ok) run.mutate("apply");
  };

  const applied = !!result?.applied;
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
      <PageHeader
        title="Import from workbook"
        subtitle="Add the sheets of the filled Dolphin data collection workbook. Check shows what each row will do; nothing is saved until you press Add."
      />

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", backgroundImage: "none" }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
          <Box>
            <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <Button variant="outlined" startIcon={<UploadFileRounded />} onClick={() => inputRef.current?.click()} sx={{ textTransform: "none", height: 40 }}>
              {file ? "Choose another workbook" : "Choose workbook (.xlsx)"}
            </Button>
            {file && <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>{file.name}</Typography>}
          </Box>
          <TextField select size="small" label="Sheet" value={sheetKey} onChange={(e) => pickSheet(e.target.value)} sx={{ minWidth: 240 }}>
            {(sheets ?? []).map((s) => (
              <MenuItem key={s.key} value={s.key} disabled={!s.allowed}>
                {s.title}{!s.allowed ? (s.module ? ` (needs ${s.module})` : " (not for your role)") : ""}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={!file || !sheet || run.isPending} onClick={() => run.mutate("preview")} sx={{ textTransform: "none", height: 40 }}>
            {run.isPending && run.variables === "preview" ? "Checking..." : "Check"}
          </Button>
        </Stack>

        {sheet && (
          <Box sx={{ mt: 2 }}>
            {sheet.after.length > 0 && (
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Import first: {sheet.after.join(", ")}</Typography>
            )}
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
              {sheet.notes.map((n) => <Typography component="li" variant="body2" key={n}>{n}</Typography>)}
            </Box>
          </Box>
        )}
      </Paper>

      {result && (
        <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", backgroundImage: "none" }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{sheet?.title}: {result.rows.length} rows {applied ? "imported" : "checked"}</Typography>
            <ToggleButtonGroup size="small" exclusive value={show} onChange={(_e, v) => v && setShow(v)}>
              <ToggleButton value="all" sx={{ textTransform: "none" }}>All</ToggleButton>
              {(["add", "skip", "error"] as const).map((s) => (
                <ToggleButton key={s} value={s} sx={{ textTransform: "none" }}>{applied ? STATUS[s].done : STATUS[s].label} ({result.counts[s]})</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            {!applied && (
              <Button variant="contained" color="success" disabled={!result.counts.add || run.isPending} onClick={apply} sx={{ textTransform: "none" }}>
                {run.isPending && run.variables === "apply" ? "Adding..." : `Add ${result.counts.add} rows`}
              </Button>
            )}
          </Stack>

          {applied && result.counts.error > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>Fix the rows marked Not added in the workbook and upload it again - what was added is skipped the second time.</Alert>
          )}
          {!applied && !result.counts.add && !result.counts.error && (
            <Alert severity="success" sx={{ mb: 2 }}>Everything on this sheet is already in the hospital.</Alert>
          )}

          <TableContainer sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 70 }}>Row</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell sx={{ width: 140 }}>Result</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.row} hover>
                    <TableCell sx={{ color: "text.secondary" }}>{r.row}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.label}</TableCell>
                    <TableCell><Chip size="small" color={STATUS[r.status].color} label={applied ? STATUS[r.status].done : STATUS[r.status].label} /></TableCell>
                    <TableCell>
                      {r.details && <Typography variant="body2">{r.details}</Typography>}
                      {r.messages.map((m) => (
                        <Typography key={m} variant="body2" sx={{ color: r.status === "error" ? "error.main" : r.status === "add" ? "warning.main" : "text.secondary" }}>{m}</Typography>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>{result.rows.length ? "No rows here." : "The sheet has no filled rows."}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
