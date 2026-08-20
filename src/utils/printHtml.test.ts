import { describe, it, expect, beforeEach } from "vitest";
import { printHtml } from "./printHtml";

/**
 * Guards the one thing that made every Print button in the app produce an
 * unstyled page in production while looking perfect in dev.
 *
 * Emotion — MUI's engine — switches to the CSSOM `insertRule()` API when
 * NODE_ENV is production. Its <style data-emotion> tags are then EMPTY in the
 * DOM while holding hundreds of real rules. The old code copied `el.outerHTML`,
 * so it copied empty tags and lost the lot. Dev never showed it, and neither
 * does a typecheck or a build, which is why it reached a deployment.
 *
 * The tests below therefore build style tags the same two ways Emotion does and
 * assert the rules survive. If someone "simplifies" the harvest back to
 * outerHTML, the first test fails here rather than silently in production.
 */

/**
 * The print document printHtml composed, read straight off the iframe.
 *
 * printHtml writes synchronously and only prints later, once stylesheets have
 * settled, so the document is fully there the instant the call returns.
 * Detaching the iframe here also makes printHtml's `isConnected` guard skip the
 * print() it would otherwise attempt — jsdom has no printer.
 */
function capture(fn: () => void): { html: string; doc: Document } {
  fn();
  const iframe = document.body.querySelector("iframe");
  if (!iframe?.contentDocument) throw new Error("printHtml did not build an iframe");
  const doc = iframe.contentDocument;
  const html = doc.documentElement.outerHTML;
  iframe.remove();
  return { html, doc };
}

/** A <style> whose rules live only in the CSSOM — how Emotion behaves in a build. */
function addSpeedyStyle(cssText: string): HTMLStyleElement {
  const el = document.createElement("style");
  el.setAttribute("data-emotion", "css");
  document.head.appendChild(el);
  el.sheet?.insertRule(cssText, 0);
  return el;
}

describe("printHtml", () => {
  beforeEach(() => {
    document.head.querySelectorAll("style, link").forEach((n) => n.remove());
    document.body.innerHTML = "";
  });

  it("carries rules from a style tag that is empty in the DOM", () => {
    const el = addSpeedyStyle(".css-abc { color: rgb(1, 2, 3); }");
    // The precondition the whole bug rests on: the tag looks empty, but isn't.
    expect(el.textContent).toBe("");
    expect(el.sheet?.cssRules.length).toBe(1);

    const { html } = capture(() => printHtml("<p>receipt</p>"));

    expect(html).toContain("color: rgb(1, 2, 3)");
    expect(html).toContain("<p>receipt</p>");
  });

  it("still copies a style tag that does hold its text, without duplicating it", () => {
    const el = document.createElement("style");
    el.textContent = ".plain { margin: 4px; }";
    document.head.appendChild(el);

    const { html } = capture(() => printHtml("<p>x</p>"));

    expect(html).toContain(".plain");
    expect(html.split(".plain").length - 1).toBe(1);
  });

  it("keeps stylesheet links as links so their own URLs still resolve", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/vendor.css";
    document.head.appendChild(link);

    const { html } = capture(() => printHtml("<p>x</p>"));

    // Re-serialising these would break url(...) references relative to the file.
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain("/assets/vendor.css");
  });

  it("preserves cascade order across mixed style and link tags", () => {
    const first = document.createElement("style");
    first.textContent = ".first {}";
    document.head.appendChild(first);
    addSpeedyStyle(".second {}");
    const third = document.createElement("style");
    third.textContent = ".third {}";
    document.head.appendChild(third);

    const { html } = capture(() => printHtml("<p>x</p>"));

    // Later rules win, so harvesting out of order silently changes the output.
    expect(html.indexOf(".first")).toBeLessThan(html.indexOf(".second"));
    expect(html.indexOf(".second")).toBeLessThan(html.indexOf(".third"));
  });

  it("writes extraCss after the app's own CSS so callers can override it", () => {
    addSpeedyStyle("body { background: rgb(9, 9, 9); }");

    const { html } = capture(() => printHtml("<p>x</p>", { extraCss: "@page{margin:1cm}" }));

    expect(html.indexOf("rgb(9, 9, 9)")).toBeLessThan(html.indexOf("@page{margin:1cm}"));
  });

  it("escapes the title rather than letting it open a tag", () => {
    const { doc } = capture(() => printHtml("<p>x</p>", { title: "INV <script>&" }));

    expect(doc.title).toBe("INV <script>&");
    expect(doc.querySelector("script")).toBeNull();
  });
});
