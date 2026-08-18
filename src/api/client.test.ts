import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("./axios", () => ({
  axiosInstance: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  API_URL: "http://localhost:5000/api",
}));

import { apiGet, apiGetList, apiPost } from "./client";

/**
 * The backend answers in three envelope shapes. Getting the unwrapping wrong
 * yields `undefined` rather than an error, which is why this is tested against
 * all of them rather than whichever one the last endpoint happened to use.
 */
describe("apiGet envelope unwrapping", () => {
  beforeEach(() => get.mockReset());

  it('unwraps { status: "success", data }', async () => {
    get.mockResolvedValue({ data: { status: "success", data: { id: 1 } } });
    await expect(apiGet<{ id: number }>("/x")).resolves.toEqual({ id: 1 });
  });

  it("unwraps { success: true, data }", async () => {
    get.mockResolvedValue({ data: { success: true, data: { id: 2 } } });
    await expect(apiGet<{ id: number }>("/x")).resolves.toEqual({ id: 2 });
  });

  it("unwraps { data, meta }", async () => {
    get.mockResolvedValue({ data: { data: { id: 3 }, meta: { total: 1 } } });
    await expect(apiGet<{ id: number }>("/x")).resolves.toEqual({ id: 3 });
  });

  // Some endpoints answer with a bare object. Treating that as "no data" would
  // be a worse failure than passing it through.
  it("passes through a response with no data key", async () => {
    get.mockResolvedValue({ data: { id: 4, name: "bare" } });
    await expect(apiGet<{ id: number }>("/x")).resolves.toEqual({ id: 4, name: "bare" });
  });

  it("preserves an explicit null payload", async () => {
    get.mockResolvedValue({ data: { success: true, data: null } });
    await expect(apiGet<null>("/x")).resolves.toBeNull();
  });

  // A failed request must reach the caller. Turning it into empty data here is
  // exactly the silent failure these helpers exist to end.
  it("does not swallow a rejection", async () => {
    // Throw synchronously: a mock that RETURNS a rejected promise leaves a
    // stray unhandled rejection recorded on the mock, which Vitest fails on.
    // Inside an async function a sync throw becomes the same rejection anyway.
    get.mockImplementation(() => { throw new Error("500"); });
    let caught: unknown = null;
    try {
      await apiGet("/x");
    } catch (e) {
      caught = e;
    }
    expect((caught as Error)?.message).toBe("500");
    // Clear the throwing implementation here rather than leaving it for the next
    // beforeEach — otherwise it is still installed while the suite tears down.
    get.mockReset();
  });
});

describe("apiGetList", () => {
  beforeEach(() => get.mockReset());

  it("returns rows and pagination from the `pagination` envelope", async () => {
    get.mockResolvedValue({ data: { status: "success", data: [{ id: 1 }], pagination: { total: 40, page: 1, limit: 10, totalPages: 4 } } });
    const r = await apiGetList<{ id: number }>("/x");
    expect(r.rows).toEqual([{ id: 1 }]);
    expect(r.meta?.total).toBe(40);
    expect(r.truncated).toBe(true);
  });

  it("reads the `meta` envelope the same way", async () => {
    get.mockResolvedValue({ data: { success: true, data: [{ id: 1 }, { id: 2 }], meta: { total: 2, limit: 50 } } });
    const r = await apiGetList<{ id: number }>("/x");
    expect(r.rows).toHaveLength(2);
    expect(r.truncated).toBe(false);
  });

  it("flags truncation against a caller-supplied limit when the server omits one", async () => {
    get.mockResolvedValue({ data: { success: true, data: [{ id: 1 }], meta: { total: 900 } } });
    const r = await apiGetList<{ id: number }>("/x", { params: { limit: 500 } });
    expect(r.truncated).toBe(true);
  });

  // A `.map()` on undefined is a white screen; an empty array is a quiet page.
  it("never hands back a non-array", async () => {
    get.mockResolvedValue({ data: { success: true, data: null } });
    expect((await apiGetList("/x")).rows).toEqual([]);
    get.mockResolvedValue({ data: { success: true, data: { notAnArray: true } } });
    expect((await apiGetList("/x")).rows).toEqual([]);
  });

  it("reports no meta when the endpoint sends none", async () => {
    get.mockResolvedValue({ data: { success: true, data: [{ id: 1 }] } });
    const r = await apiGetList<{ id: number }>("/x");
    expect(r.meta).toBeNull();
    expect(r.truncated).toBe(false);
  });
});

describe("apiPost", () => {
  beforeEach(() => post.mockReset());

  it("unwraps the created entity", async () => {
    post.mockResolvedValue({ data: { status: "success", data: { id: "new" } } });
    await expect(apiPost<{ id: string }>("/x", { a: 1 })).resolves.toEqual({ id: "new" });
  });

  it("forwards the body", async () => {
    post.mockResolvedValue({ data: { success: true, data: {} } });
    await apiPost("/x", { a: 1 });
    expect(post).toHaveBeenCalledWith("/x", { a: 1 }, undefined);
  });
});
