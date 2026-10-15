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
  const { ctx, page, posted } = await pageWith({ endpoint: process.env.WORKER_URL || "http://127.0.0.1:8787" });
  await page.goto(`${SITE}/sell-my-house-fast-mesa-az.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await sendText(page, "Hi, I inherited a house in Mesa");
  await waitBot(page, 2);
  await sendText(page, "I'm Dana Lee, 602-555-0177, 123 Main St Mesa AZ");
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

// ---------------------------------------------------------------- review fixes
{
  // Landscape phone: the panel fills the screen instead of shrinking to a sliver.
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, timezoneId: "America/Phoenix" });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await page.waitForTimeout(400);
  const box = await page.$eval("#pac-panel", (e) => ({ w: e.offsetWidth, h: e.offsetHeight, log: e.querySelector(".pac-log").offsetHeight }));
  assert(box.w === 844 && box.h === 390 && box.log >= 120, `landscape phone panel is full screen with room for messages (${box.w}x${box.h}, log ${box.log}px)`);
  assert(await page.getAttribute("#pac-panel", "aria-modal") === "true", "full-screen panel is modal");
  assert(await page.$eval(".site-header", (e) => e.closest("[inert]") !== null || e.inert === true || e.parentElement.inert === true), "page behind the panel is inert");
  await ctx.close();
}
{
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  // Talk to a person -> name + number are kept.
  await page.click(".pac-chip >> text=Talk to a person");
  await page.waitForSelector(".pac-card");
  await sendText(page, "Bob Smith, please call me");
  await waitBot(page, 3);
  assert(/best number/.test((await bubbles(page)).at(-1)), "asks for the number when only a name was given");
  await sendText(page, "602-555-0188");
  await waitBot(page, 4);
  assert(/text you/.test((await bubbles(page)).at(-1)), "then asks for texting consent");
  await sendText(page, "yeah");
  await waitBot(page, 5);
  await sendText(page, "Do I need to be home for the call?");
  await waitBot(page, 7);
  assert(/day and time/.test((await bubbles(page)).at(-1)), "a question at the time step is answered, not stored");
  assert(posted.length === 0, "nothing sent yet");
  await sendText(page, "tomorrow afternoon");
  await page.waitForFunction(() => document.querySelectorAll(".pac-card").length >= 2, null, { timeout: 15000 });
  assert(posted.length === 1 && posted[0].name === "Bob Smith" && posted[0].phone === "(602) 555-0188" && posted[0].smsConsent === true && /tomorrow afternoon/.test(posted[0].callTime), `callback lead keeps name and number: ${JSON.stringify({ n: posted[0]?.name, p: posted[0]?.phone, c: posted[0]?.callTime })}`);
  assert(/Call requested/.test(await page.textContent(".pac-card >> nth=-1")), "guided card says 'Call requested'");
  // Keyboard: choose a chip, then Escape still closes.
  await ctx.close();
}
{
  const { ctx, page } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await page.focus(".pac-chip >> text=How does it work?");
  await page.keyboard.press("Enter");
  await waitBot(page, 3);
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id === "pac-input"), "focus stays in the chat after choosing a reply");
  await page.keyboard.press("Escape");
  assert(await page.isHidden("#pac-panel"), "Escape closes after a reply button");
  await ctx.close();
}
{
  // Spanish 'Sí' counts as consent; a question at the address step is answered.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/es.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await page.click(".pac-chip >> text=Quiero una oferta en efectivo");
  await waitBot(page, 2);
  await sendText(page, "¿Cuánto tiempo toma cerrar?");
  await waitBot(page, 4);
  assert(/7 días/.test((await bubbles(page)).at(-2)), "question at the address step gets the FAQ answer");
  await sendText(page, "500 Oak Ave, Tampa FL");
  await waitBot(page, 5);
  await page.click(".pac-chip >> nth=0");
  await waitBot(page, 6);
  await page.click(".pac-chip >> nth=0");
  await waitBot(page, 7);
  await sendText(page, "Ana Ruiz");
  await waitBot(page, 8);
  await sendText(page, "813 555 0123");
  await waitBot(page, 9);
  await sendText(page, "Sí, claro");
  await waitBot(page, 10);
  await page.click(".pac-chip >> nth=0");
  await page.waitForFunction(() => document.querySelectorAll(".pac-msg.bot").length >= 11, null, { timeout: 15000 });
  assert(posted.length === 1 && posted[0].smsConsent === true && posted[0].address === "500 Oak Ave, Tampa FL", "'Sí, claro' is recorded as consent and the address is the real one");
  await ctx.close();
}
{
  // Phone: navigating with the chat open doesn't cover the next page.
  const { ctx, page } = await pageWith({ endpoint: "http://127.0.0.1:9", mobile: true });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await page.goto(`${SITE}/privacy.html`);
  await page.waitForSelector(".pac-launcher");
  assert(await page.isHidden("#pac-panel"), "chat does not reopen full screen over the next page on a phone");
  assert(!(await page.evaluate(() => document.documentElement.classList.contains("pac-lock"))), "page scroll is not locked");
  assert(await page.getAttribute(".pac-foot a[href='privacy.html']", "target") === "_blank", "chat privacy link opens in a new tab");
  await ctx.close();
}

{
  // The site form's texting box starts unchecked, and its note doesn't claim text consent.
  const { ctx, page } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  assert(!(await page.isChecked("#f-sms")), "lead form texting box is not pre-checked");
  assert(/by text only if you checked the box above/.test(await page.textContent("#offer")), "form note ties texts to the checkbox");
  // Resizing with the chat open keeps the modal state in step with the layout.
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  assert(await page.getAttribute("#pac-panel", "aria-modal") === null, "desktop panel is not modal");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector("#pac-panel").getAttribute("aria-modal") === "true");
  assert(await page.$eval(".site-header", (e) => !!e.closest("[inert]")), "shrinking to phone size makes the page behind the chat inert");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => document.querySelector("#pac-panel").getAttribute("aria-modal") === null);
  assert(await page.$eval(".site-header", (e) => !e.closest("[inert]")), "growing back to desktop gives the page back");
  await ctx.close();
}

// ---------------------------------------------------------------- consent, email-only, stop requests
const botCount = (page) => page.$$eval(".pac-msg.bot", (els) => els.length);
async function say(page, text, n = 1) {
  const before = await botCount(page);
  await sendText(page, text);
  await waitBot(page, before + n);
}
async function tap(page, label, n = 1) {
  const before = await botCount(page);
  await page.click(`.pac-chip >> text=${label}`);
  await waitBot(page, before + n);
}
const last = async (page, back = 1) => (await bubbles(page)).at(-back);
{
  // Foreclosure question, a seller who won't give a phone number, then STOP.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  assert(/Anthropic/.test(await page.textContent(".pac-foot")), "chat footer says an AI provider (Anthropic) processes chats");
  assert(!/follows up/.test(await page.textContent(".pac-foot")), "footer no longer promises a follow-up on every chat");
  await say(page, "I'm being foreclosed and the auction is in 10 days", 2);
  const fc = await last(page, 2);
  assert(/HUD/.test(fc) && /800-569-4287/.test(fc) && !/7 days/.test(fc), "foreclosure question gets the foreclosure answer with the HUD line");
  await tap(page, "Yes, let's do it");
  await say(page, "123 Main St, Mesa AZ 85201");
  await tap(page, "Needs major repairs");
  await tap(page, "Within 30 days");
  await say(page, "Dana Lee");
  await say(page, "I'd rather not");
  assert(/email you instead/.test(await last(page)), "a seller who won't give a number is offered email");
  await tap(page, "Email me instead");
  assert(/email address/.test(await last(page)), "asks for the email");
  await say(page, "dana@example.com");
  assert(posted.length === 1 && posted[0].phone === "" && posted[0].email === "dana@example.com" && posted[0].smsConsent === false && /Email follow-up only/.test(posted[0].callTime), `email-only lead posted: ${JSON.stringify(posted[0] && { p: posted[0].phone, e: posted[0].email, c: posted[0].callTime })}`);
  assert(/Seller: I'd rather not/.test(posted[0].transcript), "the lead carries the chat transcript");
  assert(/email you at dana@example.com/.test(await last(page)), "confirms email follow-up");
  await say(page, "STOP");
  assert(posted.length === 2 && posted[1].type === "do_not_contact" && posted[1].email === "dana@example.com" && /^DO NOT CONTACT/.test(posted[1]._subject), "STOP sends a do-not-contact notice for the known email");
  assert(/won't contact you again/.test(await last(page)), "confirms the stop request");
  await ctx.close();
}
{
  // Unclear consent is asked again; "ok but calls only" is not consent.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await tap(page, "I want a cash offer");
  await say(page, "77 Elm St, Phoenix AZ");
  await tap(page, "Move-in ready");
  await tap(page, "As soon as possible");
  await say(page, "Sam Ortiz");
  await say(page, "480-555-0101");
  assert(/Msg & data rates may apply; reply STOP to opt out\. Agreeing isn't required\./.test(await last(page)), "texting question carries the disclosures");
  await say(page, "maybe");
  assert(/Just to be sure/.test(await last(page)), "an unclear answer is asked again");
  await say(page, "ok but calls only");
  assert(/good time for a quick call/.test(await last(page)), "moves on to the call time");
  await say(page, "How much money will you offer?", 2);
  await say(page, "Can you close in 7 days?", 2);
  await say(page, "Am I obligated to sell?", 2);
  assert(posted.length === 0 && /day and time/.test(await last(page)), "questions at the call-time step are answered, never sent as the call time");
  assert((await bubbles(page)).some((b) => /7 days once title is clear/.test(b)), "the closing question got its answer");
  const before = await botCount(page);
  await page.click(".pac-chip.slot >> nth=0");
  await waitBot(page, before + 1);
  assert(posted.length === 1 && posted[0].smsConsent === false && posted[0].textingAnswer === "ok but calls only" && /reply STOP/.test(posted[0].textingQuestion), "'ok but calls only' is recorded as no, with the question and answer");
  const done = await last(page);
  assert(/confirm by phone/.test(done) && !/call or text\./.test(done.split("If anything")[0]), "calls-only seller isn't promised a text");
  await ctx.close();
}
{
  // A stop request before any details: asks which number, then sends the notice.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "please stop texting me");
  assert(/which one do you mean/.test(await last(page)), "a stop sentence gets the buttons");
  await tap(page, "Just no texts");
  assert(/phone number or email should we stop/.test(await last(page)), "asks which number to stop contacting");
  await say(page, "602-555-0143");
  assert(posted.length === 1 && posted[0].type === "do_not_contact" && posted[0].phone === "(602) 555-0143", "do-not-contact notice posted with the number");
  assert(/^DO NOT TEXT/.test(posted[0]._subject) && /keep any call they booked/.test(posted[0].action), "a texts-only stop says only that, and keeps any call");
  assert(/won't text you again/.test(await last(page)), "confirms exactly what will stop");
  await ctx.close();
}

// ---------------------------------------------------------------- stop requests: what is and isn't one
async function guidedTo(page, step, { phone = "602-555-0143", consent = "Calls only, please" } = {}) {
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await tap(page, "I want a cash offer");
  await say(page, "9 Pine St, Mesa AZ");
  if (step === "condition") return;
  await tap(page, "Move-in ready");
  await tap(page, "As soon as possible");
  await say(page, "Dana Lee");
  if (step === "phone") return;
  await say(page, phone);
  if (step === "consent") return;
  await tap(page, consent);
}
{
  // Everyday sentences are not opt-outs; a time preference is a time.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "The bank won't stop calling me about the late payments. Can you help?");
  assert(!/stop contacting/.test(await last(page)), "'the bank won't stop calling me' is not treated as a stop request");
  await page.goto(`${SITE}/index.html`);
  await ctx.close();
}
{
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "time");
  await say(page, "Please don't contact me before 5pm, I'm at work");
  assert(/which one do you mean/.test(await last(page)) && posted.length === 0, "a request that only sounds like an opt-out gets a question, not an action");
  await tap(page, "No, keep going");
  assert(posted.length === 1 && posted[0].type !== "do_not_contact" && /before 5pm/.test(posted[0].callTime), "'No, keep going' uses it as the call time");
  // After the lead: an iPhone curly-apostrophe opt-out still reaches the team.
  await say(page, "Actually I changed my mind. Don\u2019t call me again.");
  assert(posted.length === 2 && /^CONTACT REQUEST/.test(posted[1]._subject) && posted[1].phone === "(602) 555-0143" && /call me again/.test(posted[1].note),
    "after the lead, a curly-apostrophe 'Don\u2019t call me again' reaches the team word for word");
  assert(/passed your words to the team/.test(await last(page)), "seller is told it was passed on");
  await say(page, "Don't call me this week, I'm traveling");
  assert(posted.length === 3 && /^CONTACT REQUEST/.test(posted[2]._subject) && /this week/.test(posted[2].note), "a short-term request is passed on as written, not turned into a permanent stop");
  await say(page, "Stop the calls");
  assert(posted.length === 4 && /^CONTACT REQUEST/.test(posted[3]._subject), "'Stop the calls' after a lead reaches the team");
  await say(page, "Do you buy condos too?");
  assert(posted.length === 5 && /^MESSAGE FROM SELLER/.test(posted[4]._subject) && /condos/.test(posted[4].note) && /passed that to the team/.test(await last(page)),
    "after a lead, any other message is forwarded too, so nothing the seller says is lost");
  await ctx.close();
}
{
  // STOP in answer to the texting question declines texts; the call request still goes through.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "consent");
  await say(page, "STOP", 2);
  assert(/no texts/i.test(await last(page, 2)) && /good time for a quick call/.test(await last(page)), "STOP at the texting question means no texts, and the flow goes on");
  await say(page, "Evenings");
  assert(posted.length === 1 && posted[0].type !== "do_not_contact" && posted[0].smsConsent === false && posted[0].callTime.startsWith("Evenings"), "lead sent with no texting consent and 'Evenings' accepted as the time");
  await ctx.close();
}
{
  // A typed time inside a question is confirmed first.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "time");
  await say(page, "Can you call at 3pm?");
  assert(/Just to check: should the team call you around/.test(await last(page)) && posted.length === 0, "a time asked as a question is confirmed, not sent");
  await tap(page, "Yes, that works");
  assert(posted.length === 1 && /3pm/.test(posted[0].callTime), "confirmed time is sent");
  await ctx.close();
}
{
  // A stop that fails to send is never reported as done; the stop step has a way out.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9", formsubmit: "fail" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "consent");
  await say(page, "stop contacting me");
  await tap(page, "Stop all contact");
  assert(/couldn't send that/.test(await last(page)), "failed stop tells the seller how to reach us");
  await say(page, "did it work?");
  assert(!/won't contact you again/.test(await last(page)) && /couldn't send that/.test(await last(page)), "later replies don't claim the stop went through");
  await ctx.close();
}
{
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "stop");
  await say(page, "I want to sell my house");
  assert(/address of the property/.test(await last(page)), "someone who then wants an offer leaves the stop step");
  await say(page, "ok");
  assert(!/team has your details/.test((await bubbles(page)).join(" ")), "never claims the team has details it doesn't");
  assert(posted.length === 0, "nothing posted");
  await ctx.close();
}
{
  // AI mode: if the browser fallback for a stop fails, the seller is told how to reach us.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:8899", formsubmit: "fail" });
  await page.route("http://127.0.0.1:8899/health", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true,"ai":true}' }));
  await page.route("http://127.0.0.1:8899/chat", (r) => r.fulfill({
    status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ reply: "Done. We won't contact you again.", history: [], sig: "", ui: { stopped: "all" }, leads: [{ type: "do_not_contact", name: "Dana", phone: "(602) 555-0143", email: "", channels: "all", note: "STOP", delivered: false }] }),
  }));
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await sendText(page, "STOP, my number is 602-555-0143");
  await page.waitForFunction(() => [...document.querySelectorAll(".pac-msg.bot")].some((e) => /couldn't send that/.test(e.textContent)), null, { timeout: 15000 });
  assert(posted.length === 1 && /^DO NOT CONTACT/.test(posted[0]._subject), "AI-mode stop fallback was attempted, and its failure is shown to the seller");
  await ctx.close();
}
{
  // Phones in landscape keep room for the conversation.
  const { ctx, page } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.setViewportSize({ width: 568, height: 320 });
  for (const path of ["index.html", "es.html"]) {
    await page.goto(`${SITE}/${path}`);
    await page.click(".pac-launcher");
    await waitBot(page, 1);
    const m = await page.evaluate(() => {
      const p = document.querySelector("#pac-panel").getBoundingClientRect();
      const f = document.querySelector(".pac-foot").getBoundingClientRect();
      return { log: document.querySelector(".pac-log").offsetHeight, footBottom: f.bottom, panelBottom: p.bottom };
    });
    assert(m.log >= 60 && m.footBottom <= m.panelBottom + 1, `landscape ${path}: conversation keeps room (log ${m.log}px) and the footer fits`);
    await page.evaluate(() => sessionStorage.clear());
  }
  await ctx.close();
}

{
  // "Stop all" at the texting question is a full stop: no lead goes out.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "consent");
  await say(page, "Stop all");
  assert(posted.length === 1 && /^DO NOT CONTACT/.test(posted[0]._subject), "'Stop all' at the texting question files a full stop and no lead");
  await ctx.close();
}
{
  // "Don't call me, text me instead": asked, then "Just no calls" sends the lead for text follow-up.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "time", { consent: "Yes, texting is fine" });
  await say(page, "Don't call me, text me instead");
  assert(/which one do you mean/.test(await last(page)), "a preference gets the question");
  await tap(page, "Just no calls", 2);
  assert(posted.length === 1 && posted[0].phone === "(602) 555-0143" && posted[0].smsConsent === true && /no calls/.test(posted[0].contactLimits) && /No calls/.test(posted[0].callTime), `lead sent for text follow-up, marked no calls: ${posted[0] && posted[0].contactLimits}`);
  assert(/not by phone/.test(await last(page)), "seller is told the team will text or email");
  await ctx.close();
}
{
  // The 'which number' step keeps the stop until it has a number (or a clear change of mind).
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "Stop calling me");
  await tap(page, "Just no calls");
  await say(page, "The one you keep calling me on");
  assert(/need the phone number or email/.test(await last(page)) && posted.length === 0, "a vague answer is asked again, not turned into a sales pitch");
  await say(page, "602-555-0143");
  assert(posted.length === 1 && /^DO NOT CALL/.test(posted[0]._subject), "then the DO NOT CALL notice goes out");
  await ctx.close();
}
{
  // After a lead: other common opt-out wording is honoured.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "time");
  await tap(page, "As soon as possible");
  await say(page, "Please unsubscribe me");
  assert(posted.length === 2 && /^DO NOT CONTACT/.test(posted[1]._subject), "'Please unsubscribe me' after a lead sends the notice");
  await ctx.close();
}
{
  // Texting question: "don't email me" asks the texting question again; "Sounds good" confirms a time.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "consent");
  await say(page, "Please don't email me");
  await say(page, "no email please");
  assert(/tap one of the options/.test(await last(page)), "a typed answer to the buttons is never guessed at");
  await tap(page, "Just no email", 2);
  assert(/Can we text you/.test(await last(page)), "the texting question is asked again");
  await tap(page, "Calls only, please");
  await say(page, "Can you call me at 3?");
  await say(page, "Sounds good");
  assert(posted.length === 1 && posted[0].smsConsent === false && /at 3/.test(posted[0].callTime) && /no email/.test(posted[0].contactLimits), "'Sounds good' confirms the time; no consent and no email recorded correctly");
  await ctx.close();
}
{
  // Spanish names keep their accents; "take my house" questions get the right FAQ.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/es.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await tap(page, "Hablar con una persona", 0);
  await page.waitForSelector(".pac-card");
  await say(page, "Me llamo María García, 602-555-0143");
  await tap(page, "Sí, textos está bien");
  await tap(page, "Lo antes posible");
  assert(posted.length === 1 && posted[0].name === "María García", `name kept with accents: ${posted[0] && posted[0].name}`);
  await page.goto(`${SITE}/index.html`);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "Can you take my house as-is?", 2);
  assert(/as-is in any condition/.test(await last(page, 2)), "'take my house as-is' gets the condition answer, not foreclosure");
  await ctx.close();
}

{
  // Phone numbers in any common format; typed replies to the buttons keep the seller's words with the lead.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "phone");
  await say(page, "Don't text me, call me at 602 - 555 - 0143");
  assert(/which one do you mean/.test(await last(page)), "asks which they mean");
  await say(page, "no texts");
  await say(page, "I said no texts");
  assert(/include your words/.test(await last(page, 2)) || /include your words/.test(await last(page)), "after a second typed reply, their words go with the lead");
  await say(page, "602 - 555 - 0143");
  await tap(page, "Yes, texting is fine");
  await tap(page, "As soon as possible");
  assert(posted.length === 1 && posted[0].phone === "(602) 555-0143" && /no texts/.test(posted[0].sellerContactWords), `spaced-out number accepted, words kept: ${posted[0] && posted[0].sellerContactWords}`);
  await ctx.close();
}

{
  // Spanish usted forms after a lead; "todo" typed at the buttons is never guessed.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/es.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "Dejen de llamarme");
  await say(page, "todo");
  assert(/elija una de las opciones/.test(await last(page)) && posted.length === 0, "'todo' at the buttons gets 'please tap one'");
  await tap(page, "No me contacten más");
  await say(page, "602-555-0143");
  assert(posted.length === 1 && /^DO NOT CONTACT/.test(posted[0]._subject), "then the stop goes out");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${SITE}/es.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await tap(page, "Hablar con una persona", 0);
  await page.waitForSelector(".pac-card");
  await say(page, "Ana Ruiz 813 555 0123");
  await tap(page, "Sí, textos está bien");
  await tap(page, "Lo antes posible");
  await say(page, "No me llame más");
  assert(posted.length === 3 && /^CONTACT REQUEST/.test(posted[2]._subject) && /No me llame/.test(posted[2].note), "'No me llame más' after a lead reaches the team");
  await ctx.close();
}

{
  // AI mode goes down right after a lead: the message that hit the outage still reaches the team.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:8899" });
  let calls = 0;
  await page.route("http://127.0.0.1:8899/health", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true,"ai":true}' }));
  await page.route("http://127.0.0.1:8899/chat", (r) => {
    calls++;
    if (calls === 1) {
      return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ reply: "Saved.", history: [], sig: "", ui: { saved: true }, leads: [{ type: "lead", name: "Dana Lee", phone: "(602) 555-0177", email: "", address: "1 Main", delivered: true }] }) });
    }
    return r.fulfill({ status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"error":"ai_unavailable"}' });
  });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "Call me ASAP, Dana Lee 602-555-0177, 1 Main St Mesa");
  await say(page, "Actually please call my husband Tom instead, 480-555-0199");
  assert(posted.length === 1 && /^MESSAGE FROM SELLER/.test(posted[0]._subject) && /husband Tom/.test(posted[0].note), "the message typed when the AI went down is forwarded");
  // "Talk to a person" after a lead keeps forwarding.
  await say(page, "Talk to a person");
  await say(page, "Forget it, I sold it to my neighbor");
  assert(posted.length === 2 && /sold it to my neighbor/.test(posted[1].note), "after 'Talk to a person', later messages still reach the team");
  await ctx.close();
}
{
  // A forward that fails asks the seller to send their message another way (not a removal).
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await guidedTo(page, "time");
  await tap(page, "As soon as possible");
  await page.unroute("https://formsubmit.co/**");
  await page.route("https://formsubmit.co/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"success":"false"}' }));
  await say(page, "Do you buy condos too?");
  assert(/with your message so the team sees it/.test(await last(page)) && !/to remove/.test(await last(page)), "a failed forward doesn't talk about removal");
  await ctx.close();
}
{
  // "Just no calls" on the first message: the stop goes out, and they can still get an offer by text.
  const { ctx, page, posted } = await pageWith({ endpoint: "http://127.0.0.1:9" });
  await page.goto(`${SITE}/index.html`);
  await page.click(".pac-launcher");
  await waitBot(page, 1);
  await say(page, "I want to sell my house but please don't call me, text only");
  await tap(page, "Just no calls");
  await say(page, "602-555-0143", 2);
  assert(posted.length === 1 && /^DO NOT CALL/.test(posted[0]._subject) && /address of the property/.test(await last(page)), "DO NOT CALL sent, then the offer flow continues");
  await say(page, "9 Pine St, Mesa AZ");
  await tap(page, "Move-in ready");
  await tap(page, "As soon as possible");
  await say(page, "Dana Lee");
  await say(page, "602-555-0143");
  await tap(page, "Yes, texting is fine");
  assert(posted.length === 2 && /no calls/.test(posted[1].contactLimits) && /No calls/.test(posted[1].callTime), "the lead goes out marked no calls, without a call time");
  await ctx.close();
}

await browser.close();
console.log("ALL BROWSER CHECKS PASSED");
