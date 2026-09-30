import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";

/**
 * A charge's prices at each branch. The group's price list stays as it is; a
 * branch fills in only the prices that differ — its base (OPD) price and any
 * room-class cell. An empty cell follows the group's, shown as the placeholder.
 */

interface Data {
  item: { chargeItemId: string; itemName: string };
  group: { base: number; classes: { roomClassId: string; price: number }[] };
  branches: { branchId: string; branchName: string }[];
  roomClasses: { roomClassId: string; name: string }[];
  prices: { branchId: string; roomClassId: string; price: number }[];
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const key = (branchId: string, roomClassId: string) => `${branchId}|${roomClassId}`;

export default function BranchPricesDialog({ chargeItemId, itemName, onClose, onSaved }: {
  chargeItemId: string; itemName: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery<Data>({
    queryKey: ["soc-branch-prices", chargeItemId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/items/${chargeItemId}/branch-prices`)).data.data,
  });
  // Edits keyed "branch|class" ("" class = base); untouched cells show what is saved.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const saved = new Map((data?.prices ?? []).map((p) => [key(p.branchId, p.roomClassId), p.price]));
  const valueOf = (b: string, c: string) => edits[key(b, c)] ?? (saved.has(key(b, c)) ? String(saved.get(key(b, c))) : "");
  const groupOf = (c: string) => (c ? data?.group.classes.find((x) => x.roomClassId === c)?.price : undefined) ?? data?.group.base ?? 0;

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      for (const b of data.branches) {
        const changed = Object.entries(edits).filter(([k]) => k.startsWith(`${b.branchId}|`));
        if (!changed.length) continue;
        const prices = changed.map(([k, v]) => ({ roomClassId: k.split("|")[1], price: v.trim() === "" ? null : Number(v) }));
        if (prices.some((p) => p.price !== null && !(Number(p.price) >= 0))) throw new Error("Prices must be zero or a positive amount");
        await axiosInstance.put(`/hospital/soc/items/${chargeItemId}/branch-prices`, { branchId: b.branchId, prices });
      }
      toast.success("Branch prices saved");
      onSaved();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't save the branch prices"));
    } finally {
      setSaving(false);
    }
  };

  const columns = [{ roomClassId: "", name: "OPD / base" }, ...(data?.roomClasses ?? [])];

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        Branch prices — {itemName}
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Fill in only what a branch charges differently. An empty cell charges the group's price, shown in grey.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><HeartbeatLoader size={48} /></Box>
        ) : isError || !data ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.roomClassId || "base"} align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{c.name}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: "text.secondary" }}>Group price</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.roomClassId || "base"} align="right" sx={{ color: "text.secondary" }}>{inr(groupOf(c.roomClassId))}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.branches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{b.branchName}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.roomClassId || "base"} align="right">
                        <TextField
                          id={`bp-${b.branchId}-${c.roomClassId || "base"}`} size="small" value={valueOf(b.branchId, c.roomClassId)}
                          placeholder={String(groupOf(c.roomClassId))}
                          onChange={(e) => setEdits((x) => ({ ...x, [key(b.branchId, c.roomClassId)]: e.target.value.replace(/[^\d.]/g, "") }))}
                          inputProps={{ inputMode: "decimal", style: { textAlign: "right" }, "aria-label": `${b.branchName} ${c.name}` }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !Object.keys(edits).length}>{saving ? "Saving…" : "Save branch prices"}</Button>
      </DialogActions>
    </Dialog>
  );
}
