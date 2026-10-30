import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Button, TextField, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions, Stack } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatINR } from "@/utils/format";

type Option = { chargeItemId: string; name: string; price: number | null; includes: { name: string; quantity: number; kind: string }[] };

/**
 * Sell a package (a health check-up) to an outpatient. It joins their unbilled
 * charges as one item; its lab tests and scans go to the lab and radiology now
 * and are started once it is paid.
 */
export default function SellPackageDialog({ patientId, patientName, onClose, onSold }: {
  patientId: string; patientName?: string; onClose: () => void; onSold: (outpatientPackageId: string) => void;
}) {
  const toast = useToast();
  const [input, setInput] = useState("");
  const term = useDebouncedValue(input, 250);
  const { data: options = [], isFetching } = useQuery<Option[]>({
    queryKey: ["outpatient-package-options", term],
    queryFn: async () => (await axiosInstance.get("/reception/billing/package-options", { params: { q: term.trim() || undefined } })).data.data,
  });
  const [picked, setPicked] = useState<Option | null>(null);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const needsPrice = picked?.price == null;
  const tests = picked?.includes.filter((i) => i.kind === "LAB" || i.kind === "RADIOLOGY").length ?? 0;

  const sell = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post("/reception/billing/packages", { patientId, chargeItemId: picked.chargeItemId, price: needsPrice ? Number(price) : undefined });
      toast.success(res.data?.message ?? "Package added");
      onSold(res.data.data.outpatientPackageId);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't add the package"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add a package{patientName ? ` - ${patientName}` : ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete<Option>
            options={options} value={picked} onChange={(_, o) => { setPicked(o); setPrice(""); }} loading={isFetching}
            inputValue={input} onInputChange={(_, v) => setInput(v)} filterOptions={(x) => x}
            getOptionLabel={(o) => o.name} isOptionEqualToValue={(o, v) => o.chargeItemId === v.chargeItemId}
            noOptionsText="No package - set one up in the Schedule of Charges"
            renderOption={(props, o) => (
              <li {...props} key={o.chargeItemId}>
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>{o.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{o.price == null ? "price typed for the patient" : formatINR(o.price)} · {o.includes.length} included</Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} size="small" label="Package" placeholder="e.g. Silver body profile" autoFocus />}
          />
          {picked && (
            <>
              {needsPrice
                ? <TextField size="small" type="number" label="Package price for this patient" value={price} onChange={(e) => setPrice(e.target.value)} inputProps={{ min: 1 }} />
                : <Typography variant="body2">Price: <strong>{formatINR(picked.price!)}</strong></Typography>}
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Includes</Typography>
                <Typography variant="body2">{picked.includes.map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ") || "-"}</Typography>
              </Box>
              {tests > 0 && (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Its {tests} test{tests === 1 ? "" : "s"} go to the lab / radiology now and start once the package is paid.
                </Typography>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={!picked || saving || (needsPrice && !(Number(price) > 0))} onClick={sell} sx={{ textTransform: "none" }}>{saving ? "Adding..." : "Add to the bill"}</Button>
      </DialogActions>
    </Dialog>
  );
}
