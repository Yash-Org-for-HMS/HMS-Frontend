import { useMemo, useState } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  TextField, MenuItem, Autocomplete, Button, Switch, FormControlLabel, Typography,
  ToggleButton, ToggleButtonGroup, Stack, Divider,
} from "@mui/material";
import { WarehouseRounded, SwapHorizRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function WardStock() {
  const toast = useToast();
  const [wardId, setWardId] = useState("");
  const [direction, setDirection] = useState<"issue" | "return">("issue");
  const [medicine, setMedicine] = useState<any>(null);
  const [qty, setQty] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<{ enabled: boolean; wards: any[]; stock: any[] }>({
    queryKey: ["ward-stock"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/ward-stock")).data.data,
  });

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: catalog = [] } = useQuery<any[]>({
    queryKey: ["pharmacy-medicine-catalog", debouncedSearch],
    queryFn: async () => (await axiosInstance.get("/pharmacy/medicines-catalog", { params: { search: debouncedSearch || undefined } })).data.data,
  });

  const wards = data?.wards || [];
  const wardStock = useMemo(() => (data?.stock || []).filter((s) => s.wardId === wardId), [data, wardId]);

  const toggleEnabled = async (enabled: boolean) => {
    try {
      await axiosInstance.patch("/pharmacy/ward-stock/settings", { enabled });
      toast.success(enabled ? "Ward stock enabled" : "Ward stock disabled");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update setting"));
    }
  };

  const submit = async () => {
    const q = Number(qty);
    if (!wardId || !medicine || !Number.isInteger(q) || q <= 0) return;
    setBusy(true);
    try {
      await axiosInstance.post(`/pharmacy/ward-stock/${direction}`, { wardId, items: [{ medicineId: medicine.medicineId, quantity: q }] });
      toast.success(direction === "issue" ? "Issued to ward" : "Returned to central");
      setMedicine(null);
      setQty("");
      setSearch("");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Ward Stock" subtitle="Issue floor stock from central pharmacy to wards, and take back unused stock" />

      {isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
            <FormControlLabel
              control={<Switch checked={!!data?.enabled} onChange={(e) => toggleEnabled(e.target.checked)} />}
              label={<Box><Typography variant="body2" sx={{ fontWeight: 700 }}>Ward stock mode</Typography><Typography variant="caption" sx={{ color: "text.secondary" }}>When on, in-patient medicine orders draw from the admission ward's floor stock instead of central inventory.</Typography></Box>}
            />
          </Paper>

          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
            <TextField select size="small" label="Ward" value={wardId} onChange={(e) => setWardId(e.target.value)} sx={{ minWidth: 240 }}>
              <MenuItem value="" disabled>Select a ward</MenuItem>
              {wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName || "Ward"}</MenuItem>)}
            </TextField>

            {wardId && (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
                  <ToggleButtonGroup exclusive size="small" value={direction} onChange={(_, v) => v && setDirection(v)}>
                    <ToggleButton value="issue" sx={{ textTransform: "none" }}><SwapHorizRounded fontSize="small" sx={{ mr: 0.5 }} />Issue → ward</ToggleButton>
                    <ToggleButton value="return" sx={{ textTransform: "none" }}>Return → central</ToggleButton>
                  </ToggleButtonGroup>
                  <Autocomplete
                    sx={{ minWidth: 280, flex: 1 }} size="small" options={catalog} value={medicine}
                    onChange={(_, v) => setMedicine(v)}
                    onInputChange={(_, v, r) => { if (r === "input") setSearch(v); }}
                    filterOptions={(x) => x}
                    getOptionLabel={(o: any) => (o ? o.medicineName : "")}
                    isOptionEqualToValue={(o: any, v: any) => o.medicineId === v?.medicineId}
                    renderOption={(props, o: any) => <li {...props} key={o.medicineId}>{o.medicineName} · central {o.availableStock}</li>}
                    renderInput={(params) => <TextField {...params} label="Medicine" placeholder="Search…" />}
                  />
                  <TextField size="small" type="number" label="Qty" value={qty} onChange={(e) => setQty(e.target.value)} sx={{ width: 110 }} inputProps={{ min: 1, step: 1 }} />
                  <Button variant="contained" disabled={busy || !medicine || !qty} onClick={submit}
                    startIcon={busy ? <HeartbeatLoader size={20} /> : <WarehouseRounded />}
                    sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" }, whiteSpace: "nowrap" }}>
                    {direction === "issue" ? "Issue" : "Return"}
                  </Button>
                </Stack>
              </>
            )}
          </Paper>

          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Medicine</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "text.secondary" }}>On hand (ward)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRowsSkeleton rows={5} columns={2} />
                  ) : !wardId ? (
                    <TableRow><TableCell colSpan={2}><Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>Select a ward to view its floor stock.</Box></TableCell></TableRow>
                  ) : wardStock.length === 0 ? (
                    <TableRow><TableCell colSpan={2}><Box sx={{ py: 4 }}><Mascot pose="nothing-here-yet" title="No ward stock" subtitle="Issue medicines from the central pharmacy to stock this ward." size={110} /></Box></TableCell></TableRow>
                  ) : (
                    wardStock.map((s) => (
                      <TableRow key={s.medicineId} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{s.medicineName}</TableCell>
                        <TableCell align="right">{s.quantityOnHand}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
