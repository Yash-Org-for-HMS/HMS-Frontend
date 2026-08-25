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

type RoomPrice = { roomClassId: string; price: number | string };
type Category = { chargeCategoryId: string; categoryName: string; isActive: boolean };
type Item = { chargeItemId: string; itemName: string; itemCode: string | null; price: number | string; unit: string | null; isActive: boolean; taxPercent?: number | string; itemType?: string; roomPrices?: RoomPrice[] };
// `basePrice` + `roomPrices` are returned so a caller (e.g. discharge) can re-derive
// the effective price if its room class changes after the pick; `price` is the
// effective price at pick time. `taxPercent` lets the caller preview per-line GST.
// The server always re-prices and re-taxes authoritatively.
export type PickedCharge = { chargeItemId: string; itemName: string; price: number; basePrice: number; roomPrices: RoomPrice[]; taxPercent: number };

// Reusable picker for the hospital's Schedule of Charges. Lets billing screens
// choose a rate-card charge; the caller sends only the chargeItemId — the server
// prices the line from the catalog. `accent` themes it to the host panel.
// When `roomClassId` is given, the displayed/returned price reflects that room
// class's matrix price (falling back to base); the server re-prices authoritatively.
// `roomClassName` (optional) is shown so the operator knows which class the prices reflect.
export default function SocChargePicker({ open, onClose, onPick, accent = "#6366f1", roomClassId, roomClassName, preferCategories }: {
  open: boolean; onClose: () => void; onPick: (c: PickedCharge) => void; accent?: string; roomClassId?: string | null; roomClassName?: string | null;
  /** Category names to open on, best match first; falls back to the first category. */
  preferCategories?: string[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["soc-picker-categories"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/categories")).data.data,
    enabled: open,
  });
  const activeCats = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  // A caller that knows what it is looking for says so, rather than opening on
  // whichever category happens to sort first — the ward wants consumables, not
  // whatever the catalogue lists at the top.
  const preferredId = useMemo(() => {
    if (!preferCategories?.length) return "";
    for (const want of preferCategories) {
      const hit = activeCats.find((c) => (c.categoryName || "").toLowerCase().includes(want.toLowerCase()));
      if (hit) return hit.chargeCategoryId;
    }
    return "";
  }, [activeCats, preferCategories]);
  const effectiveCategoryId = categoryId || preferredId || activeCats[0]?.chargeCategoryId || "";

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["soc-picker-items", effectiveCategoryId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/categories/${effectiveCategoryId}/items`)).data.data,
    enabled: open && !!effectiveCategoryId,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    // Exclude the "Room rent" item (itemType BED): the daily bed rent is billed
    // automatically per stay day, so it must never be pickable as an extra charge.
    return items.filter((it) => it.isActive && it.itemType !== "BED" && (!s || it.itemName.toLowerCase().includes(s) || (it.itemCode || "").toLowerCase().includes(s)));
  }, [items, search]);

  // Effective price for the selected room class: the matrix price when a class is
  // set and a row exists, else the base price (matches the server's resolveChargeItem).
  const effPrice = (it: Item): number => {
    if (roomClassId) {
      const rp = it.roomPrices?.find((r) => r.roomClassId === roomClassId);
      if (rp != null) return Number(rp.price);
    }
    return Number(it.price);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptLongRounded sx={{ color: accent }} /> Pick from Schedule of Charges
        {roomClassId && roomClassName && (
          <Typography component="span" variant="caption" sx={{ ml: "auto", px: 1, py: 0.25, borderRadius: 1, bgcolor: `${accent}18`, color: accent, fontWeight: 700 }}>
            {roomClassName} pricing
          </Typography>
        )}
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
                onClick={() => { onPick({ chargeItemId: it.chargeItemId, itemName: it.itemName, price: effPrice(it), basePrice: Number(it.price), roomPrices: it.roomPrices ?? [], taxPercent: Number(it.taxPercent) || 0 }); onClose(); }}
                sx={{ borderRadius: 1.5, mb: 0.25 }}
              >
                <ListItemText
                  primary={it.itemName}
                  secondary={[it.itemCode, it.unit].filter(Boolean).join(" · ") || undefined}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 600 }}
                />
                <Typography sx={{ fontWeight: 700, color: accent, ml: 2 }}>{inr(effPrice(it))}</Typography>
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
