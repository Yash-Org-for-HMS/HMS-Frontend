import { describe, it, expect } from "vitest";
import { realmForUrl } from "./axios";

// A hospital mount missing from realmForUrl sends no token at all, and the page
// shows "Missing or malformed Authorization header" (the store room did).
describe("realmForUrl", () => {
  it("sends hospital-portal calls with the hospital login", () => {
    for (const url of ["/store-room/items", "/ipd/bed-tariffs", "/mrd/registers", "/ward-indents", "/hospital/staff"]) {
      expect(realmForUrl(url)).toBe("hospital");
    }
  });
  it("leaves the platform's own calls to the super admin login", () => {
    expect(realmForUrl("/hospitals")).toBe("admin");
    expect(realmForUrl("/store-roomy")).toBe("admin");
  });
});
