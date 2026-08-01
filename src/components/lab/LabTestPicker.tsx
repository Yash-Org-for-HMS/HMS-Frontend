import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, List, ListItemButton, ListItemText, InputAdornment, CircularProgress,
} from "@mui/material";
import { SearchRounded, ScienceRounded, CheckCircleRounded, AddCircleOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINRAuto } from "@/utils/format";

const inr = formatINRAuto;

type LabTest = { chargeItemId: string; testName: string; testCode: string | null; price: number | string; category?: string | null };
export type PickedLabTest = { chargeItemId: string; testName: string; price: number };

// Category-browse, MULTI-ADD picker for lab tests (mastered in the Schedule of
// Charges, organized into categories). Unlike the radiology picker it stays open so
// several tests can be added to the host's basket; `selectedIds` shows what's already
// in the basket and clicking a row toggles it. Caller sends only chargeItemIds.
export default function LabTestPicker({ open, onClose, onToggle, selectedIds, accent = "#10b981", catalogUrl }: {
  open: boolean; onClose: () => void; onToggle: (t: PickedLabTest) => void; selectedIds: Set<string>; accent?: string; catalogUrl: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: tests = [], isLoading } = useQuery<LabTest[]>({
    queryKey: ["lab-test-picker", catalogUrl],
    queryFn: async () => (await axiosInstance.get(catalogUrl)).data.data || [],
    enabled: open,
  });

  const categories = useMemo(
    () => [...new Set(tests.map((t) => t.category || "Laboratory"))].sort((a, b) => a.localeCompare(b)),
    [tests],
  );
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (categoryFilter && (t.category || "Laboratory") !== categoryFilter) return false;
      if (s && !t.testName.toLowerCase().includes(s) && !(t.testCode || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tests, categoryFilter, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ScienceRounded sx={{ color: accent }} /> Select lab tests
        <Typography component="span" variant="caption" sx={{ ml: "auto", color: "text.secondary" }}>{selectedIds.size} selected</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
          <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 200, flex: 1 }}>
            <MenuItem value=""><em>All categories</em></MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />
        </Box>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
            {tests.length === 0
              ? "No lab tests configured — add them in Schedule of Charges (Type: Lab test)."
              : "No tests match."}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 380, overflowY: "auto" }}>
            {filtered.map((t) => {
              const added = selectedIds.has(t.chargeItemId);
              return (
                <ListItemButton key={t.chargeItemId} onClick={() => onToggle({ chargeItemId: t.chargeItemId, testName: t.testName, price: Number(t.price) })}
                  sx={{ borderRadius: 1.5, mb: 0.25, bgcolor: added ? `${accent}12` : undefined }}>
                  {added ? <CheckCircleRounded fontSize="small" sx={{ color: accent, mr: 1 }} /> : <AddCircleOutlineRounded fontSize="small" sx={{ color: "text.disabled", mr: 1 }} />}
                  <ListItemText
                    primary={t.testName}
                    secondary={[t.category, t.testCode].filter(Boolean).join(" · ") || undefined}
                    primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 600 }}
                  />
                  <Typography sx={{ fontWeight: 700, color: accent, ml: 2 }}>{inr(Number(t.price))}</Typography>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ bgcolor: accent, "&:hover": { bgcolor: accent } }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
