// Browser end-to-end test of the chat bubble.
// Needs: the site on http://localhost:8000, `wrangler dev --config test/wrangler.e2e.toml` on 8787,
// and test/mock-anthropic.mjs on 8788. Run: NODE_PATH=$(npm root -g) node test/e2e-browser.mjs [outdir]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OUT = process.argv[2] || ".";
const SITE = "http://localhost:8000";
const assert = (c, m) => { if (!c) throw new Error("FAILED: " + m); console.log("ok -", m); };

const browser = await chromium.launch();

async function pageWith({ endpoint, mobile = false, formsubmit = "ok" }) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "America/Phoenix" } : { viewport: { width: 1280, height: 900 }, timezoneId: "America/Phoenix" });
  const page = await ctx.newPage();
  const posted = [];
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.route("**/config.js", async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace(/chatEndpoint: "[^"]*"/, `chatEndpoint: "${endpoint}"`);
    await route.fulfill({ response: res, body });
  });
  await page.route("https://formsubmit.co/**", async (route) => {
    posted.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/json", body: formsubmit === "ok" ? '{"success":"true"}' : '{"success":"false"}' });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  return { ctx, page, posted };
}

const bubbles = (page) => page.$$eval(".pac-msg", (els) => els.map((e) => (e.classList.contains("me") ? "> " : "< ") + e.textContent));
async function sendText(page, text) {
  await page.fill("#pac-input", text);
  await page.press("#pac-input", "Enter");
}
async function waitBot(page, n) {
  await page.waitForFunction((n) => document.querySelectorAll(".pac-msg.bot").length >= n && !document.querySelector(".pac-typing"), n, { timeout: 15000 });
}

// ---------------------------------------------------------------- guided mode (Worker unreachable)
{
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  assert(await page.isVisible(".pac-launcher"), "launcher visible on the home page");
  await page.click(".pac-launcher");
  assert(await page.isVisible("#pac-panel"), "panel opens");
  await waitBot(page, 1);
  await page.click(".pac-chip >> text=How does it work?");
  await waitBot(page, 3);
  await page.click(".pac-chip >> text=Yes, let's do it");
  await waitBot(page, 4);
  await sendText(page, "123 Main St, Mesa AZ 85201");
  await waitBot(page, 5);
  await page.click(".pac-chip >> text=Needs major repairs");
  await waitBot(page, 6);
  await page.click(".pac-chip >> text=Within 30 days");
  await waitBot(page, 7);
  await sendText(page, "Dana Lee");
  await waitBot(page, 8);
  await sendText(page, "555-1212");
  await waitBot(page, 9);
  assert((await bubbles(page)).at(-1).includes("10-digit"), "rejects a bad phone number");
  await sendText(page, "602-555-0143");
  await waitBot(page, 10);
  await page.click(".pac-chip >> text=Yes, texting is fine");
  await waitBot(page, 11);
  const slotChips = await page.$$eval(".pac-chip.slot", (els) => els.map((e) => e.textContent));
  assert(slotChips.length >= 2 && slotChips.every((c) => / MST$/.test(c)), `suggests call times in the visitor's zone: ${slotChips.join(" | ")}`);
  await page.click(".pac-chip.slot >> nth=0");
  await page.waitForSelector(".pac-card", { timeout: 15000 });
  await waitBot(page, 12);
  assert(posted.length === 1 && posted[0].phone === "(602) 555-0143" && posted[0].smsConsent === true && /Main St/.test(posted[0].address), "guided lead posted to the form endpoint");
  assert(/requested, please confirm/.test(posted[0].callTime), "guided call time marked as a request");
  await page.screenshot({ path: `${OUT}/chat-guided-desktop.png` });
  // Persists across pages.
  await page.goto(`${SITE}/arizona.html`);
  await page.waitForSelector("#pac-panel:not([hidden])");
  assert((await page.$$(".pac-msg")).length >= 20, "conversation survives navigating to another page");
  await page.keyboard.press("Escape");
  assert(await page.isHidden("#pac-panel"), "Escape closes the panel");
  console.log((await bubbles(page)).slice(0, 4).join("\n"));
  await ctx.close();
}

// ---------------------------------------------------------------- AI mode (local Worker + mock API)
{
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:8787" });
  await page.goto(`${SITE}/sell-my-house-fast-mesa-az.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await sendText(page, "Hi, I inherited a house in Mesa");
  await waitBot(page, 2);
  await sendText(page, "I'm Dana Lee, 602-555-0143, 123 Main St Mesa AZ");
  await waitBot(page, 3);
  await sendText(page, "Can we book a call?");
  await waitBot(page, 4);
  const slots = await page.$$eval(".pac-chip.slot", (els) => els.map((e) => e.textContent));
  assert(slots.length >= 3, `AI offered slot buttons: ${slots.slice(0, 3).join(" | ")}`);
  await page.click(".pac-chip.slot >> nth=1");
  await page.waitForSelector(".pac-card", { timeout: 15000 });
  await waitBot(page, 5);
  const last = (await bubbles(page)).at(-1);
  assert(/all set/.test(last), `booking confirmed: ${last}`);
  const calHref = await page.getAttribute(".pac-card a.pac-action", "href");
  assert(/^https:\/\/calendar\.google\.com\//.test(calHref), "add-to-calendar link present");
  assert(posted.length === 0, "Worker emailed the lead itself, so the browser did not double-send");
  await page.screenshot({ path: `${OUT}/chat-ai-desktop.png` });
  console.log((await bubbles(page)).join("\n"));
  await ctx.close();
}

// ---------------------------------------------------------------- mobile + Spanish + teaser
{
  const { ctx, page } = await pageWith({ endpoint: "http://127.0.0.1:9", mobile: true });
  await page.clock.install();
  await page.goto(`${SITE}/es.html`);
  const lb = await page.$eval(".pac-launcher", (e) => { const r = e.getBoundingClientRect(); return { bottom: innerHeight - r.bottom, right: innerWidth - r.right, w: r.width }; });
  const bar = await page.$eval(".sticky-cta", (e) => e.getBoundingClientRect().height);
  assert(lb.bottom > bar, `launcher sits above the sticky bar (${Math.round(lb.bottom)}px > ${Math.round(bar)}px)`);
  await page.screenshot({ path: `${OUT}/chat-mobile-launcher.png` });
  await page.clock.fastForward(31000);
  await page.waitForSelector(".pac-teaser", { timeout: 5000 });
  assert(/vender/.test(await page.textContent(".pac-teaser")), "Spanish teaser appears after 30s on mobile");
  await page.screenshot({ path: `${OUT}/chat-mobile-teaser.png` });
  await page.click(".pac-teaser");
  await page.clock.runFor(1000);
  const box = await page.$eval("#pac-panel", (e) => ({ w: e.offsetWidth, h: e.offsetHeight })); // layout size (the open animation is frozen by the fake clock)
  assert(box.w === 390 && box.h >= 800, `panel is full screen on a phone (${box.w}x${box.h})`);
  assert(/Hola/.test((await bubbles(page))[0]), "greets in Spanish on es.html");
  assert(/Cerrar|Close/.test(await page.getAttribute(".pac-close", "aria-label")), "close button labelled");
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= 390, `no sideways scroll (${sw})`);
  await page.screenshot({ path: `${OUT}/chat-mobile-open.png` });
  await ctx.close();
}

await browser.close();
console.log("ALL BROWSER CHECKS PASSED");
