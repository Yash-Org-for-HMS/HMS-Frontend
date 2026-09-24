import { useMemo, useState, type ReactNode } from "react";
import {
  TextField, MenuItem, ListSubheader, InputAdornment, Box, Typography,
  type SxProps, type Theme, type TextFieldProps,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";

export interface SelectOption {
  value: string;
  label: string;
  /** Second line under the label — a department, a code, a price. */
  secondary?: string;
  disabled?: boolean;
  /** Extra words the search should match but which are not shown. */
  keywords?: string;
}

interface Props {
  label: string;
  name: string;
  value: string;
  /**
   * MUI TextField s own handler type, forwarded untouched.
   *
   * Typed from TextFieldProps rather than a hand-written shape so an existing
   * handleChange can be passed straight across with no cast and no adapter —
   * the whole point of keeping the field a TextField underneath.
   */
  onChange: TextFieldProps["onChange"];
  options: SelectOption[];
  /** The greyed-out first row, shown when nothing is chosen. */
  placeholder?: string;
  /** A real, selectable "no filter" row — e.g. "All Departments". */
  emptyOption?: { value: string; label: string };
  searchPlaceholder?: string;
  /** Below this many options the search box is pointless, so it is hidden. */
  searchThreshold?: number;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  size?: "small" | "medium";
  sx?: SxProps<Theme>;
}

/**
 * A select whose list is searchable and scrolls, and which opens BELOW its
 * field rather than over it.
 *
 * A plain <TextField select> renders every option in one menu. With four
 * departments that is fine; with sixty doctors it covers the form, there is no
 * way to type at it, and finding someone means scrolling a list that has no
 * order you can predict. This keeps the same field and the same onChange shape
 * — `{ target: { name, value } }` — so swapping it in touches nothing else.
 *
 * Three things here are less obvious than they look:
 *
 *  - `renderValue` draws the field's text from `options`, NOT from whichever
 *    MenuItem happens to be mounted. Without it, typing a search that filters
 *    out the CHOSEN row blanks the field, because MUI displays the selected
 *    child's contents and that child is gone.
 *  - The search sits in a ListSubheader, which is sticky and — unlike a
 *    MenuItem — is not selectable, so it cannot be landed on with the arrow
 *    keys or picked by pressing Enter.
 *  - MUI's menus do their own type-ahead: typing "d" jumps to an option
 *    starting with "d". Inside a menu that would fight every keystroke, so the
 *    search box stops keys propagating — except Escape, which should still
 *    close the menu.
 */
export default function SearchableSelect({
  label, name, value, onChange, options,
  placeholder = "Select…",
  emptyOption,
  searchPlaceholder = "Search…",
  searchThreshold = 8,
  required, fullWidth = true, disabled, error, helperText, size, sx,
}: Props) {
  const [query, setQuery] = useState("");

  const showSearch = options.length >= searchThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.secondary ?? ""} ${o.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <TextField
      select
      name={name}
      label={label}
      value={value ?? ""}
      onChange={onChange}
      required={required}
      fullWidth={fullWidth}
      disabled={disabled}
      error={error}
      helperText={helperText}
      size={size}
      sx={sx}
      /**
       * Pinned shrunk, because `displayEmpty` below makes the field draw its
       * placeholder even with no value.
       *
       * A label normally floats up only when MUI thinks the field is filled,
       * and an empty select is not. So the label sat down in the field on top
       * of the placeholder and the two rendered over each other — "Doctor *"
       * and "Select a Doctor" in the same pixels.
       */
      slotProps={{ inputLabel: { shrink: true } }}
      SelectProps={{
        displayEmpty: true,
        // Drawn from `options`, so the field keeps its text while the list is
        // filtered — see the note above.
        renderValue: () => {
          if (value === "" || value == null) {
            return (
              <Typography component="span" sx={{ color: "text.disabled" }}>
                {emptyOption && value === emptyOption.value ? emptyOption.label : placeholder}
              </Typography>
            );
          }
          if (emptyOption && value === emptyOption.value) return emptyOption.label;
          return selected?.label ?? value;
        },
        // Reset the search on the way out, so reopening does not show the last
        // person's filter still applied.
        onClose: () => setQuery(""),
        MenuProps: {
          // Below the field, not over it.
          anchorOrigin: { vertical: "bottom", horizontal: "left" },
          transformOrigin: { vertical: "top", horizontal: "left" },
          PaperProps: { sx: { maxHeight: 340, mt: 0.5 } },
          // The list scrolls; the sticky search must not scroll with it.
          MenuListProps: { sx: { pt: showSearch ? 0 : undefined } },
        },
      }}
    >
      {showSearch && (
        <ListSubheader sx={{ p: 1, bgcolor: "background.paper", lineHeight: "normal" }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Let Escape through to close the menu; swallow the rest so the
            // menu's own type-ahead does not hijack what is being typed.
            onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </ListSubheader>
      )}

      {/* A real option, so "All Departments" can be chosen back. */}
      {emptyOption && (
        <MenuItem key="__empty" value={emptyOption.value}>{emptyOption.label}</MenuItem>
      )}

      {/* Kept mounted but hidden when no emptyOption exists: MUI warns about a
          value with no matching child, and this is the unchosen state. */}
      {!emptyOption && <MenuItem value="" disabled sx={{ display: "none" }}>{placeholder}</MenuItem>}

      {filtered.map((o) => (
        <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: o.secondary ? 600 : 400 }} noWrap>
              {o.label}
            </Typography>
            {o.secondary && (
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
                {o.secondary}
              </Typography>
            )}
          </Box>
        </MenuItem>
      ))}

      {filtered.length === 0 && (
        <Box sx={{ px: 2, py: 2.5, textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Nothing matches “{query}”.
          </Typography>
        </Box>
      )}
    </TextField>
  );
}
