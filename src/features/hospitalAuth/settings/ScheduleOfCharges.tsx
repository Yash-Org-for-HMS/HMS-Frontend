import { useState, useMemo, useEffect, useRef, memo, useCallback } from "react";
import { ACCENTS } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip, InputAdornment,
  List, ListItemButton, ListItemText, TextField, Divider, Autocomplete, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Switch, FormControlLabel, alpha,
} from "@mui/material";
import {
  AddRounded, EditRounded, DeleteRounded, SearchRounded, ReceiptLongRounded,
  ExpandMoreRounded, ChevronRightRounded, MeetingRoomRounded, TuneRounded,
  UnfoldMoreRounded, UnfoldLessRounded, HistoryRounded, ScienceRounded,
  ArrowUpwardRounded, ArrowDownwardRounded, CloseRounded, LibraryAddRounded,
} from "@mui/icons-material";
import type { CatalogEntry } from "./socCatalog";

// The predefined name catalog is large (~250 KB) — load it only when a dialog
// that needs it opens, and cache it after the first load.
let _socCatalog: Record<string, CatalogEntry[]> | null = null;
async function loadSocCatalog(): Promise<Record<string, CatalogEntry[]>> {
  if (!_socCatalog) _socCatalog = (await import("./socCatalog")).SOC_CATALOG;
  return _socCatalog;
}
import { MenuItem, Menu } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import LabStructureDialog from "@/components/soc/LabStructureDialog";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageHeader from "@/components/layout/PageHeader";
import { formatINRAuto } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ACCENT = ACCENTS.hospital;
const ACCENT_DARK = ACCENTS.hospitalDark;
const inr = formatINRAuto;

type Category = { chargeCategoryId: string; categoryName: string; categoryCode: string; parentId: string | null; description: string | null; iconName: string | null; sortOrder: number; isActive: boolean; _count?: { items: number } };
type RoomPrice = { roomClassId: string; price: number | string };
type Item = { chargeItemId: string; chargeCategoryId: string; itemName: string; itemCode: string | null; price: number | string; taxPercent: number | string; hsnCode?: string | null; unit: string | null; isActive: boolean; itemType?: string; roomPrices?: RoomPrice[] };
type RoomClass = { roomClassId: string; name: string; code: string; sortOrder: number; isActive: boolean };

// Hospital's Schedule of Charges (rate card): categories on the left (seeded from
// a default template on first open, then editable), priced charges/procedures on
// the right. Standalone price master — not yet wired into billing.
type SearchItem = Item & { category: { chargeCategoryId: string; categoryName: string } };

