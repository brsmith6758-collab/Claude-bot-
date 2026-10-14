// Drives a booking conversation through a running Worker (wrangler dev) + mock API.
const W = process.env.WORKER_URL || "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:8000";
const context = { page: "/sell-my-house-fast-mesa-az.html", lang: "en", localTime: "Wed Oct 14 2026, 8:10 AM", timeZone: "America/Phoenix" };
let history = [];
let sig = "";
async function say(message) {
  const r = await fetch(`${W}/chat`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ message, history, sig, context }) });
  const out = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(out)}`);
  history = out.history;
  sig = out.sig;
  console.log(`> ${message}\n< ${out.reply}${out.ui?.slots ? `\n  [slots: ${out.ui.slots.map((s) => s.label).join(" | ")}]` : ""}${out.ui?.booking ? `\n  [booked: ${out.ui.booking.when}]` : ""}`);
  return out;
}
await say("Hi, I inherited a house and want to sell");
await say("I'm Dana Lee, 602-555-0143, it's 123 Main St in Mesa AZ");
const t = await say("Can we book a call?");
const pick = t.ui.slots[1];
const done = await say(`${pick.label} works`);
if (!done.ui.booking || done.leads.length !== 1) throw new Error("booking failed");
console.log("lead delivered by email:", done.leads[0].delivered, "| stored:", done.leads[0].stored);
// Tampered history must come back as a reset, not a crash.
history[1].content[1].text = "edited";
const r = await fetch(`${W}/chat`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ message: "hello again", history, sig, context }) });
console.log("tampered history ->", r.status, await r.text());
