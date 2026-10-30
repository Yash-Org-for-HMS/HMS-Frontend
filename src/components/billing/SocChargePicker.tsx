import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, List, ListItemButton, ListItemText, InputAdornment, CircularProgress,
} from "@mui/material";
import { SearchRounded, ReceiptLongRounded } from "@mui/icons-material";
import { chargePriceFor, type ListPrice } from "./chargePrice";
import { axiosInstance } from "@/api/axios";
import { formatINRAuto } from "@/utils/format";

const inr = formatINRAuto;

type RoomPrice = { roomClassId: string; price: number | string };
type Category = { chargeCategoryId: string; categoryName: string; isActive: boolean };
type Item = { chargeItemId: string; itemName: string; itemCode: string | null; price: number | string; unit: string | null; isActive: boolean; taxPercent?: number | string; itemType?: string; roomPrices?: RoomPrice[]; listPrices?: ListPrice[]; priceAtBilling?: boolean };
// `basePrice` + `roomPrices` are returned so a caller (e.g. discharge) can re-derive
// the effective price if its room class changes after the pick; `price` is the
// effective price at pick time. `taxPercent` lets the caller preview per-line GST.
// The server always re-prices and re-taxes authoritatively.
// `priceAtBilling`: the item has no fixed price; `price` is what was typed here,
// and the caller must send it - the server refuses the charge without one.
export type PickedCharge = { chargeItemId: string; itemName: string; price: number; basePrice: number; roomPrices: RoomPrice[]; listPrices?: ListPrice[]; taxPercent: number; priceAtBilling?: boolean };

// Reusable picker for the hospital's Schedule of Charges. Lets billing screens
// choose a rate-card charge; the caller sends only the chargeItemId - the server
// prices the line from the catalog. `accent` themes it to the host panel.
// When `roomClassId` is given, the displayed/returned price reflects that room
// class's matrix price (falling back to base); the server re-prices authoritatively.
// `roomClassName` (optional) is shown so the operator knows which class the prices reflect.
export default function SocChargePicker({ open, onClose, onPick, accent = "#0C73B5", roomClassId, roomClassName, preferCategories, rateListId }: {
  open: boolean; onClose: () => void; onPick: (c: PickedCharge) => void; accent?: string; roomClassId?: string | null; roomClassName?: string | null;
  /** An insured stay's payer rate list: its prices are shown, as they are billed. */
  rateListId?: string | null;
  /** Category names to open on, best match first; falls back to the first category. */
  preferCategories?: string[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  // A price-at-billing item picked, waiting for its price.
  const [typing, setTyping] = useState<Item | null>(null);
  const [typed, setTyped] = useState("");
  const close = () => { setTyping(null); setTyped(""); onClose(); };
  const typedOk = Number(typed) > 0 && Number.isFinite(Number(typed));
  const addTyped = () => {
    if (!typing || !typedOk) return;
    onPick({ chargeItemId: typing.chargeItemId, itemName: typing.itemName, price: Number(typed), basePrice: 0, roomPrices: [], taxPercent: Number(typing.taxPercent) || 0, priceAtBilling: true });
    close();
  };

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["soc-picker-categories"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/categories")).data.data,
    enabled: open,
  });
  const activeCats = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  // A caller that knows what it is looking for says so, rather than opening on
  // whichever category happens to sort first - the ward wants consumables, not
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
  const effPrice = (it: Item): number => chargePriceFor(it, roomClassId, rateListId);

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptLongRounded sx={{ color: accent }} /> Pick from Schedule of Charges
        {roomClassId && roomClassName && (
          <Typography component="span" variant="caption" sx={{ ml: "auto", px: 1, py: 0.25, borderRadius: 1, bgcolor: `${accent}18`, color: accent, fontWeight: 700 }}>
            {roomClassName} pricing
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {typing && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "warning.light", bgcolor: "rgba(245,158,11,0.06)" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{typing.itemName}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>This charge has no fixed price. Type the price for this bill.</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField size="small" type="number" label="Price (₹)" value={typed} autoFocus
                onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }}
                inputProps={{ min: 0, step: "0.01" }} sx={{ width: 180 }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
              <Button variant="contained" disabled={!typedOk} onClick={addTyped} sx={{ bgcolor: accent, textTransform: "none" }}>Add</Button>
              <Button color="inherit" onClick={() => setTyping(null)} sx={{ textTransform: "none" }}>Cancel</Button>
            </Box>
          </Box>
        )}
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
            No charges in this category yet - add them in Configuration → Schedule of Charges.
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((it) => (
              <ListItemButton
                key={it.chargeItemId}
                onClick={() => {
                  if (it.priceAtBilling) { setTyping(it); setTyped(""); return; }
                  onPick({ chargeItemId: it.chargeItemId, itemName: it.itemName, price: effPrice(it), basePrice: Number(it.price), roomPrices: it.roomPrices ?? [], listPrices: it.listPrices ?? [], taxPercent: Number(it.taxPercent) || 0 }); close();
                }}
                sx={{ borderRadius: 1.5, mb: 0.25 }}
              >
                <ListItemText
                  primary={it.itemName}
                  secondary={[it.itemCode, it.unit].filter(Boolean).join(" · ") || undefined}
                  primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                />
                <Typography sx={{ fontWeight: 700, color: it.priceAtBilling ? "warning.dark" : accent, ml: 2, whiteSpace: "nowrap", fontSize: it.priceAtBilling ? "0.8rem" : undefined }}>{it.priceAtBilling ? "Type price" : inr(effPrice(it))}</Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
