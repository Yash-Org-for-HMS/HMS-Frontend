import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { DownloadRounded, UploadFileRounded } from "@mui/icons-material";
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

type RowStatus = "add" | "skip" | "error" | "pending";
interface RowResult { row: number; label: string; status: RowStatus; messages: string[]; details?: string }
interface NewLogin { name: string; email: string; temporaryPassword: string }
interface ImportResult { sheet: string; applied: boolean; counts: Record<RowStatus, number>; rows: RowResult[]; logins: NewLogin[] }

const STATUS: Record<RowStatus, { label: string; done: string; color: "success" | "default" | "error" | "warning" }> = {
  add: { label: "Will add", done: "Added", color: "success" },
  skip: { label: "Already there", done: "Already there", color: "default" },
  error: { label: "Fix in sheet", done: "Not added", color: "error" },
  pending: { label: "Waiting", done: "Not added yet", color: "warning" },
};

const countOf = (rows: RowResult[]): Record<RowStatus, number> => ({
  add: rows.filter((r) => r.status === "add").length,
  skip: rows.filter((r) => r.status === "skip").length,
  error: rows.filter((r) => r.status === "error").length,
  pending: rows.filter((r) => r.status === "pending").length,
});

/** The logins as a CSV file the admin keeps: the passwords are never shown again. */
function downloadLogins(logins: NewLogin[]) {
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = ["Name,Login email,Temporary password", ...logins.map((l) => [l.name, l.email, l.temporaryPassword].map(cell).join(","))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "dolphin-new-logins.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Fills the hospital in from the Dolphin data collection workbook, one sheet at
 * a time: Check judges every row (nothing saved), Add saves the rows that pass.
 * Rows already in the hospital are skipped, so a fixed file can be uploaded again.
 * A sheet saved person by person goes in rounds; Add carries on until all are in.
 */
export default function SetupImport() {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetKey, setSheetKey] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [show, setShow] = useState<"all" | RowStatus>("all");
  const [adding, setAdding] = useState<{ done: number; of: number } | null>(null);
  const [logins, setLogins] = useState<NewLogin[]>([]);

  const { data: sheets, isLoading, isError, error, refetch } = useQuery<SheetInfo[]>({
    queryKey: ["setup-import-sheets"],
    queryFn: async () => (await axiosInstance.get("/hospital/setup-import/sheets")).data.data,
  });
  const sheet = sheets?.find((s) => s.key === sheetKey) ?? null;

  const send = async (mode: "preview" | "apply") => {
    const fd = new FormData();
    fd.append("file", file as File);
    return (await axiosInstance.post(`/hospital/setup-import/${sheetKey}/${mode}`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data.data as ImportResult;
  };

  const check = useMutation({
    mutationFn: () => send("preview"),
    onSuccess: (res) => { setResult(res); setShow(res.counts.error ? "error" : "all"); },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Couldn't read the workbook")),
  });

  const rows = useMemo(() => (result?.rows ?? []).filter((r) => show === "all" || r.status === show), [result, show]);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState title="Couldn't load the import screen" message={apiErrorText(error)} onRetry={() => refetch()} />;

  const pickFile = (f: File | null) => { setFile(f); setResult(null); };
  const pickSheet = (k: string) => { setSheetKey(k); setResult(null); };

  // Rounds until nothing is left waiting (or a round adds nothing). A row added
  // in an earlier round reads "already there" afterwards; it is shown as added.
  const applyAll = async () => {
    if (!result) return;
    const ok = await confirm({
      title: `Add ${result.counts.add} to ${sheet?.title}?`,
      message: `${result.counts.add} rows are added now.${result.counts.error ? ` ${result.counts.error} rows with errors are left out - fix them in the workbook and upload it again; rows already added are skipped.` : ""}`,
      confirmText: "Add",
    });
    if (!ok) return;
    const total = result.counts.add;
    const added = new Set<number>();
    const fromRounds = new Map<number, RowResult>();
    setAdding({ done: 0, of: total });
    try {
      for (;;) {
        const res = await send("apply");
        res.rows.filter((r) => r.status === "add").forEach((r) => { added.add(r.row); fromRounds.set(r.row, r); });
        res.rows.filter((r) => r.status === "error" && !fromRounds.has(r.row)).forEach((r) => fromRounds.set(r.row, r));
        if (res.logins.length) setLogins((l) => [...l, ...res.logins]);
        setAdding({ done: added.size, of: total });
        const final = res.rows.map((r) => fromRounds.get(r.row) ?? r);
        setResult({ ...res, rows: final, counts: countOf(final) });
        if (!res.counts.pending || !res.counts.add) break;
      }
      setShow("all");
      toast.success(`${added.size} added to ${sheet?.title ?? "the hospital"}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Adding stopped part-way - upload the file again to carry on"));
    } finally {
      setAdding(null);
    }
  };

  const applied = !!result?.applied;
  const busy = check.isPending || !!adding;
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
      <PageHeader
        title="Import from workbook"
        subtitle="Add the sheets of the filled Dolphin data collection workbook. Check shows what each row will do; nothing is saved until you press Add."
      />

      {logins.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "warning.main", backgroundImage: "none" }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700 }}>{logins.length} new logins</Typography>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadLogins(logins)} sx={{ textTransform: "none" }}>Download as CSV</Button>
          </Stack>
          <Alert severity="warning" sx={{ mb: 2 }}>These temporary passwords are shown only now. Download them before leaving this page; each person sets their own password at first sign-in.</Alert>
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Login email</TableCell><TableCell>Temporary password</TableCell></TableRow></TableHead>
              <TableBody>
                {logins.map((l) => (
                  <TableRow key={l.email}><TableCell>{l.name}</TableCell><TableCell>{l.email}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{l.temporaryPassword}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", backgroundImage: "none" }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
          <Box>
            <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <Button variant="outlined" startIcon={<UploadFileRounded />} disabled={busy} onClick={() => inputRef.current?.click()} sx={{ textTransform: "none", height: 40 }}>
              {file ? "Choose another workbook" : "Choose workbook (.xlsx)"}
            </Button>
            {file && <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>{file.name}</Typography>}
          </Box>
          <TextField select size="small" label="Sheet" value={sheetKey} disabled={busy} onChange={(e) => pickSheet(e.target.value)} sx={{ minWidth: 240 }}>
            {(sheets ?? []).map((s) => (
              <MenuItem key={s.key} value={s.key} disabled={!s.allowed}>
                {s.title}{!s.allowed ? (s.module ? ` (needs ${s.module})` : " (not for your role)") : ""}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={!file || !sheet || busy} onClick={() => check.mutate()} sx={{ textTransform: "none", height: 40 }}>
            {check.isPending ? "Checking..." : "Check"}
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
              {(["add", "skip", "error", "pending"] as const).filter((s) => s !== "pending" || result.counts.pending > 0).map((s) => (
                <ToggleButton key={s} value={s} sx={{ textTransform: "none" }}>{applied ? STATUS[s].done : STATUS[s].label} ({result.counts[s]})</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            {!applied && (
              <Button variant="contained" color="success" disabled={!result.counts.add || busy} onClick={applyAll} sx={{ textTransform: "none" }}>
                {adding ? `Adding... ${adding.done} of ${adding.of}` : `Add ${result.counts.add} rows`}
              </Button>
            )}
            {applied && adding && <Typography variant="body2" sx={{ fontWeight: 600 }}>Adding... {adding.done} of {adding.of}</Typography>}
          </Stack>

          {applied && !adding && (result.counts.error > 0 || result.counts.pending > 0) && (
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
