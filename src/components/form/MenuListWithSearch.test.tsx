import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { Button, Dialog, DialogContent, ListItemText, Menu, MenuItem, TextField } from "@mui/material";
import { renderWithProviders } from "@/test/renderWithProviders";
import { createPanelTheme } from "@/theme";
import { BRAND } from "@/styles/accents";
import SearchableSelect from "./SearchableSelect";
import { DROPDOWN_MAX_HEIGHT } from "./dropdown";

/**
 * Every dropdown in the app, through the theme every panel uses: a plain
 * <TextField select> — the kind on most screens, in a dialog as often as on a
 * page — scrolls instead of covering the page, and a long one can be searched.
 * Nothing at the call site asks for it, which is the point: a select added
 * tomorrow behaves the same.
 */

const theme = createPanelTheme(BRAND.action, BRAND.actionDark);
const themed = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
const wards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i + 1}`, name: `Ward ${i + 1}` }));

function WardPicker({ n, initial = "", onPick = () => {} }: { n: number; initial?: string; onPick?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <Dialog open>
      <DialogContent>
        <TextField select label="Ward" value={value} onChange={(e) => { setValue(e.target.value); onPick(e.target.value); }} fullWidth>
          {wards(n).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
        </TextField>
      </DialogContent>
    </Dialog>
  );
}

const openWard = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("combobox"));

describe("every dropdown (theme)", () => {
  it("caps the list's height, so it scrolls instead of covering the page", () => {
    const paper = (theme.components?.MuiMenu?.styleOverrides as { paper?: { maxHeight?: string } })?.paper;
    expect(paper?.maxHeight).toContain(`${DROPDOWN_MAX_HEIGHT}px`);
  });

  it("puts a search box, with the cursor in it, on a long plain select inside a dialog", async () => {
    const user = userEvent.setup();
    themed(<WardPicker n={30} />);
    await openWard(user);
    const box = await screen.findByPlaceholderText("Search…");
    await waitFor(() => expect(box).toHaveFocus());
  });

  it("leaves a short list as it was", async () => {
    const user = userEvent.setup();
    themed(<WardPicker n={5} />);
    await openWard(user);
    await screen.findByRole("listbox");
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  });

  it("narrows as you type, and Enter picks the first match", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    themed(<WardPicker n={30} onPick={onPick} />);
    await openWard(user);
    await user.type(await screen.findByPlaceholderText("Search…"), "ward 17");
    const list = screen.getByRole("listbox");
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ward 17"]);
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("w17");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    themed(<WardPicker n={30} />);
    await openWard(user);
    await user.type(await screen.findByPlaceholderText("Search…"), "icu");
    expect(screen.getByText(/Nothing matches “icu”/)).toBeInTheDocument();
    expect(within(screen.getByRole("listbox")).queryAllByRole("option")).toHaveLength(0);
  });

  it("keeps the chosen ward in the field while the list is filtered", async () => {
    const user = userEvent.setup();
    themed(<WardPicker n={30} initial="w3" />);
    await openWard(user);
    await user.type(await screen.findByPlaceholderText("Search…"), "20");
    // The open menu hides the page behind it from the accessibility tree.
    expect(screen.getByRole("combobox", { hidden: true })).toHaveTextContent("Ward 3");
  });

  it("arrow down goes from the box to the first match; a letter typed there goes back into the box", async () => {
    const user = userEvent.setup();
    themed(<WardPicker n={30} />);
    await openWard(user);
    const box = await screen.findByPlaceholderText("Search…");
    await user.type(box, "ward 2");
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[0]).toHaveFocus();
    await user.keyboard("5");
    expect(box).toHaveFocus();
    expect(box).toHaveValue("ward 25");
  });

  it("searches a long action menu too, by what its rows say", async () => {
    function Actions() {
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      return (
        <>
          <Button onClick={(e) => setAnchor(e.currentTarget)}>Templates</Button>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            {["Fever", "Cough", "Chest pain", "Diabetes review", "Hypertension", "Asthma", "Back pain", "Migraine", "Follow-up"].map((t) => (
              <MenuItem key={t}><ListItemText primary={t} secondary="SOAP template" /></MenuItem>
            ))}
          </Menu>
        </>
      );
    }
    const user = userEvent.setup();
    themed(<Actions />);
    await user.click(screen.getByRole("button", { name: "Templates" }));
    await user.type(await screen.findByPlaceholderText("Search…"), "pain");
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Chest painSOAP template", "Back painSOAP template"]);
  });

  it("does not add a second search box to SearchableSelect, which has its own", async () => {
    const user = userEvent.setup();
    const options = Array.from({ length: 12 }, (_, i) => ({ value: `d${i}`, label: `Dr ${i}` }));
    themed(<SearchableSelect label="Doctor" name="doctor" value="" onChange={() => {}} options={options} />);
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    expect(screen.getAllByPlaceholderText("Search…")).toHaveLength(1);
  });
});
