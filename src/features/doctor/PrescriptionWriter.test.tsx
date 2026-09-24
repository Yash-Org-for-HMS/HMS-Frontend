import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Picking a medicine off the dropdown must not claim the catalogue has none.
 *
 * MUI's Autocomplete writes the chosen option's LABEL back into the input on
 * reason "reset" — here "Telma 40 (Telmisartan 40 mg Tablet)". That string was
 * fed straight back into the debounced search, but the server matches
 * medicineName and genericName separately with `contains`, so the composite
 * label matches neither and came back empty. Empty results with a non-empty
 * query is exactly the condition for the "nothing in the catalogue matches"
 * helper text, so selecting a real medicine accused the catalogue of not
 * having it. Confirmed against the live catalogue first: every label tried
 * returned 0 rows where its typed prefix returned 1-2.
 *
 * The axios mock below reproduces that `contains` semantics rather than
 * returning a fixed list — a mock that answers every query identically cannot
 * fail on this bug.
 */

const CATALOGUE = [
  { medicineId: "m1", medicineName: "Telma 40", genericName: "Telmisartan 40 mg Tablet", sellingPrice: "12.00", inStock: 30 },
  { medicineId: "m2", medicineName: "Telmakind 40", genericName: "Telmisartan 40 mg Tablet", sellingPrice: "10.00", inStock: 12 },
];

const searched: string[] = [];

const get = vi.fn(async (url: string) => {
  const m = /\/doctor\/prescription\/medicines\?q=(.*)$/.exec(url);
  if (m) {
    const q = decodeURIComponent(m[1]).toLowerCase();
    searched.push(q);
    const hits = CATALOGUE.filter(
      (c) => c.medicineName.toLowerCase().includes(q) || c.genericName.toLowerCase().includes(q),
    );
    return { data: { success: true, data: hits } };
  }
  return { data: { data: null } };
});

vi.mock("@/api/axios", () => ({
  axiosInstance: {
    get: (...args: [string]) => get(...args),
    post: vi.fn(async () => ({ data: { data: [] } })),
  },
  API_URL: "http://localhost:5000/api",
}));

vi.mock("@/hooks/useEnabledModules", () => ({
  useEnabledModules: () => ({ isModuleEnabled: () => true }),
}));

vi.mock("@/providers/HospitalAuthContext", () => ({
  useHospitalAuth: () => ({ hospital: { hospitalName: "Test" }, user: { name: "Dr Test" }, branch: null }),
}));

import PrescriptionWriter from "./PrescriptionWriter";

const NO_MATCH = /Nothing in the medicine catalogue matches/i;

const open = () =>
  renderWithProviders(
    <PrescriptionWriter consultationId={null} patientId="p1" onRequireSave={async () => undefined} />,
  );

describe("PrescriptionWriter medicine picker", () => {
  beforeEach(() => {
    get.mockClear();
    searched.length = 0;
  });

  it("does not claim 'no match' for a medicine picked off the list", async () => {
    const user = userEvent.setup();
    open();

    const field = screen.getByLabelText(/Search Medicine or Type Custom/i);
    await user.type(field, "Telma");

    // The typed prefix finds both; the option list opens.
    const option = await screen.findByText("Telma 40", {}, { timeout: 3000 });
    await user.click(option);

    // The field now holds the composite label — the exact string the old code
    // re-searched on.
    await waitFor(() => expect((field as HTMLInputElement).value).toMatch(/Telma 40/));

    // Give the 500ms debounce room to fire a search it should never fire.
    await new Promise((r) => setTimeout(r, 900));

    expect(searched).not.toContain("telma 40 (telmisartan 40 mg tablet)");
    expect(screen.queryByText(NO_MATCH)).not.toBeInTheDocument();
  });

  it("still warns when the doctor types something the catalogue lacks", async () => {
    const user = userEvent.setup();
    open();

    await user.type(screen.getByLabelText(/Search Medicine or Type Custom/i), "Zzqqx");

    // The guidance for free-text prescribing must survive the fix.
    expect(await screen.findByText(NO_MATCH, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("prescribes what the field shows after the doctor types over a selection", async () => {
    const user = userEvent.setup();
    open();

    const field = screen.getByLabelText(/Search Medicine or Type Custom/i) as HTMLInputElement;
    await user.type(field, "Telma");
    await user.click(await screen.findByText("Telma 40", {}, { timeout: 3000 }));

    /* Change your mind and type a different drug over it — select the text,
       then type, which replaces it in one keystroke.

       Not user.clear(): emptying the input makes MUI fire onChange(null,
       "clear") and drop the selection on its own, so the bug never appears and
       the test passes against the unfixed code. Not "{selectall}" either — it
       is silently a no-op here and appends instead. Replacing a selection never
       passes through empty, so MUI keeps `value`, and handleAddItem reads
       selectedMedicine FIRST: the field reads one drug and the Rx gets the
       other. On a prescription that is a wrong-drug bug, not a cosmetic one. */
    field.setSelectionRange(0, field.value.length);
    await user.keyboard("Zzqqx");

    await user.type(screen.getByLabelText(/^Dose$/i), "500");
    await user.type(screen.getByLabelText(/^Days$/i), "3");
    await user.click(screen.getByRole("button", { name: /Add Medicine/i }));

    // The prescribed line must name what was on screen.
    expect(await screen.findByText("Zzqqx", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText("Telma 40")).not.toBeInTheDocument();
  }, 20000);
});
