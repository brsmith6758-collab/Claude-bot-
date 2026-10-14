// Slow check (about 45 s, so not part of `npm test`): with the real Anthropic SDK against a
// local fake API, a turn that already booked a call must return within the turn budget even
// when the next model call hangs or gets a 429 with a long retry-after, and must keep the booking.
// Run: node --import ./test/register-stubs.mjs test/deadline.slow.mjs
import http from "node:http";
import assert from "node:assert/strict";
import { runTurn } from "../src/agent.js";
import { fakeKV } from "./fakes.mjs";

const NOW = Date.UTC(2026, 9, 14, 15, 10);
const context = { page: "/", lang: "en", localTime: "Wed Oct 14 2026 8:10 AM", timeZone: "America/Phoenix" };
const lead = {
  name: "Dana Lee", phone: "602-555-0143", email: "", property_address: "123 Main St", city: "Mesa", state: "AZ", zip: "85201",
  sms_consent: true, property_type: "", condition: "", occupancy: "", timeline: "", reason: "", asking_price: "", notes: "",
};
const body = (content, stop) => JSON.stringify({
  id: "msg_x", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason: stop, stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
});
const bookNow = (res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body([{ type: "tool_use", id: "toolu_1", name: "book_call", input: { slot_id: "2026-10-14T16:30:00.000Z", ...lead } }], "tool_use"));
};
const hang = () => {};
const rateLimited = (secs) => (res) => {
  res.writeHead(429, { "content-type": "application/json", "retry-after": String(secs) });
  res.end(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }));
};

async function scenario(name, plan) {
  let n = 0;
  const server = http.createServer((req, res) => { req.resume(); req.on("end", () => plan[n++](res)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const env = { ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`, LEADS: fakeKV() };
  const t0 = Date.now();
  try {
    const out = await runTurn({ env, history: [], message: "book me", context, nowMs: NOW });
    const secs = (Date.now() - t0) / 1000;
    assert.ok(secs < 47, `${name}: returned after ${secs.toFixed(1)} s, past the 45 s budget`);
    assert.equal(out.leads.length, 1, `${name}: the booking is reported`);
    assert.ok(out.ui.booking, `${name}: the booking card is shown`);
    console.log(`ok - ${name}: returned after ${secs.toFixed(1)} s with the booking`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

await Promise.all([
  scenario("next call hangs", [bookNow, hang, hang]),
  scenario("next call gets 429 retry-after 50", [bookNow, rateLimited(50), hang]),
]);
console.log("DEADLINE CHECKS PASSED");
