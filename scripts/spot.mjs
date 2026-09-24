/** Visit one route as one role and screenshot it. node scripts/spot.mjs <ROLE> <path> <name> */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const SP = "C:/Users/UE011/AppData/Local/Temp/claude/c--HMS/5e7d5c3c-6e05-45e9-9e54-0c07e09f3850/scratchpad";
const sessions = JSON.parse(fs.readFileSync(path.join(SP, "sessions.json"), "utf8"));
const [role, route, name] = process.argv.slice(2);

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
const fails = [];
page.on("response", (r) => { if (r.status() >= 400) fails.push(`${r.status()} ${r.url().replace("http://localhost:5000", "")}`); });
page.on("pageerror", (e) => fails.push("PAGEERROR " + e.message.slice(0, 160)));

const s = sessions[role];
await page.goto("http://localhost:5173/" + (role === "SUPER_ADMIN" ? "login" : "hospital/login"), { waitUntil: "domcontentloaded" });
await page.evaluate(([sess, isSa]) => {
  if (isSa) {
    sessionStorage.setItem("accessToken", sess.accessToken);
    sessionStorage.setItem("refreshToken", "spot");
    sessionStorage.setItem("user", JSON.stringify(sess.user));
  } else {
    sessionStorage.setItem("hospitalAccessToken", sess.hospitalAccessToken);
    sessionStorage.setItem("hospitalRefreshToken", "spot");
    sessionStorage.setItem("hospitalUser", JSON.stringify(sess.hospitalUser));
    sessionStorage.setItem("hospitalInfo", JSON.stringify(sess.hospitalInfo));
    if (sess.hospitalBranch) sessionStorage.setItem("hospitalBranch", JSON.stringify(sess.hospitalBranch));
    sessionStorage.setItem("hospitalSessionId", "spot");
  }
}, [s, role === "SUPER_ADMIN"]);

await page.goto("http://localhost:5173" + route, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
await page.waitForFunction(() => !document.querySelector(".MuiSkeleton-root"), null, { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(600);
const out = path.join(SP, "sweep", name + ".png");
await page.screenshot({ path: out, fullPage: true });
console.log("shot:", out);
console.log("failures:", fails.length ? fails.join(" | ") : "none");
await browser.close();
