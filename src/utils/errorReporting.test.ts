import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setErrorReporter,
  reportClientError,
  noteFailedRequestId,
  getLastFailedRequestId,
} from "./errorReporting";

describe("client error reporting", () => {
  beforeEach(() => {
    setErrorReporter(null);
    noteFailedRequestId(null);
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    setErrorReporter(null);
    vi.restoreAllMocks();
  });

  it("logs even with no sink installed", () => {
    reportClientError(new Error("boom"), { source: "manual" });
    expect(console.error).toHaveBeenCalled();
  });

  it("forwards to an installed sink with the source", () => {
    const sink = vi.fn();
    setErrorReporter(sink);
    const err = new Error("boom");
    reportClientError(err, { source: "boundary", componentStack: "<App/>" });
    expect(sink).toHaveBeenCalledTimes(1);
    const [received, ctx] = sink.mock.calls[0];
    expect(received).toBe(err);
    expect(ctx.source).toBe("boundary");
    expect(ctx.componentStack).toBe("<App/>");
  });

  // A reporter that throws must not become a second failure on top of the one
  // being reported.
  it("survives a sink that throws", () => {
    setErrorReporter(() => { throw new Error("sink is broken"); });
    expect(() => reportClientError(new Error("boom"), { source: "manual" })).not.toThrow();
  });

  it("attaches the signed-in role and hospital", () => {
    sessionStorage.setItem("hospitalUser", JSON.stringify({ role: "RECEPTIONIST", hospitalId: "h-1" }));
    const sink = vi.fn();
    setErrorReporter(sink);
    reportClientError(new Error("boom"), { source: "window" });
    const ctx = sink.mock.calls[0][1];
    expect(ctx.role).toBe("RECEPTIONIST");
    expect(ctx.hospitalId).toBe("h-1");
  });

  // An unreadable session must never be the reason a crash goes unreported.
  it("still reports when the session is corrupt", () => {
    sessionStorage.setItem("hospitalUser", "not json");
    const sink = vi.fn();
    setErrorReporter(sink);
    reportClientError(new Error("boom"), { source: "window" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  describe("request-id correlation", () => {
    it("carries the last failed request id into the report", () => {
      noteFailedRequestId("req-abc");
      const sink = vi.fn();
      setErrorReporter(sink);
      reportClientError(new Error("boom"), { source: "boundary" });
      expect(sink.mock.calls[0][1].requestId).toBe("req-abc");
    });

    it("ignores empty ids rather than clearing a good one", () => {
      noteFailedRequestId("req-abc");
      noteFailedRequestId(undefined);
      noteFailedRequestId("");
      expect(getLastFailedRequestId()).toBe("req-abc");
    });

    it("keeps the most recent failure", () => {
      noteFailedRequestId("req-1");
      noteFailedRequestId("req-2");
      expect(getLastFailedRequestId()).toBe("req-2");
    });

    it("lets an explicit context id win over the recorded one", () => {
      noteFailedRequestId("req-abc");
      const sink = vi.fn();
      setErrorReporter(sink);
      reportClientError(new Error("boom"), { source: "manual", requestId: "explicit" });
      expect(sink.mock.calls[0][1].requestId).toBe("explicit");
    });
  });
});
