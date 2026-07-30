import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, List, ListItemButton, ListItemText, InputAdornment, CircularProgress,
} from "@mui/material";
import { SearchRounded, ReceiptLongRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINRAuto } from "@/utils/format";

const inr = formatINRAuto;

type Category = { chargeCategoryId: string; categoryName: string; isActive: boolean };
type Item = { chargeItemId: string; itemName: string; itemCode: string | null; price: number | string; unit: string | null; isActive: boolean };
export type PickedCharge = { chargeItemId: string; itemName: string; price: number };

// Reusable picker for the hospital's Schedule of Charges. Lets billing screens
// choose a rate-card charge; the caller sends only the chargeItemId — the server
// prices the line from the catalog. `accent` themes it to the host panel.
export default function SocChargePicker({ open, onClose, onPick, accent = "#6366f1" }: {
  open: boolean; onClose: () => void; onPick: (c: PickedCharge) => void; accent?: string;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["soc-picker-categories"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/categories")).data.data,
    enabled: open,
  });
  const activeCats = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const effectiveCategoryId = categoryId || activeCats[0]?.chargeCategoryId || "";

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["soc-picker-items", effectiveCategoryId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/categories/${effectiveCategoryId}/items`)).data.data,
    enabled: open && !!effectiveCategoryId,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((it) => it.isActive && (!s || it.itemName.toLowerCase().includes(s) || (it.itemCode || "").toLowerCase().includes(s)));
  }, [items, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptLongRounded sx={{ color: accent }} /> Pick from Schedule of Charges
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
          <TextField
            select size="small" label="Category" value={effectiveCategoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSearch(""); }}
            sx={{ minWidth: 220, flex: 1 }} disabled={catsLoading}
          >
            {activeCats.map((c) => <MenuItem key={c.chargeCategoryId} value={c.chargeCategoryId}>{c.categoryName}</MenuItem>)}
          </TextField>
          <TextField
            size="small" placeholder="Search charges…" value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
          />
        </Box>

        {itemsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
            No charges in this category yet — add them in Configuration → Schedule of Charges.
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((it) => (
              <ListItemButton
                key={it.chargeItemId}
                onClick={() => { onPick({ chargeItemId: it.chargeItemId, itemName: it.itemName, price: Number(it.price) }); onClose(); }}
                sx={{ borderRadius: 1.5, mb: 0.25 }}
              >
                <ListItemText
                  primary={it.itemName}
                  secondary={[it.itemCode, it.unit].filter(Boolean).join(" · ") || undefined}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 600 }}
                />
                <Typography sx={{ fontWeight: 700, color: accent, ml: 2 }}>{inr(Number(it.price))}</Typography>
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
