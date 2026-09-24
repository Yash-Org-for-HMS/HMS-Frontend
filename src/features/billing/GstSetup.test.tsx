import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The readiness chip must distinguish "all set" from "nothing set".
 *
 * It used to count only gaps — taxed rows with no HSN — so "No gaps" meant
 * both "every taxed item is coded" and "nothing is configured at all". Those
 * are opposite answers to the one question this page exists to settle, and
 * they collapsed into the same green chip because an unconfigured row is 0% by
 * schema default (Medicine.gstPercent and ChargeItem.taxPercent both
 * @default(0)) and a 0% row correctly needs no HSN.
 *
 * It was also clickable at zero, which filtered the table down to
 * "Nothing matches." — a control whose only outcome was an empty list.
 */

const row = (id: string, name: string, taxPercent: number, hsnCode: string | null) => ({
  kind: "MEDICINE" as const,
  id, name, secondary: null, taxPercent, hsnCode,
  needsAttention: taxPercent > 0 && !hsnCode,
});

let medicines: ReturnType<typeof row>[] = [];

const get = vi.fn(async () => ({ data: { data: { gstin: "27AABCC1234M1Z5", medicines, chargeItems: [] } } }));

vi.mock("@/api/axios", () => ({
  axiosInstance: { get: () => get(), put: vi.fn(async () => ({ data: { data: { updated: 0 } } })) },
  API_URL: "http://localhost:5000/api",
}));

import GstSetup from "./GstSetup";

/** The chip lives in the toolbar; find it by the text each state uses. */
const chip = (re: RegExp) => screen.findByText(re, {}, { timeout: 3000 });

describe("GstSetup readiness chip", () => {
  beforeEach(() => get.mockClear());

  it("says nothing is taxed yet rather than claiming a clean bill", async () => {
    medicines = [row("m1", "Paracetamol", 0, null), row("m2", "Amoxicillin", 0, null)];
    renderWithProviders(<GstSetup />);

    // A fresh hospital has every row at 0% with no code. That is not "no gaps".
    expect(await chip(/No tax rates set yet/)).toBeInTheDocument();
    expect(screen.queryByText(/all coded/)).not.toBeInTheDocument();
  });

  it("counts the gaps and filters to them", async () => {
    medicines = [
      row("m1", "Paracetamol", 12, null),
      row("m2", "Amoxicillin", 12, null),
      row("m3", "Telma 40", 12, "3004"),
    ];
    const user = userEvent.setup();
    renderWithProviders(<GstSetup />);

    const found = await chip(/2 missing an HSN/);
    await user.click(found);

    // Only the two uncoded rows survive the filter.
    await waitFor(() => expect(screen.queryByText("Telma 40")).not.toBeInTheDocument());
    expect(screen.getByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("Amoxicillin")).toBeInTheDocument();
  });

  it("names how many are coded once they all are", async () => {
    medicines = [row("m1", "Paracetamol", 12, "3004"), row("m2", "Amoxicillin", 12, "3004")];
    renderWithProviders(<GstSetup />);

    expect(await chip(/2 taxed items, all coded/)).toBeInTheDocument();
  });

  it("is not clickable when there is nothing to filter to", async () => {
    medicines = [row("m1", "Paracetamol", 12, "3004")];
    renderWithProviders(<GstSetup />);

    const label = await chip(/1 taxed item, all coded/);
    // MUI marks a clickable Chip with role="button"; a plain one has no role.
    // Clicking green used to narrow the table to "Nothing matches."
    expect(label.closest('[role="button"]')).toBeNull();
  });

  it("counts down as codes are typed, before any save", async () => {
    medicines = [row("m1", "Paracetamol", 12, null), row("m2", "Amoxicillin", 12, null)];
    const user = userEvent.setup();
    renderWithProviders(<GstSetup />);

    await chip(/2 missing an HSN/);

    // The per-row warning was already live; the tally was not, so it sat at the
    // starting number however much work you had done.
    const paracetamolRow = screen.getByText("Paracetamol").closest("tr")!;
    await user.type(within(paracetamolRow).getByPlaceholderText(/Needs a code/), "3004");

    expect(await chip(/1 missing an HSN/)).toBeInTheDocument();
  }, 20000);
});
