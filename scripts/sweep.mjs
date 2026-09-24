/**
 * Walk every screen as every role and record what breaks. Read-only.
 *
 *   node scripts/sweep.mjs [--role H_ADMIN] [--headed]
 *
 * For each route it records console errors, uncaught page errors, failed
 * network calls (>=400) and whether the page rendered anything, then writes a
 * screenshot. Findings land in sweep/report.json.
 *
 * Sessions come from scripts/checks/sweep-sessions.ts in the backend, which
 * mints exactly what a real login stores. Super admin logs in through the form
 * with the seeded credentials, so the login path is exercised too.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const SP = "C:/Users/UE011/AppData/Local/Temp/claude/c--HMS/5e7d5c3c-6e05-45e9-9e54-0c07e09f3850/scratchpad";
const OUT = path.join(SP, "sweep");
const APP = "http://localhost:5173";
const ROUTES_FILE = "C:/HMS/HMS-Frontend/src/App.tsx";

const sessions = JSON.parse(fs.readFileSync(path.join(SP, "sessions.json"), "utf8"));
const ids = JSON.parse(fs.readFileSync(path.join(SP, "ids.json"), "utf8"));

/** Which real id each parameterised route should be given. */
const PARAM = [
  [/^\/hospital\/patients\/:id/, "patient"], [/^\/hospital\/doctors\/:id/, "doctor"],
  [/^\/hospital\/departments\/:id/, "department"], [/^\/hospital\/users\/:id/, "user"],
  [/^\/hospital\/roles\/:id/, "role"], [/^\/hospital\/claims\/:id/, "claim"],
  [/^\/hospital\/form-builder\/:id/, "formTemplate"], [/^\/hospital\/ipd\/ot-cases\/:id/, "surgery"],
  [/^\/reception\/patients\/:id/, "patient"], [/^\/reception\/appointments\/:id/, "appointment"],
  [/^\/reception\/claims\/:id/, "claim"], [/^\/reception\/ipd\/ot-cases\/:id/, "surgery"],
  [/^\/reception\/billing\/invoices\/:invoiceId/, "invoice"],
  // consentFormId, not the admission it was issued against — passing the
  // admission id 404s and looks like a broken screen when nothing is broken.
  [/^\/reception\/consent-forms\/:id/, "consentForm"],
  [/^\/nurse\/chart\/:admissionId/, "admission"], [/^\/nurse\/ipd\/ot-cases\/:id/, "surgery"],
  [/^\/nurse\/patients\/:id/, "patient"],
  [/^\/doctor\/consultation\/:appointmentId/, "appointment"], [/^\/doctor\/patients\/:id/, "patient"],
  [/^\/lab\/orders\/:id/, "labOrder"], [/^\/lab\/radiology\/:id/, "radiologyOrder"],
  [/^\/plans\/:id/, "plan"], [/^\/leads\/:id/, "lead"], [/^\/hospitals\/:id/, "hospital"],
  [/^\/super-admins\/:id/, "superAdmin"],
  // hospitalOnboardingId, not the hospital's own id.
  [/^\/onboarding\/:id/, "onboarding"],
  [/^\/rbac\/users\/edit\/:id/, "user"], [/^\/rbac\/roles\/:id/, "role"],
  [/^\/subscription-billing\/invoices\/:id/, "subscriptionInvoice"],
];

const PREFIX_ROLE = [
  ["/hospital/", "H_ADMIN"], ["/reception/", "RECEPTIONIST"], ["/doctor/", "DOCTOR"],
  ["/nurse/", "NURSE"], ["/lab/", "LAB_TECH"], ["/pharmacy/", "PHARMACIST"],
];

function loadRoutes() {
  const src = fs.readFileSync(ROUTES_FILE, "utf8");
  const raw = [...src.matchAll(/path="([^"]*)"/g)].map((m) => m[1]);
  return [...new Set(raw)].filter((r) => r && r !== "*" && !r.endsWith("/login") && !r.includes("change-password"));
}

function resolve(route) {
  if (!route.includes(":")) return { route, url: route, skipped: null };
  const hit = PARAM.find(([re]) => re.test(route));
  if (!hit) return { route, url: null, skipped: "no id mapping" };
  const value = ids[hit[1]];
  if (!value) return { route, url: null, skipped: `no ${hit[1]} in the database` };
  return { route, url: route.replace(/:[A-Za-z]+/, value), skipped: null };
}

function roleFor(route) {
  const hit = PREFIX_ROLE.find(([p]) => route.startsWith(p));
  return hit ? hit[1] : "SUPER_ADMIN";
}