export default function ScheduleOfCharges() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catDialog, setCatDialog] = useState<{ mode: "add" | "edit"; cat?: Category; parentId?: string | null } | null>(null);
  const [itemDialog, setItemDialog] = useState<{ mode: "add" | "edit"; item?: Item } | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [structureItem, setStructureItem] = useState<Item | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);          // reveal the seeded, still-empty categories
  const [manageAnchor, setManageAnchor] = useState<null | HTMLElement>(null);

  const { data: categories = [], isLoading, isError, error, refetch } = useQuery<Category[]>({
    queryKey: ["soc-categories"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/categories")).data.data,
  });

  // Room classes drive the dynamic per-room pricing columns.
  const { data: roomClasses = [], refetch: refetchRoomClasses } = useQuery<RoomClass[]>({
    queryKey: ["soc-room-classes"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/room-classes")).data.data,
  });
  const activeRoomClasses = useMemo(() => roomClasses.filter((r) => r.isActive), [roomClasses]);
  // Charges table columns: Charge + Base + one per active room class + Status + actions.
  const colCount = 4 + activeRoomClasses.length;
  const headCellSx = { fontWeight: 700, color: "text.secondary", fontSize: "0.72rem", textTransform: "uppercase", bgcolor: "background.paper", whiteSpace: "nowrap" } as const;

  // Default-select the first category once loaded.
  const selected = categories.find((c) => c.chargeCategoryId === selectedId) ?? categories[0];
  const activeCategoryId = selected?.chargeCategoryId ?? null;

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

  // Subtree charge totals — a category is "in use" if it or any descendant holds
  // charges. Drives hiding the seeded-but-empty categories by default.
  const rollup = useMemo(() => {
    const m = new Map<string, number>();
    const calc = (c: Category): number => {
      let total = c._count?.items ?? 0;
      for (const k of childrenOf.get(c.chargeCategoryId) ?? []) total += calc(k);
      m.set(c.chargeCategoryId, total);
      return total;
    };
    for (const root of childrenOf.get(null) ?? []) calc(root);
    return m;
  }, [childrenOf]);
  const anyInUse = useMemo(() => categories.some((c) => (rollup.get(c.chargeCategoryId) ?? 0) > 0), [categories, rollup]);
  const emptyCount = useMemo(() => categories.filter((c) => (rollup.get(c.chargeCategoryId) ?? 0) === 0).length, [categories, rollup]);
  const effShowEmpty = showEmpty || !anyInUse;                // never leave the list blank on a fresh hospital
  const inView = (c: Category) => effShowEmpty || (rollup.get(c.chargeCategoryId) ?? 0) > 0;

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

  // One search across the whole rate card: matching charges + categories.
  // Debounced so it fires once the user pauses, not on every keystroke.
  const q = useDebouncedValue(search.trim(), 300);
  const { data: searchRes, isFetching: searching } = useQuery<{ categories: Category[]; items: SearchItem[] }>({
    queryKey: ["soc-search", q],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/search", { params: { q } })).data.data,
    enabled: q.length >= 1,
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

  // Jump from a search hit straight to editing the charge in its category.
  const openCharge = (catId: string, item: Item) => { setSelectedId(catId); setItemDialog({ mode: "edit", item }); };

  // Breadcrumb path for the selected category (parent › child).
  const parentName = selected?.parentId ? categories.find((c) => c.chargeCategoryId === selected.parentId)?.categoryName : null;

  // Recursive tree node (respects the in-use filter).
  const renderNode = (cat: Category, depth: number): React.ReactNode => {
    const kids = (childrenOf.get(cat.chargeCategoryId) ?? []).filter(inView);
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(cat.chargeCategoryId);
    const isSel = cat.chargeCategoryId === activeCategoryId;
    const count = rollup.get(cat.chargeCategoryId) ?? 0;
    const secondary = !cat.isActive ? "Inactive" : hasKids ? `${kids.length} subcategor${kids.length === 1 ? "y" : "ies"} · ${count}` : `${count} charge${count === 1 ? "" : "s"}`;
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
        subtitle="Your hospital's rate card — charges and prices, grouped by category."
        actions={
          <>
            <Button variant="outlined" startIcon={<TuneRounded />} onClick={(e) => setManageAnchor(e.currentTarget)}
              sx={{ textTransform: "none", color: ACCENT, borderColor: `${ACCENT}66` }}>Manage</Button>
            <Menu anchorEl={manageAnchor} open={Boolean(manageAnchor)} onClose={() => setManageAnchor(null)}>
              <MenuItem onClick={() => { setManageAnchor(null); setCatDialog({ mode: "add", parentId: null }); }}>
                <AddRounded fontSize="small" sx={{ mr: 1.25, color: "text.secondary" }} /> New category
              </MenuItem>
              <MenuItem onClick={() => { setManageAnchor(null); setRoomDialogOpen(true); }}>
                <MeetingRoomRounded fontSize="small" sx={{ mr: 1.25, color: "text.secondary" }} /> Room classes &amp; pricing
              </MenuItem>
            </Menu>
          </>
        }
      />

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
        {/* Categories */}
        <Paper elevation={0} sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", position: { md: "sticky" }, top: { md: 16 } }}>
          <Box sx={{ p: 1.5 }}>
            <TextField
              fullWidth size="small" placeholder="Search charges or categories…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
            />
          </Box>
          <Divider />
          <List dense disablePadding sx={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
            {q ? (
              // ── Search results: charges (jump to edit) + categories ──
              !searchRes && searching ? (
                <Typography variant="body2" sx={{ color: "text.secondary", p: 2, textAlign: "center" }}>Searching…</Typography>
              ) : (searchRes && (searchRes.items.length || searchRes.categories.length)) ? (
                <>
                  {searchRes.items.length > 0 && (
                    <>
                      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.disabled" }}>Charges</Typography>
                      {searchRes.items.map((it) => (
                        <ListItemButton key={it.chargeItemId} onClick={() => openCharge(it.category.chargeCategoryId, it)} sx={{ py: 0.6 }}>
                          <ListItemText
                            primary={it.itemName} secondary={`${it.category.categoryName} · ${inr(Number(it.price))}`}
                            primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: 600, noWrap: true }}
                            secondaryTypographyProps={{ fontSize: "0.72rem", color: "text.secondary", noWrap: true }}
                          />
                        </ListItemButton>
                      ))}
                    </>
                  )}
                  {searchRes.categories.length > 0 && (
                    <>
                      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.disabled" }}>Categories</Typography>
                      {searchRes.categories.map((c) => (
                        <ListItemButton key={c.chargeCategoryId} selected={c.chargeCategoryId === activeCategoryId} onClick={() => { setSelectedId(c.chargeCategoryId); setSearch(""); }}
                          sx={{ py: 0.6, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` } }}>
                          <ListItemText
                            primary={c.categoryName} secondary={!c.isActive ? "Inactive" : `${c._count?.items ?? 0} charge${(c._count?.items ?? 0) === 1 ? "" : "s"}`}
                            primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: 500 }}
                            secondaryTypographyProps={{ fontSize: "0.72rem", color: !c.isActive ? "warning.main" : "text.secondary" }}
                          />
                        </ListItemButton>
                      ))}
                    </>
                  )}
                </>
              ) : <Typography variant="body2" sx={{ color: "text.secondary", p: 2, textAlign: "center" }}>No charges or categories match.</Typography>
            ) : (
              // ── Tree (in-use categories by default) ──
              <>
                {(childrenOf.get(null) ?? []).filter(inView).map((root) => renderNode(root, 0))}
                {anyInUse && emptyCount > 0 && (
                  <ListItemButton onClick={() => setShowEmpty((v) => !v)} sx={{ mt: 0.5, borderTop: "1px solid", borderColor: "divider", color: "text.secondary" }}>
                    {effShowEmpty ? <UnfoldLessRounded fontSize="small" sx={{ mr: 1 }} /> : <UnfoldMoreRounded fontSize="small" sx={{ mr: 1 }} />}
                    <ListItemText
                      primary={effShowEmpty ? "Show only categories in use" : `Show all ${categories.length} categories`}
                      primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }}
                    />
                  </ListItemButton>
                )}
              </>
            )}
          </List>
        </Paper>

        {/* Charges in the selected category */}
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, flexWrap: "wrap" }}>
              <ReceiptLongRounded sx={{ color: ACCENT }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {parentName && <Typography component="span" sx={{ fontWeight: 500, color: "text.disabled" }}>{parentName} › </Typography>}
                  {selected?.categoryName ?? "—"}
                </Typography>
                {selected && !selected.isActive && <Chip label="Inactive category" size="small" sx={{ height: 18, fontSize: "0.65rem", bgcolor: "rgba(245,158,11,0.12)", color: "warning.main" }} />}
              </Box>
              <Box sx={{ flex: 1 }} />
              {selected && (
                <Tooltip title="Rename / reorder / deactivate category">
                  <IconButton size="small" onClick={() => setCatDialog({ mode: "edit", cat: selected })}><EditRounded fontSize="small" /></IconButton>
                </Tooltip>
              )}
              <Button variant="outlined" size="small" startIcon={<LibraryAddRounded />} disabled={!selected}
                onClick={() => setCatalogOpen(true)}
                sx={{ textTransform: "none", borderColor: alpha(ACCENT, 0.5), color: ACCENT }}>Add from catalog</Button>
              <Button variant="contained" size="small" startIcon={<AddRounded />} disabled={!selected}
                onClick={() => setItemDialog({ mode: "add" })}
                sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add Charge</Button>
            </Box>
            <Divider />
            <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflowX: "auto" }}>
              <Table stickyHeader size="small" sx={{ minWidth: 520 + activeRoomClasses.length * 90 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headCellSx}>Charge / Procedure</TableCell>
                    <TableCell align="right" sx={headCellSx}>Base</TableCell>
                    {activeRoomClasses.map((rc) => (
                      <TableCell key={rc.roomClassId} align="right" sx={headCellSx}>{rc.name}</TableCell>
                    ))}
                    <TableCell align="center" sx={headCellSx}>Status</TableCell>
                    <TableCell sx={headCellSx} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemsLoading ? (
                    <TableRowsSkeleton rows={5} columns={colCount} />
                  ) : itemsError ? (
                    <TableRow><TableCell colSpan={colCount}><ErrorState message={apiErrorText(itemsErr)} onRetry={() => refetchItems()} /></TableCell></TableRow>
                  ) : items.length === 0 ? (
                    <TableRow><TableCell colSpan={colCount}>
                      <Box sx={{ py: 4 }}>
                        <Mascot pose="nothing-here-yet" title="No charges yet" subtitle="Add the charges/procedures under this category and set their prices." size={120} />
                      </Box>
                    </TableCell></TableRow>
                  ) : (
                    items.map((it) => {
                      // Code / unit / tax collapse into one muted subtitle under the name.
                      const meta = [it.itemCode, it.unit, Number(it.taxPercent) > 0 ? `${Number(it.taxPercent)}% tax` : null, it.hsnCode ? `HSN ${it.hsnCode}` : null].filter(Boolean).join(" · ");
                      const priced = new Map((it.roomPrices ?? []).map((rp) => [rp.roomClassId, Number(rp.price)]));
                      return (
                        <TableRow key={it.chargeItemId} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, fontSize: "0.87rem" }}>
                              {it.itemName}
                              {it.itemType === "RADIOLOGY" && <Chip label="Radiology" size="small" sx={{ ml: 0.75, height: 17, fontSize: "0.6rem", fontWeight: 700, bgcolor: `${ACCENT}14`, color: ACCENT }} />}
                              {it.itemType === "LAB" && <Chip label="Lab" size="small" sx={{ ml: 0.75, height: 17, fontSize: "0.6rem", fontWeight: 700, bgcolor: "rgba(16,185,129,0.14)", color: "success.main" }} />}
                            </Typography>
                            {meta && <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{meta}</Typography>}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{inr(Number(it.price))}</TableCell>
                          {activeRoomClasses.map((rc) => {
                            const has = priced.has(rc.roomClassId);
                            return (
                              <TableCell key={rc.roomClassId} align="right" sx={{ whiteSpace: "nowrap", fontWeight: has ? 600 : 400, color: has ? ACCENT : "text.disabled" }}>
                                {has ? inr(priced.get(rc.roomClassId)!) : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell align="center">
                            <Chip label={it.isActive ? "Active" : "Inactive"} size="small"
                              sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600, bgcolor: it.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: it.isActive ? "success.main" : "error.main" }} />
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                            {it.itemType === "LAB" && <Tooltip title="Lab structure (single / profile parameters)"><IconButton size="small" onClick={() => setStructureItem(it)}><ScienceRounded fontSize="small" sx={{ color: "success.main" }} /></IconButton></Tooltip>}
                            <Tooltip title="Price history"><IconButton size="small" onClick={() => setHistoryItem(it)}><HistoryRounded fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => setItemDialog({ mode: "edit", item: it })}><EditRounded fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Delete"><IconButton size="small" onClick={() => deleteItem(it)}><DeleteRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton></Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>

      {catDialog && (
        <CategoryDialog
          mode={catDialog.mode} cat={catDialog.cat} categories={categories} defaultParentId={catDialog.parentId ?? null}
          onClose={() => setCatDialog(null)}
          onDone={(newId) => { setCatDialog(null); refetch(); if (newId) setSelectedId(newId); }}
        />
      )}
      {catalogOpen && selected && (
        <CatalogDialog
          categoryId={selected.chargeCategoryId} categoryCode={selected.categoryCode} categoryName={selected.categoryName}
          existing={items}
          onClose={() => setCatalogOpen(false)}
          onDone={() => { setCatalogOpen(false); refetchItems(); refetch(); }}
        />
      )}
      {itemDialog && selected && (
        <ItemDialog
          mode={itemDialog.mode} item={itemDialog.item} categoryId={selected.chargeCategoryId} categoryCode={selected.categoryCode} categoryName={selected.categoryName}
          roomClasses={activeRoomClasses}
          onClose={() => setItemDialog(null)}
          onDone={() => { setItemDialog(null); refetchItems(); refetch(); }}
        />
      )}
      {roomDialogOpen && (
        <RoomClassesDialog roomClasses={roomClasses} onClose={() => setRoomDialogOpen(false)} onChanged={() => { refetchRoomClasses(); refetchItems(); }} />
      )}
      {historyItem && (
        <PriceHistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
      {structureItem && (
        <LabStructureDialog chargeItemId={structureItem.chargeItemId} itemName={structureItem.itemName} onClose={() => setStructureItem(null)} />
      )}
    </Box>
  );
}

// ── Price history (append-only audit of price changes) ───────────────────────
type PriceHistoryRow = { chargeItemPriceHistoryId: string; scope: string; oldPrice: string | number | null; newPrice: string | number | null; changeType: "CREATE" | "UPDATE" | "REMOVE"; changedByName: string | null; changedAt: string };

// Compact relative time ("3 days ago") for the timeline; the exact timestamp is
// shown on hover.
function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.round(mo / 12)} yr ago`;
}

const CHANGE_META = {
  CREATE: { dot: "#10b981" },
  UPDATE: { dot: ACCENT },
  REMOVE: { dot: "#ef4444" },
} as const;

// The change delta as a compact pill: New / Removed, or ±amount·% with a direction
// arrow (a rise reads amber, a cut reads green — cheaper).
function DeltaPill({ r }: { r: PriceHistoryRow }) {
  const base = { height: 20, fontSize: "0.66rem", fontWeight: 700, "& .MuiChip-icon": { color: "inherit", ml: 0.5 } };
  if (r.changeType === "CREATE") return <Chip label="New" size="small" sx={{ ...base, bgcolor: "rgba(16,185,129,0.14)", color: "#0f9d78" }} />;
  if (r.changeType === "REMOVE") return <Chip label="Removed" size="small" sx={{ ...base, bgcolor: "rgba(239,68,68,0.12)", color: "#ef4444" }} />;
  const oldP = Number(r.oldPrice), newP = Number(r.newPrice);
  const diff = newP - oldP;
  if (!diff) return null;
  const up = diff > 0;
  const pct = oldP > 0 ? Math.round((Math.abs(diff) / oldP) * 100) : null;
  return (
    <Chip size="small"
      icon={up ? <ArrowUpwardRounded sx={{ fontSize: "0.9rem !important" }} /> : <ArrowDownwardRounded sx={{ fontSize: "0.9rem !important" }} />}
      label={`${up ? "+" : "−"}${inr(Math.abs(diff))}${pct != null ? ` · ${pct}%` : ""}`}
      sx={{ ...base, bgcolor: up ? "rgba(245,158,11,0.16)" : "rgba(16,185,129,0.14)", color: up ? "#b45309" : "#0f9d78" }}
    />
  );
}

function PriceHistoryDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { data: raw = [], isLoading, isError, refetch } = useQuery<PriceHistoryRow[]>({
    queryKey: ["soc-price-history", item.chargeItemId],
    queryFn: async () => (await axiosInstance.get(`/hospital/soc/items/${item.chargeItemId}/price-history`)).data.data,
  });
  const [scope, setScope] = useState<string>("All");

  // Newest first; the distinct scopes (Base price + each room class) drive the filter.
  const rows = useMemo(() => [...raw].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()), [raw]);
  const scopes = useMemo(() => Array.from(new Set(rows.map((r) => r.scope))), [rows]);
  const filtered = scope === "All" ? rows : rows.filter((r) => r.scope === scope);
  const lastChanged = rows[0]?.changedAt;
  const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, flex: "none", display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.12), color: ACCENT }}>
            <HistoryRounded />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2 }}>Price history</Typography>
            <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>{item.itemName}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary", flex: "none" }} aria-label="Close">
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}><TableRowsSkeleton rows={4} columns={2} /></Box>
        ) : isError ? (
          <Box sx={{ p: 2 }}><ErrorState message="Couldn't load price history." onRetry={() => refetch()} /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
            <HistoryRounded sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>No price changes recorded yet.</Typography>
            <Typography variant="caption" sx={{ color: "text.disabled" }}>Edits to this charge's price will show up here.</Typography>
          </Box>
        ) : (
          <>
            {/* Summary strip */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, px: 2.5, py: 2,
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)") }}>
              <Box>
                <Typography sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, fontSize: "0.62rem" }}>Current base price</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15 }}>{inr(Number(item.price))}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rows.length} change{rows.length === 1 ? "" : "s"}</Typography>
                {lastChanged && <Typography variant="caption" sx={{ color: "text.secondary" }}>last {relTime(lastChanged)}</Typography>}
              </Box>
            </Box>

            {/* Scope filter (only when the charge has room-class prices too) */}
            {scopes.length > 1 && (
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                {["All", ...scopes].map((s) => (
                  <Chip key={s} label={s} size="small" onClick={() => setScope(s)} variant={scope === s ? "filled" : "outlined"}
                    sx={{ height: 24, fontSize: "0.7rem", fontWeight: 600, ...(scope === s ? { bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: ACCENT_DARK } } : {}) }} />
                ))}
              </Box>
            )}

            {/* Timeline */}
            <Box sx={{ px: 2.5, py: 2 }}>
              {filtered.map((r, i) => {
                const last = i === filtered.length - 1;
                return (
                  <Box key={r.chargeItemPriceHistoryId} sx={{ display: "flex", gap: 1.75 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.4 }}>
                      <Box sx={{ width: 11, height: 11, borderRadius: "50%", flex: "none", bgcolor: CHANGE_META[r.changeType].dot,
                        boxShadow: (t) => `0 0 0 3px ${t.palette.background.paper}` }} />
                      {!last && <Box sx={{ width: 2, flex: 1, bgcolor: "divider", mt: 0.5 }} />}
                    </Box>
                    <Box sx={{ pb: last ? 0 : 2.25, minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.scope}</Typography>
                        <DeltaPill r={r} />
                      </Box>
                      <Box sx={{ mt: 0.25 }}>
                        {r.changeType === "UPDATE" ? (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            <Box component="span" sx={{ textDecoration: "line-through", color: "text.disabled" }}>{inr(Number(r.oldPrice))}</Box>
                            {" → "}<Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{inr(Number(r.newPrice))}</Box>
                          </Typography>
                        ) : r.changeType === "CREATE" ? (
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{inr(Number(r.newPrice))}</Typography>
                        ) : (
                          <Typography variant="body2" sx={{ textDecoration: "line-through", color: "text.disabled" }}>{inr(Number(r.oldPrice))}</Typography>
                        )}
                      </Box>
                      <Tooltip title={when(r.changedAt)} placement="top-start">
                        <Typography variant="caption" sx={{ color: "text.secondary", cursor: "default" }}>
                          {relTime(r.changedAt)}{r.changedByName ? ` · ${r.changedByName}` : ""}
                        </Typography>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Done</Button>
      </DialogActions>
    </Dialog>
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
// One catalog row — memoized so typing a price only re-renders the edited row,
// not the whole (up-to-50) list. Receives primitives + stable callbacks.
const CatalogRow = memo(function CatalogRow({ entry, checked, price, onToggle, onPrice }: {
  entry: CatalogEntry; checked: boolean; price: string;
  onToggle: (e: CatalogEntry) => void; onPrice: (name: string, itemType: string | undefined, v: string) => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.4, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none" }, bgcolor: checked ? alpha(ACCENT, 0.06) : "transparent" }}>
      <Checkbox size="small" checked={checked} onChange={() => onToggle(entry)} sx={{ p: 0.5, color: ACCENT, "&.Mui-checked": { color: ACCENT } }} />
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }} noWrap title={entry.name}>{entry.name}</Typography>
      <TextField size="small" type="number" placeholder="Price" value={price}
        onFocus={() => { if (!checked) onToggle(entry); }}
        onChange={(e) => onPrice(entry.name, entry.itemType, e.target.value)}
        sx={{ width: 108 }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
    </Box>
  );
});

// Bulk "Add from catalog": search the predefined names for this category (minus
// ones already added), tick + price the ones offered, add them all at once.
function CatalogDialog({ categoryId, categoryCode, categoryName, existing, onClose, onDone }: {
  categoryId: string; categoryCode: string; categoryName: string; existing: Item[]; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Record<string, { price: string; itemType?: string }>>({});

  useEffect(() => { let alive = true; loadSocCatalog().then((c) => { if (alive) setCatalog(c[categoryCode] || []); }); return () => { alive = false; }; }, [categoryCode]);

  const existingNames = useMemo(() => new Set(existing.map((i) => i.itemName.trim().toLowerCase())), [existing]);
  const candidates = useMemo(() => (catalog || []).filter((c) => !existingNames.has(c.name.trim().toLowerCase())), [catalog, existingNames]);
  const q = useDebouncedValue(search, 200).trim().toLowerCase();
  const shown = useMemo(() => (q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates).slice(0, 50), [candidates, q]);

  const toggle = useCallback((c: CatalogEntry) => setPicked((p) => { const n = { ...p }; if (n[c.name]) delete n[c.name]; else n[c.name] = { price: "", itemType: c.itemType }; return n; }), []);
  const setPrice = useCallback((name: string, itemType: string | undefined, price: string) => setPicked((p) => ({ ...p, [name]: { itemType: p[name]?.itemType ?? itemType, price } })), []);

  const ready = Object.entries(picked).filter(([, v]) => v.price !== "" && Number(v.price) >= 0 && Number.isFinite(Number(v.price)));

  const submit = async () => {
    if (!ready.length) { toast.error("Tick some names and enter their prices"); return; }
    setSaving(true);
    try {
      const items = ready.map(([itemName, v]) => ({ itemName, price: Number(v.price), itemType: v.itemType }));
      const res = await axiosInstance.post("/hospital/soc/items/bulk", { chargeCategoryId: categoryId, items });
      const { created, skipped } = res.data.data;
      toast.success(`Added ${created} charge${created === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped (already present)` : ""}`);
      onDone();
    } catch (err) { toast.error(getApiErrorMessage(err, "Failed to add charges")); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add from catalog<Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>{categoryName}</Typography></DialogTitle>
      <DialogContent dividers sx={{ height: "62vh", display: "flex", flexDirection: "column", p: 2 }}>
        {catalog === null ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center", color: "text.secondary" }}><Typography variant="body2">Loading catalog…</Typography></Box>
        ) : candidates.length === 0 ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
            <Mascot pose="all-caught-up" title={catalog.length ? "All added" : "No predefined names"}
              subtitle={catalog.length ? "Every predefined name for this category is already in your rate card." : "This category has no predefined name list — use Add Charge."} size={110} />
          </Box>
        ) : (
          <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0 }}>
            <TextField size="small" fullWidth placeholder="Search predefined names…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment> }} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {ready.length} priced{q ? ` · showing ${shown.length} of ${candidates.length}` : ` · ${candidates.length} available`}
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              {shown.map((c) => (
                <CatalogRow key={c.name} entry={c} checked={!!picked[c.name]} price={picked[c.name]?.price ?? ""} onToggle={toggle} onPrice={setPrice} />
              ))}
              {q && shown.length === 0 && <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}><Typography variant="body2">No match for "{search}"</Typography></Box>}
              {!q && candidates.length > shown.length && <Box sx={{ p: 1, textAlign: "center", color: "text.disabled" }}><Typography variant="caption">Search to see all {candidates.length} names</Typography></Box>}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "text.secondary" }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || ready.length === 0}
          sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>
          {saving ? "Adding…" : `Add ${ready.length} charge${ready.length === 1 ? "" : "s"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ItemDialog({ mode, item, categoryId, categoryCode, categoryName, roomClasses, onClose, onDone }: { mode: "add" | "edit"; item?: Item; categoryId: string; categoryCode: string; categoryName: string; roomClasses: RoomClass[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(item?.itemName ?? "");
  // Predefined names for this category power the name autocomplete.
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  useEffect(() => { let alive = true; loadSocCatalog().then((c) => { if (alive) setCatalog(c[categoryCode] || []); }); return () => { alive = false; }; }, [categoryCode]);
  const [code, setCode] = useState(item?.itemCode ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [tax, setTax] = useState(item && Number(item.taxPercent) > 0 ? String(item.taxPercent) : "");
  const [hsn, setHsn] = useState(item?.hsnCode ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [itemType, setItemType] = useState(item?.itemType ?? "GENERAL");
  // Per-room-class prices keyed by roomClassId (blank = use the base price).
  const [roomPrices, setRoomPrices] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const rp of item?.roomPrices ?? []) m[rp.roomClassId] = String(rp.price);
    return m;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Charge name is required"); return; }
    if (price === "" || Number(price) < 0 || !Number.isFinite(Number(price))) { toast.error("Enter a valid base price"); return; }
    setSaving(true);
    try {
      const roomPricesArr = Object.entries(roomPrices)
        .filter(([, v]) => v !== "" && Number(v) >= 0 && Number.isFinite(Number(v)))
        .map(([roomClassId, v]) => ({ roomClassId, price: Number(v) }));
      const body = {
        itemName: name.trim(), itemCode: code.trim() || undefined,
        price: Number(price), taxPercent: tax === "" ? undefined : Number(tax),
        hsnCode: hsn.trim() || undefined,
        unit: unit.trim() || undefined, isActive, itemType, roomPrices: roomPricesArr,
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
          <Autocomplete
            freeSolo
            options={catalog.map((c) => c.name)}
            inputValue={name}
            onInputChange={(_, v) => setName(v)}
            onChange={(_, v) => {
              if (typeof v === "string") {
                setName(v);
                const e = catalog.find((c) => c.name === v);
                if (e?.itemType) setItemType(e.itemType);
              }
            }}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              return (q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts).slice(0, 50);
            }}
            renderInput={(params) => <TextField {...params} label="Charge / procedure name" placeholder={catalog.length ? "Type or pick a predefined name…" : ""} autoFocus />}
          />
          <TextField select label="Type" value={itemType} onChange={(e) => setItemType(e.target.value)} fullWidth
            helperText={itemType === "RADIOLOGY" ? "Appears in the radiology order pickers; radiology orders price from this charge."
              : itemType === "LAB" ? "Appears in the lab order pickers; lab orders price from this charge."
              : "A plain billable charge."}>
            <MenuItem value="GENERAL">General charge</MenuItem>
            <MenuItem value="RADIOLOGY">Radiology test</MenuItem>
            <MenuItem value="LAB">Lab test</MenuItem>
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} fullWidth />
            <TextField label="Unit (optional)" placeholder="e.g. per day" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Base price (₹)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
            <TextField label="Tax % (optional)" type="number" value={tax} onChange={(e) => setTax(e.target.value)} fullWidth
              helperText="0 / blank = GST-exempt" />
            <TextField label="HSN/SAC (optional)" value={hsn} onChange={(e) => setHsn(e.target.value)} fullWidth
              inputProps={{ maxLength: 10 }} />
          </Stack>

          {roomClasses.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Room-wise pricing (optional)</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                Set a price per room class; leave blank to use the base price.
              </Typography>
              <Stack spacing={1.5}>
                {roomClasses.map((rc) => (
                  <TextField
                    key={rc.roomClassId} size="small" type="number" label={rc.name} fullWidth
                    value={roomPrices[rc.roomClassId] ?? ""}
                    onChange={(e) => setRoomPrices((m) => ({ ...m, [rc.roomClassId]: e.target.value }))}
                    placeholder={`Base ₹${price || "0"}`}
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  />
                ))}
              </Stack>
            </Box>
          )}

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

// ── Room classes manager (the pricing-matrix columns) ────────────────────────
function RoomClassesDialog({ roomClasses, onClose, onChanged }: { roomClasses: RoomClass[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try { await axiosInstance.post("/hospital/soc/room-classes", { name: newName.trim() }); setNewName(""); onChanged(); toast.success("Room class added"); }
    catch (e) { toast.error(getApiErrorMessage(e, "Failed to add room class")); }
    finally { setBusy(false); }
  };
  const toggle = async (rc: RoomClass) => {
    try { await axiosInstance.put(`/hospital/soc/room-classes/${rc.roomClassId}`, { isActive: !rc.isActive }); onChanged(); }
    catch (e) { toast.error(getApiErrorMessage(e, "Failed to update")); }
  };
  const rename = async (rc: RoomClass) => {
    const name = window.prompt("Room class name", rc.name);
    if (name == null || !name.trim() || name.trim() === rc.name) return;
    try { await axiosInstance.put(`/hospital/soc/room-classes/${rc.roomClassId}`, { name: name.trim() }); onChanged(); }
    catch (e) { toast.error(getApiErrorMessage(e, "Failed to rename")); }
  };
  const remove = async (rc: RoomClass) => {
    const ok = await confirm({ title: "Delete room class?", message: `Delete "${rc.name}"? Any per-room prices set for this class will be removed (charges fall back to their base price).`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await axiosInstance.delete(`/hospital/soc/room-classes/${rc.roomClassId}`); onChanged(); toast.success("Room class deleted"); }
    catch (e) { toast.error(getApiErrorMessage(e, "Failed to delete")); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Room Classes</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
          These become the price columns when adding a charge (e.g. General, Semi-Private, Private, Deluxe, ICU).
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField size="small" fullWidth placeholder="New room class name" value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <Button variant="contained" onClick={add} disabled={busy || !newName.trim()} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Add</Button>
        </Box>
        <Stack spacing={0.5}>
          {roomClasses.length === 0 && <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>No room classes yet.</Typography>}
          {roomClasses.map((rc) => (
            <Box key={rc.roomClassId} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography sx={{ flex: 1, fontWeight: 600, color: rc.isActive ? "text.primary" : "text.disabled" }}>{rc.name}</Typography>
              {!rc.isActive && <Chip label="Inactive" size="small" sx={{ height: 18, fontSize: "0.65rem" }} />}
              <Tooltip title="Rename"><IconButton size="small" onClick={() => rename(rc)}><EditRounded fontSize="small" /></IconButton></Tooltip>
              <Switch size="small" checked={rc.isActive} onChange={() => toggle(rc)} />
              <Tooltip title="Delete"><IconButton size="small" onClick={() => remove(rc)}><DeleteRounded fontSize="small" sx={{ color: "error.main" }} /></IconButton></Tooltip>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
