import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, List, ListItemButton, ListItemText, InputAdornment, CircularProgress,
} from "@mui/material";
import { SearchRounded, CameraAltRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINRAuto } from "@/utils/format";

const inr = formatINRAuto;

type RadTest = { chargeItemId: string; testName: string; testCode: string | null; price: number | string; category?: string | null };
export type PickedRadTest = { chargeItemId: string; testName: string; price: number };

// Category-browse picker for radiology tests (mastered in the Schedule of Charges,
// organized into categories like X-Ray / CT / MRI). Each host panel passes the
// catalogue endpoint it already uses, so no new backend and no auth surprises.
// The caller sends only the chargeItemId — the server prices the order from the catalogue.
export default function RadiologyTestPicker({ open, onClose, onPick, accent = "#7c3aed", catalogUrl }: {
  open: boolean; onClose: () => void; onPick: (t: PickedRadTest) => void; accent?: string; catalogUrl: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState(""); // "" = all categories
  const [search, setSearch] = useState("");

  const { data: tests = [], isLoading } = useQuery<RadTest[]>({
    queryKey: ["radiology-test-picker", catalogUrl],
    queryFn: async () => (await axiosInstance.get(catalogUrl)).data.data || [],
    enabled: open,
  });

  const categories = useMemo(
    () => [...new Set(tests.map((t) => t.category || "Radiology"))].sort((a, b) => a.localeCompare(b)),
    [tests],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (categoryFilter && (t.category || "Radiology") !== categoryFilter) return false;
      if (s && !t.testName.toLowerCase().includes(s) && !(t.testCode || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tests, categoryFilter, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CameraAltRounded sx={{ color: accent }} /> Select radiology test
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
          <TextField
            select size="small" label="Category" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 200, flex: 1 }}
          >
            <MenuItem value=""><em>All categories</em></MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField
            size="small" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
          />
        </Box>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
            {tests.length === 0
              ? "No radiology tests configured — add them in Schedule of Charges (Type: Radiology test)."
              : "No tests match."}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 380, overflowY: "auto" }}>
            {filtered.map((t) => (
              <ListItemButton
                key={t.chargeItemId}
                onClick={() => { onPick({ chargeItemId: t.chargeItemId, testName: t.testName, price: Number(t.price) }); onClose(); }}
                sx={{ borderRadius: 1.5, mb: 0.25 }}
              >
                <ListItemText
                  primary={t.testName}
                  secondary={[t.category, t.testCode].filter(Boolean).join(" · ") || undefined}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 600 }}
                />
                <Typography sx={{ fontWeight: 700, color: accent, ml: 2 }}>{inr(Number(t.price))}</Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
