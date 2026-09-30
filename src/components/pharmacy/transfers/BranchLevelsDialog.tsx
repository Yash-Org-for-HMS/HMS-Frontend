import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";

interface Data {
  medicine: { medicineId: string; medicineName: string; minStockLevel: number };
  branches: { branchId: string; branchName: string }[];
  levels: { branchId: string; minStockLevel: number }[];
}

/**
 * A medicine's reorder level at each branch. The medicine's own level is the
 * group's; a branch fills in a number only where it needs more or less. An
 * empty box follows the group's, shown in grey.
 */
export default function BranchLevelsDialog({ medicineId, medicineName, onClose, onSaved }: {
  medicineId: string; medicineName: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery<Data>({
    queryKey: ["medicine-branch-levels", medicineId],
    queryFn: async () => (await axiosInstance.get(`/pharmacy/medicines/${medicineId}/branch-levels`)).data.data,
  });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const saved = new Map((data?.levels ?? []).map((l) => [l.branchId, l.minStockLevel]));
  const valueOf = (b: string) => edits[b] ?? (saved.has(b) ? String(saved.get(b)) : "");

  const save = async () => {
    const levels = Object.entries(edits).map(([branchId, v]) => ({ branchId, minStockLevel: v.trim() === "" ? null : Number(v) }));
    if (!levels.length) return;
    setSaving(true);
    try {
      await axiosInstance.put(`/pharmacy/medicines/${medicineId}/branch-levels`, { levels });
      toast.success("Reorder levels saved");
      onSaved();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't save the reorder levels"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        Reorder level by branch
        <Typography variant="body2" sx={{ color: "text.secondary" }}>{medicineName}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 5 }}><HeartbeatLoader size={44} /></Box>
        ) : isError || !data ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
              The group's level is {data.medicine.minStockLevel}. Fill in a branch only if it needs a different one; low-stock alerts and auto-generated orders there use it.
            </Typography>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary" }} align="right">Reorder at</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {data.branches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell sx={{ fontWeight: 600 }}>{b.branchName}</TableCell>
                    <TableCell align="right">
                      <TextField
                        id={`level-${b.branchId}`} size="small" value={valueOf(b.branchId)} placeholder={String(data.medicine.minStockLevel)}
                        onChange={(e) => setEdits((x) => ({ ...x, [b.branchId]: e.target.value.replace(/\D/g, "") }))}
                        inputProps={{ inputMode: "numeric", style: { textAlign: "right" }, "aria-label": `Reorder level at ${b.branchName}` }}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !Object.keys(edits).length}>{saving ? "Saving…" : "Save levels"}</Button>
      </DialogActions>
    </Dialog>
  );
}
