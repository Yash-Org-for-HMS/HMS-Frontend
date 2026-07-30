import { useState, useMemo, useEffect, useRef } from "react";
import { ACCENTS } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip, InputAdornment,
  List, ListItemButton, ListItemText, TextField, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Switch, FormControlLabel,
} from "@mui/material";
import {
  AddRounded, EditRounded, DeleteRounded, SearchRounded, ReceiptLongRounded,
  ExpandMoreRounded, ChevronRightRounded,
} from "@mui/icons-material";
import { MenuItem } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageHeader from "@/components/layout/PageHeader";
import { formatINRAuto } from "@/utils/format";

const ACCENT = ACCENTS.hospital;
const ACCENT_DARK = ACCENTS.hospitalDark;
const inr = formatINRAuto;

type Category = { chargeCategoryId: string; categoryName: string; categoryCode: string; parentId: string | null; description: string | null; iconName: string | null; sortOrder: number; isActive: boolean; _count?: { items: number } };
type Item = { chargeItemId: string; chargeCategoryId: string; itemName: string; itemCode: string | null; price: number | string; taxPercent: number | string; unit: string | null; isActive: boolean };

// Hospital's Schedule of Charges (rate card): categories on the left (seeded from
// a default template on first open, then editable), priced charges/procedures on
// the right. Standalone price master — not yet wired into billing.
export default function ScheduleOfCharges() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catDialog, setCatDialog] = useState<{ mode: "add" | "edit"; cat?: Category } | null>(null);
  const [itemDialog, setItemDialog] = useState<{ mode: "add" | "edit"; item?: Item } | null>(null);

  const { data: categories = [], isLoading, isError, error, refetch } = useQuery<Category[]>({
    queryKey: ["soc-categories"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/categories")).data.data,
  });

  // Default-select the first category once loaded.
  const selected = categories.find((c) => c.chargeCategoryId === selectedId) ?? categories[0];
  const activeCategoryId = selected?.chargeCategoryId ?? null;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? categories.filter((c) => c.categoryName.toLowerCase().includes(s)) : categories;
  }, [categories, search]);

  // Group categories by parent for the nested tree.
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, Category[]>();
    for (const c of categories) {
      const k = c.parentId ?? null;
      const arr = m.get(k);
      if (arr) arr.push(c); else m.set(k, [c]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName));
    return m;
  }, [categories]);

  // Expand top-level groups once, on first load.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && categories.length) {
      didInit.current = true;
      setExpanded(new Set((childrenOf.get(null) ?? []).map((c) => c.chargeCategoryId)));
    }
  }, [categories, childrenOf]);
  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const { data: items = [], isLoading: itemsLoading, isError: itemsError, error: itemsErr, refetch: refetchItems } = useQuery<Item[]>({
    queryKey: ["soc-items", activeCategoryId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/categories/${activeCategoryId}/items`)).data.data,
    enabled: !!activeCategoryId,
  });

  const deleteItem = async (item: Item) => {
    const ok = await confirm({ title: "Remove charge?", message: `Delete "${item.itemName}" from this category?`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/hospital/soc/items/${item.chargeItemId}`);
      toast.success("Charge removed");
      refetchItems();
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to remove charge"));
    }
  };

  // Recursive tree node.
  const renderNode = (cat: Category, depth: number): React.ReactNode => {
    const kids = childrenOf.get(cat.chargeCategoryId) ?? [];
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(cat.chargeCategoryId);
    const isSel = cat.chargeCategoryId === activeCategoryId;
    const secondary = !cat.isActive ? "Inactive" : hasKids ? `${kids.length} subcategor${kids.length === 1 ? "y" : "ies"}` : `${cat._count?.items ?? 0} charge${(cat._count?.items ?? 0) === 1 ? "" : "s"}`;
    return (
      <Box key={cat.chargeCategoryId}>
        <ListItemButton
          selected={isSel} onClick={() => setSelectedId(cat.chargeCategoryId)}
          sx={{ py: 0.55, pl: 1 + depth * 1.75, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` }, "&.Mui-selected:hover": { bgcolor: `${ACCENT}22` } }}
        >
          {hasKids ? (
            <Box component="span" onClick={(e) => { e.stopPropagation(); toggle(cat.chargeCategoryId); }} sx={{ display: "flex", mr: 0.5, color: "text.secondary" }}>
              {isOpen ? <ExpandMoreRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}
            </Box>
          ) : <Box sx={{ width: 24, flexShrink: 0 }} />}
          <ListItemText
            primary={cat.categoryName} secondary={secondary}
            primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: isSel ? 700 : hasKids ? 600 : 500, color: isSel ? ACCENT : "text.primary", noWrap: true }}
            secondaryTypographyProps={{ fontSize: "0.72rem", color: !cat.isActive ? "warning.main" : "text.secondary" }}
          />
        </ListItemButton>
        {hasKids && isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </Box>
    );
  };

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <PageHeader
        title="Schedule of Charges"
        subtitle="Your hospital's rate card — define charges and procedures under each category and set their prices."
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCatDialog({ mode: "add" })}
            sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add Category</Button>
        }
      />

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
        {/* Categories */}
        <Paper elevation={0} sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", position: { md: "sticky" }, top: { md: 16 } }}>
          <Box sx={{ p: 1.5 }}>
            <TextField
              fullWidth size="small" placeholder="Search categories…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
            />
          </Box>
          <Divider />
          <List dense disablePadding sx={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
            {search.trim() ? (
              // Search: flat matches across the whole tree.
              filtered.length ? filtered.map((c) => {
                const isSel = c.chargeCategoryId === activeCategoryId;
                return (
                  <ListItemButton
                    key={c.chargeCategoryId} selected={isSel} onClick={() => setSelectedId(c.chargeCategoryId)}
                    sx={{ py: 0.6, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` } }}
                  >
                    <ListItemText
                      primary={c.categoryName}
                      secondary={!c.isActive ? "Inactive" : `${c._count?.items ?? 0} charge${(c._count?.items ?? 0) === 1 ? "" : "s"}`}
                      primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: isSel ? 700 : 500, color: isSel ? ACCENT : "text.primary" }}
                      secondaryTypographyProps={{ fontSize: "0.72rem", color: !c.isActive ? "warning.main" : "text.secondary" }}
                    />
                  </ListItemButton>
                );
              }) : <Typography variant="body2" sx={{ color: "text.secondary", p: 2, textAlign: "center" }}>No categories match.</Typography>
            ) : (
              (childrenOf.get(null) ?? []).map((root) => renderNode(root, 0))
            )}
          </List>
        </Paper>

        {/* Charges in the selected category */}
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, flexWrap: "wrap" }}>
              <ReceiptLongRounded sx={{ color: ACCENT }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>{selected?.categoryName ?? "—"}</Typography>
                {selected && !selected.isActive && <Chip label="Inactive category" size="small" sx={{ height: 18, fontSize: "0.65rem", bgcolor: "rgba(245,158,11,0.12)", color: "warning.main" }} />}
              </Box>
              <Box sx={{ flex: 1 }} />
              {selected && (
                <Tooltip title="Rename / reorder / deactivate category">
                  <IconButton size="small" onClick={() => setCatDialog({ mode: "edit", cat: selected })}><EditRounded fontSize="small" /></IconButton>
                </Tooltip>
              )}
              <Button variant="contained" size="small" startIcon={<AddRounded />} disabled={!selected}
                onClick={() => setItemDialog({ mode: "add" })}
                sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add Charge</Button>
            </Box>
            <Divider />
            <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {["Charge / Procedure", "Code", "Unit", "Tax %", "Price", "Status", ""].map((h, i) => (
                      <TableCell key={h || i} align={i === 4 ? "right" : i >= 5 ? "center" : "left"} sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.72rem", textTransform: "uppercase", bgcolor: "background.paper" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemsLoading ? (
                    <TableRowsSkeleton rows={5} columns={7} />
                  ) : itemsError ? (
                    <TableRow><TableCell colSpan={7}><ErrorState message={apiErrorText(itemsErr)} onRetry={() => refetchItems()} /></TableCell></TableRow>
                  ) : items.length === 0 ? (
                    <TableRow><TableCell colSpan={7}>
                      <Box sx={{ py: 4 }}>
                        <Mascot pose="nothing-here-yet" title="No charges yet" subtitle="Add the charges/procedures under this category and set their prices." size={120} />
                      </Box>
                    </TableCell></TableRow>
                  ) : (
                    items.map((it) => (
                      <TableRow key={it.chargeItemId} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{it.itemName}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{it.itemCode || "—"}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{it.unit || "—"}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{Number(it.taxPercent) > 0 ? `${Number(it.taxPercent)}%` : "—"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{inr(Number(it.price))}</TableCell>
                        <TableCell align="center">
                          <Chip label={it.isActive ? "Active" : "Inactive"} size="small"
                            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600, bgcolor: it.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: it.isActive ? "success.main" : "error.main" }} />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => setItemDialog({ mode: "edit", item: it })}><EditRounded fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" onClick={() => deleteItem(it)}><DeleteRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>

      {catDialog && (
        <CategoryDialog
          mode={catDialog.mode} cat={catDialog.cat} categories={categories} defaultParentId={selected?.chargeCategoryId ?? null}
          onClose={() => setCatDialog(null)}
          onDone={(newId) => { setCatDialog(null); refetch(); if (newId) setSelectedId(newId); }}
        />
      )}
      {itemDialog && selected && (
        <ItemDialog
          mode={itemDialog.mode} item={itemDialog.item} categoryId={selected.chargeCategoryId} categoryName={selected.categoryName}
          onClose={() => setItemDialog(null)}
          onDone={() => { setItemDialog(null); refetchItems(); refetch(); }}
        />
      )}
    </Box>
  );
}

// ── Category add/edit ────────────────────────────────────────────────────────
function CategoryDialog({ mode, cat, categories, defaultParentId, onClose, onDone }: { mode: "add" | "edit"; cat?: Category; categories: Category[]; defaultParentId?: string | null; onClose: () => void; onDone: (newId?: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(cat?.categoryName ?? "");
  const [parentId, setParentId] = useState<string>(cat?.parentId ?? (mode === "add" ? (defaultParentId ?? "") : "") ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(cat?.sortOrder ?? ""));
  const [isActive, setIsActive] = useState(cat?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  // A category can't be moved under itself or any of its own descendants.
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (mode === "edit" && cat) {
      excluded.add(cat.chargeCategoryId);
      const childrenBy = new Map<string, Category[]>();
      for (const c of categories) if (c.parentId) { const a = childrenBy.get(c.parentId); a ? a.push(c) : childrenBy.set(c.parentId, [c]); }
      const stack = [cat.chargeCategoryId];
      while (stack.length) { const id = stack.pop()!; for (const ch of childrenBy.get(id) ?? []) if (!excluded.has(ch.chargeCategoryId)) { excluded.add(ch.chargeCategoryId); stack.push(ch.chargeCategoryId); } }
    }
    return categories.filter((c) => !excluded.has(c.chargeCategoryId)).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [mode, cat, categories]);

  const save = async () => {
    if (!name.trim()) { toast.error("Category name is required"); return; }
    setSaving(true);
    try {
      if (mode === "add") {
        const res = await axiosInstance.post("/hospital/soc/categories", { categoryName: name.trim(), parentId: parentId || undefined, description: description.trim() || undefined });
        toast.success("Category added");
        onDone(res.data?.data?.chargeCategoryId);
      } else {
        await axiosInstance.put(`/hospital/soc/categories/${cat!.chargeCategoryId}`, {
          categoryName: name.trim(), parentId: parentId || null, description: description.trim() || undefined,
          sortOrder: sortOrder === "" ? undefined : Number(sortOrder), isActive,
        });
        toast.success("Category updated");
        onDone();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save category"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === "add" ? "Add category" : "Edit category"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Category name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField select label="Parent category" value={parentId} onChange={(e) => setParentId(e.target.value)} fullWidth helperText="Leave as top level, or nest under a parent">
            <MenuItem value=""><em>— None (top level) —</em></MenuItem>
            {parentOptions.map((c) => <MenuItem key={c.chargeCategoryId} value={c.chargeCategoryId}>{c.categoryName}</MenuItem>)}
          </TextField>
          <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
          {mode === "edit" && (
            <>
              <TextField label="Sort order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} fullWidth helperText="Lower numbers appear first" />
              <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Active" />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Charge item add/edit ─────────────────────────────────────────────────────
function ItemDialog({ mode, item, categoryId, categoryName, onClose, onDone }: { mode: "add" | "edit"; item?: Item; categoryId: string; categoryName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(item?.itemName ?? "");
  const [code, setCode] = useState(item?.itemCode ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [tax, setTax] = useState(item && Number(item.taxPercent) > 0 ? String(item.taxPercent) : "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Charge name is required"); return; }
    if (price === "" || Number(price) < 0 || !Number.isFinite(Number(price))) { toast.error("Enter a valid price"); return; }
    setSaving(true);
    try {
      const body = {
        itemName: name.trim(), itemCode: code.trim() || undefined,
        price: Number(price), taxPercent: tax === "" ? undefined : Number(tax),
        unit: unit.trim() || undefined, isActive,
      };
      if (mode === "add") {
        await axiosInstance.post("/hospital/soc/items", { chargeCategoryId: categoryId, ...body });
        toast.success("Charge added");
      } else {
        await axiosInstance.put(`/hospital/soc/items/${item!.chargeItemId}`, body);
        toast.success("Charge updated");
      }
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save charge"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === "add" ? "Add charge" : "Edit charge"}<Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>{categoryName}</Typography></DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Charge / procedure name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} fullWidth />
            <TextField label="Unit (optional)" placeholder="e.g. per day" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Price (₹)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
            <TextField label="Tax % (optional)" type="number" value={tax} onChange={(e) => setTax(e.target.value)} fullWidth />
          </Stack>
          <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