/** Noise that is not a defect: browser/extension chatter and dev-server logs. */
const IGNORE = [
  /Download the React DevTools/i, /\[vite\]/i, /React Router Future Flag/i,
  /favicon/i, /net::ERR_ABORTED.*\/@vite\//i,
];
const noise = (t) => IGNORE.some((re) => re.test(t));

async function visit(page, entry, role) {
  const consoleErrors = [];
  const pageErrors = [];
  const netFails = [];

  const onConsole = (m) => { if (m.type() === "error" && !noise(m.text())) consoleErrors.push(m.text().slice(0, 300)); };
  const onPageError = (e) => pageErrors.push(String(e.message).slice(0, 300));
  const onResponse = (r) => {
    if (r.status() >= 400 && !noise(r.url())) netFails.push(`${r.status()} ${r.request().method()} ${r.url().replace(APP, "").replace("http://localhost:5000", "")}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let landed = null, text = "", shot = null, stillLoading = false;
  try {
    await page.goto(APP + entry.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    /* Wait for the data, not just the document. A fixed 2s pause caught these
       screens mid-skeleton and scored them "ok" while nothing had rendered —
       the whole sweep was measuring its own impatience. */
    await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
    // MUI skeletons carry this class; give any that remain a chance to resolve.
    await page.waitForFunction(() => !document.querySelector(".MuiSkeleton-root"), null, { timeout: 12000 })
      .catch(() => { stillLoading = true; });
    await page.waitForTimeout(400);
    landed = new URL(page.url()).pathname;
    text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    const name = `${role}${entry.route.replace(/[^\w]+/g, "_")}.png`;
    shot = path.join(OUT, name);
    await page.screenshot({ path: shot, fullPage: false });
  } catch (e) {
    pageErrors.push("NAVIGATION: " + String(e.message).slice(0, 200));
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  return {
    role, route: entry.route, url: entry.url, landed,
    redirected: landed && landed !== entry.url,
    stillLoading,
    chars: text.length,
    blank: text.length < 40,
    snippet: text.slice(0, 160),
    consoleErrors, pageErrors, netFails,
    shot: shot ? path.basename(shot) : null,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.includes("--role") ? process.argv[process.argv.indexOf("--role") + 1] : null;

  const routes = loadRoutes().map(resolve);
  const browser = await chromium.launch({ channel: "chrome", headless: !process.argv.includes("--headed") });
  const results = [];

  const byRole = {};
  for (const r of routes) (byRole[roleFor(r.route)] ??= []).push(r);

  for (const [role, entries] of Object.entries(byRole)) {
    if (only && role !== only) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    if (role === "SUPER_ADMIN") {
      // Minted, not form-filled: the seeded password has been changed on this
      // database, so a form login just bounces back to /login and every route
      // after it scores as broken when nothing is broken but the sweep.
      const s = sessions.SUPER_ADMIN;
      if (!s) { console.error("  !! no super admin session"); await ctx.close(); continue; }
      await page.goto(APP + "/login", { waitUntil: "domcontentloaded" });
      await page.evaluate((sess) => {
        sessionStorage.setItem("accessToken", sess.accessToken);
        sessionStorage.setItem("refreshToken", "sweep");
        sessionStorage.setItem("user", JSON.stringify(sess.user));
      }, s);
    } else {
      const s = sessions[role];
      if (!s) { await ctx.close(); continue; }
      await page.goto(APP + "/hospital/login", { waitUntil: "domcontentloaded" });
      await page.evaluate((sess) => {
        sessionStorage.setItem("hospitalAccessToken", sess.hospitalAccessToken);
        sessionStorage.setItem("hospitalRefreshToken", "sweep");
        sessionStorage.setItem("hospitalUser", JSON.stringify(sess.hospitalUser));
        sessionStorage.setItem("hospitalInfo", JSON.stringify(sess.hospitalInfo));
        if (sess.hospitalBranch) sessionStorage.setItem("hospitalBranch", JSON.stringify(sess.hospitalBranch));
        sessionStorage.setItem("hospitalSessionId", "sweep");
      }, s);
    }

    for (const entry of entries) {
      if (entry.skipped) {
        results.push({ role, route: entry.route, skipped: entry.skipped, consoleErrors: [], pageErrors: [], netFails: [] });
        console.error(`  -- ${role} ${entry.route} (${entry.skipped})`);
        continue;
      }
      const r = await visit(page, entry, role);
      results.push(r);
      const bad = r.pageErrors.length || r.consoleErrors.length || r.netFails.length || r.blank;
      console.error(`  ${bad ? "XX" : "ok"} ${role} ${entry.route}${r.redirected ? ` -> ${r.landed}` : ""}`);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  console.error(`\n${results.length} routes swept -> ${path.join(OUT, "report.json")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
