import { Children, forwardRef, isValidElement, useEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import MenuList, { type MenuListProps } from "@mui/material/MenuList";
import ListSubheader from "@mui/material/ListSubheader";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { useForkRef } from "@mui/material/utils";
import { SearchRounded } from "@mui/icons-material";
import { SEARCH_FROM } from "./dropdown";

/**
 * The list inside every dropdown and menu (the MuiMenu `list` slot, set in
 * theme.ts), so a long one can be searched wherever it opens — a select on a
 * page, in a dialog, an action menu — without touching each one.
 *
 * Under SEARCH_FROM choices it is MUI's own list, untouched. From there it
 * puts a search box at the top that stays put while the choices scroll, and
 * narrows them as you type. What the field shows is unaffected: a select
 * draws its text from its own choices, not from the filtered ones here.
 *
 * Less obvious, and why:
 *  - The box sits in a ListSubheader. MUI skips those when it decides which
 *    row to highlight or land on with the arrow keys, so the box is never
 *    "chosen" by Enter or arrowed onto as if it were an option.
 *  - MUI's menus jump to the row starting with whatever letter is typed.
 *    Inside the box that would steal every keystroke, so the box keeps its
 *    keys — except Escape and Tab, which still close the menu. Typing a letter
 *    while on a row goes into the box instead.
 *  - The chosen row is not focused (MUI would focus it on open, and focus
 *    again each time the list narrows, pulling the cursor out of the box);
 *    it is scrolled into view and the box takes the focus.
 */

/**
 * For a menu that brings its own search box, in a ListSubheader at its top
 * (SearchableSelect): MUI's own list, except that while that box is there no
 * row takes the focus. MUI focused the first row on open, and again whichever
 * row became first as the list narrowed — so the cursor left the box after a
 * letter or two ("deepa 1" reached the box as "de"). Now the cursor goes into
 * the box on open and stays there; the chosen row is scrolled into view.
 */
export const OwnSearchMenuList = forwardRef<HTMLUListElement, MenuListProps>(function OwnSearchMenuList(
  { children, autoFocusItem, sx, ...props },
  ref,
) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const handleRef = useForkRef(listRef, ref);
  const hasOwnSearch = Children.toArray(children).some((c) => isValidElement(c) && c.type === ListSubheader);

  useEffect(() => {
    if (!hasOwnSearch) return;
    const list = listRef.current;
    const chosen = list?.querySelector<HTMLElement>(".Mui-selected");
    if (typeof chosen?.scrollIntoView === "function") chosen.scrollIntoView({ block: "center" });
    list?.querySelector<HTMLInputElement>(".MuiListSubheader-root input")?.focus({ preventScroll: true });
  }, [hasOwnSearch]);

  return (
    <MenuList ref={handleRef} autoFocusItem={hasOwnSearch ? false : autoFocusItem} sx={[{ outline: 0 }, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {children}
    </MenuList>
  );
});

const skipsHighlight = (el: ReactElement) =>
  !!((el.type as { muiSkipListHighlight?: boolean })?.muiSkipListHighlight || (el.props as { muiSkipListHighlight?: boolean })?.muiSkipListHighlight);

/** The words a row shows: its text, and the usual text props of what it holds (ListItemText, Chip…). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement(node)) {
    const p = node.props as Record<string, unknown>;
    return [p.children, p.primary, p.secondary, p.label].map((x) => textOf(x as ReactNode)).join(" ");
  }
  return "";
}

const MenuListWithSearch = forwardRef<HTMLUListElement, MenuListProps>(function MenuListWithSearch(
  { children, autoFocusItem, onKeyDownCapture, sx, ...rest },
  ref,
) {
  const all = Children.toArray(children);
  const options = all.filter((c): c is ReactElement => isValidElement(c) && !skipsHighlight(c));
  const searchable = options.length >= SEARCH_FROM;

  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const handleRef = useForkRef(listRef, ref);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length === 0 ? all : options.filter((c) => {
    const text = textOf(c).toLowerCase();
    return words.every((w) => text.includes(w));
  });

  // On open: keep the width the full list had (it must not shrink as it
  // narrows), bring the chosen row into view, and put the cursor in the box.
  useEffect(() => {
    if (!searchable) return;
    const list = listRef.current;
    if (!list) return;
    list.style.minWidth = `${list.offsetWidth}px`;
    const chosen = list.querySelector<HTMLElement>(".Mui-selected");
    if (typeof chosen?.scrollIntoView === "function") chosen.scrollIntoView({ block: "center" });
    inputRef.current?.focus({ preventScroll: true });
  }, [searchable]);

  const firstRow = () =>
    listRef.current?.querySelector<HTMLElement>('li[tabindex]:not([aria-disabled="true"]):not(.Mui-disabled)') ?? null;

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" || e.key === "Tab") return;
    e.stopPropagation();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      firstRow()?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      firstRow()?.click();
    }
  };

  // On a row: arrow up from the first goes back to the box, and a letter is typed into it.
  const onRowsKeyDownCapture = (e: KeyboardEvent<HTMLUListElement>) => {
    onKeyDownCapture?.(e);
    if (e.target === inputRef.current) return;
    if (e.key === "ArrowUp" && e.target === firstRow()) {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      setQuery((q) => q + e.key);
      inputRef.current?.focus();
    }
  };

  if (!searchable) {
    return (
      <MenuList ref={handleRef} autoFocusItem={autoFocusItem} onKeyDownCapture={onKeyDownCapture} sx={sx} {...rest}>
        {children}
      </MenuList>
    );
  }

  return (
    <MenuList
      ref={handleRef}
      autoFocusItem={false}
      onKeyDownCapture={onRowsKeyDownCapture}
      sx={[{ pt: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...rest}
    >
      <ListSubheader key="__dropdown-search" sx={{ p: 1, lineHeight: "normal", bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", zIndex: 2 }}>
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search…"
          fullWidth
          startAdornment={<SearchRounded fontSize="small" sx={{ color: "text.secondary", mr: 1 }} />}
          inputProps={{ "aria-label": "Search the list", "data-dropdown-search": "" }}
          sx={{ px: 1, py: 0.25, borderRadius: 1.5, border: "1px solid", borderColor: "divider", fontSize: "0.875rem", color: "text.primary" }}
        />
        {shown.length === 0 && (
          <Typography variant="body2" sx={{ color: "text.secondary", px: 1, pt: 1.5, pb: 0.5, textAlign: "center" }}>
            Nothing matches “{query.trim()}”.
          </Typography>
        )}
      </ListSubheader>
      {shown}
    </MenuList>
  );
});

export default MenuListWithSearch;
