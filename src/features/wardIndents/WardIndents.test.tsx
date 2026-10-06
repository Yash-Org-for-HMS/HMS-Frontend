import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * Ward indents, both sides. The ward: below-par items come filled in, and only
 * an indent the store has not started can be cancelled. The store: each line
 * offers what is still asked for, no more than is in store, and a line past
 * what was asked cannot be sent.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/axios", () => ({
  axiosInstance: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) },
  API_URL: "http://localhost:5000/api",
}));
vi.mock("@/providers/ConfirmContext", () => ({ useConfirm: () => async () => true }));

import WardIndents from "./WardIndents";
import StoreIndents from "./StoreIndents";

const line = (id: string, name: string, requested: number, issued: number, inStore: number) =>
  ({ indentItemId: id, stockItemId: `s-${id}`, name, unit: "pc", requested, issued, remaining: requested - issued, inStore });
const indent = (id: string, status: string, items: ReturnType<typeof line>[]) =>
  ({ indentId: id, wardId: "w1", wardName: "General", status, notes: null, createdAt: "2030-03-04T05:00:00.000Z", closedAt: null, closeReason: null, requestedBy: "Sister K", items });

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.post.mockResolvedValue({ data: { data: {} } });
});

describe("Indents — the ward", () => {
  it("fills in what is below par, sends it, and offers Cancel only before the store starts", async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === "/ward-indents/wards") return { data: { data: [{ wardId: "w1", wardName: "General", wardCode: "GEN" }] } };
      if (url === "/ward-indents/wards/w1") return { data: { data: [indent("i1", "OPEN", [line("a", "Gloves", 8, 0, 50)]), indent("i2", "PART_ISSUED", [line("b", "Cannula", 10, 5, 0)])] } };
      return { data: { data: [
        { stockItemId: "s-gloves", name: "Gloves", unit: "pair", onHand: 2, parLevel: 10, suggest: 8 },
        { stockItemId: "s-gauze", name: "Gauze", unit: "pack", onHand: 9, parLevel: 5, suggest: 0 },
      ] } };
    });
    renderWithProviders(<WardIndents />);
    expect(await screen.findByText("Waiting for the store")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /New indent/ }));
    const gloves = await screen.findByLabelText("Ask for Gloves");
    expect(gloves).toHaveValue("8");
    expect(screen.getByLabelText("Ask for Gauze")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Send to pharmacy (1)" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/ward-indents", { wardId: "w1", notes: undefined, lines: [{ stockItemId: "s-gloves", quantity: 8 }] }));
  });
});

describe("Indents — the store", () => {
  it("offers what is still asked for, capped by what is in store, and refuses more than was asked", async () => {
    api.get.mockResolvedValue({ data: { data: [indent("i1", "PART_ISSUED", [line("a", "Gloves", 8, 0, 50), line("b", "Cannula", 10, 5, 3)])] } });
    renderWithProviders(<StoreIndents />);
    fireEvent.click(await screen.findByRole("button", { name: "Issue" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Send now: Gloves")).toHaveValue("8");
    expect(within(dialog).getByLabelText("Send now: Cannula")).toHaveValue("3");
    fireEvent.change(within(dialog).getByLabelText("Send now: Cannula"), { target: { value: "6" } });
    expect(within(dialog).getByText("A line is more than the ward still asked for.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Issue" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Send now: Cannula"), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/ward-indents/i1/issue", { notes: undefined, lines: [{ indentItemId: "a", quantity: 8 }, { indentItemId: "b", quantity: 3 }] }));
  });
});
