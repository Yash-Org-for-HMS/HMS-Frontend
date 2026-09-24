/**
 * Screenshot the login button while the request is in flight.
 *
 * The submit is normally far too quick to see, so the login call is held open
 * deliberately — the busy state is the thing being looked at, not the outcome.
 */
import { chromium } from "playwright-core";

const OUT = "C:/Users/UE011/AppData/Local/Temp/claude/c--HMS/5e7d5c3c-6e05-45e9-9e54-0c07e09f3850/scratchpad/sweep/";
const [page_, path_] = [process.argv[2] || "/hospital/login", process.argv[3] || "LOGIN_busy"];

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Hold the login response so the pending state stays on screen.
await page.route("**/login", async (route) => {
  await new Promise((r) => setTimeout(r, 9000));
  await route.continue();
});

await page.goto("http://localhost:5173" + page_, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill('input[type="email"]', "someone@example.test").catch(() => {});
await page.fill('input[type="password"]', "whatever123").catch(() => {});
await page.click('button[type="submit"]');

// Let the Lottie chunk land, then capture mid-flight.
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + path_ + ".png" });

const btn = page.locator('button[type="submit"]');
const style = await btn.evaluate((el) => {
  const c = getComputedStyle(el);
  return { background: c.backgroundColor, color: c.color, disabled: el.hasAttribute("disabled"), html: el.innerHTML.slice(0, 200) };
});
console.log(JSON.stringify(style, null, 2));
await browser.close();
