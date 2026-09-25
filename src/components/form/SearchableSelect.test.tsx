import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { InputAdornment } from "@mui/material";
import SearchableSelect, { type SelectOption } from "./SearchableSelect";

/**
 * The select that six screens now use to pick a doctor, a patient, an
 * admission or a supplier.
 *
 * It exists because a plain <TextField select> renders every option in one
 * menu: fine for four departments, unusable for sixty doctors. The behaviours
 * below are the ones that made it worth building, and each has a way of
 * breaking silently.
 */

const docs = (n: number): SelectOption[] =>
  Array.from({ length: n }, (_, i) => ({
    value: `d${i}`,
    label: `Dr ${String.fromCharCode(65 + i)}${i}`,
    secondary: `${i} in queue`,
  }));

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("combobox"));
};

describe("SearchableSelect", () => {
  it("offers a search box once the list is long enough to need one", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SearchableSelect label="Doctor" name="doctor" value="" onChange={() => {}} options={docs(10)} />,
    );
    await open(user);
    expect(await screen.findByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("leaves the search box out of a short list", async () => {
    // A list you can see in full is faster to read than to search; the box
    // would be one more thing between the user and a visible answer.
    const user = userEvent.setup();
    renderWithProviders(
      <SearchableSelect label="Doctor" name="doctor" value="" onChange={() => {}} options={docs(3)} />,
    );
    await open(user);
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  });

  it("narrows the list as you type, matching the second line too", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SearchableSelect label="Doctor" name="doctor" value="" onChange={() => {}} options={docs(10)} />,
    );
    await open(user);
    await user.type(await screen.findByPlaceholderText("Search…"), "C2");

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Dr C2")).toBeInTheDocument();
    expect(within(list).queryByText("Dr A0")).not.toBeInTheDocument();
  });

  it("keeps showing the chosen name while the search hides that row", async () => {
    /**
     * The subtle one. MUI draws a select's field from the selected MenuItem's
     * contents, so once a search filters that row out of the DOM the field
     * goes BLANK — the user appears to have lost their choice mid-search.
     * renderValue reads from `options` instead, which is why it does not.
     */
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <SearchableSelect label="Doctor" name="doctor" value="d0" onChange={() => {}} options={docs(10)} />,
    );
    const field = () => container.querySelector(".MuiSelect-select")!;
    expect(field().textContent).toContain("Dr A0");

    await user.click(field());
    await user.type(await screen.findByPlaceholderText("Search…"), "C2");
    expect(field().textContent).toContain("Dr A0");
  });

  it("reports a pick in the shape a form handler already expects", async () => {
    // { target: { name, value } } — so an existing handleChange can be passed
    // straight in with no adapter, which is what made this swappable at all.
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SearchableSelect label="Doctor" name="doctorFilter" value="" onChange={onChange} options={docs(10)} />,
    );
    await open(user);
    await user.click(await screen.findByText("Dr D3"));

    expect(onChange).toHaveBeenCalled();
    const e = onChange.mock.calls[0][0];
    expect(e.target.name).toBe("doctorFilter");
    expect(e.target.value).toBe("d3");
  });

  it("shows the leading icon a caller passes", async () => {
    // The queue's filter funnel, which turns the accent colour while a filter
    // is on. Swapping the plain select in would have dropped it.
    renderWithProviders(
      <SearchableSelect
        label="" name="doctorFilter" value="" onChange={() => {}} options={docs(10)}
        startAdornment={<InputAdornment position="start"><span data-testid="funnel" /></InputAdornment>}
      />,
    );
    expect(screen.getByTestId("funnel")).toBeInTheDocument();
  });

  it("offers a real 'no filter' row when one is given", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SearchableSelect
        label="" name="doctorFilter" value="" onChange={() => {}} options={docs(10)}
        emptyOption={{ value: "", label: "All doctors (12)" }}
      />,
    );
    await open(user);
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("All doctors (12)")).toBeInTheDocument();
  });
});
