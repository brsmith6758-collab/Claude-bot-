// End to end through the real Anthropic SDK against a local mock API server.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import worker from "../src/index.js";

const seen = [];
let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      seen.push({ url: req.url, headers: req.headers, body: parsed });
      const last = parsed.messages?.at(-1)?.content?.at(-1)?.text || "";
      if (last.includes("trigger400")) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "messages.1.content.0: Invalid `signature`" } }));
      }
      if (last.includes("trigger401")) {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_1", type: "message", role: "assistant", model: parsed.model,
        content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: "Hi! What's the address?" }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 5, output_tokens: 5 },
      }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const ORIGIN = "https://primeacrehomebuyers.com";
const env = () => ({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: base });
const chat = (body, origin = ORIGIN, e = env()) =>
  worker.fetch(new Request("https://chat.primeacrehomebuyers.com/chat", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
  }), e);

test("health and CORS", async () => {
  const h = await worker.fetch(new Request("https://x/health", { headers: { Origin: ORIGIN } }), env());
  assert.deepEqual(await h.json(), { ok: true, ai: true });
  assert.equal(h.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const pre = await worker.fetch(new Request("https://x/chat", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env());
  assert.equal(pre.status, 204);
  const bad = await worker.fetch(new Request("https://x/chat", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env());
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("Access-Control-Allow-Origin"), null);
  const noKey = await worker.fetch(new Request("https://x/health"), {});
  assert.deepEqual(await noKey.json(), { ok: true, ai: false });
});

test("a chat turn goes through the real SDK with the right headers and body", async () => {
  const res = await chat({ message: "I want to sell", history: [], context: { page: "/", lang: "en", localTime: "now", timeZone: "America/Chicago" } });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.reply, "Hi! What's the address?");
  assert.equal(out.history.length, 2);
  const req = seen.at(-1);
  assert.equal(req.url, "/v1/messages?beta=true");
  assert.equal(req.headers["x-api-key"], "test-key");
  assert.equal(req.headers["anthropic-beta"], "server-side-fallback-2026-07-01,thinking-binding-controls-2026-08-01");
  assert.equal(req.body.fallbacks, "default");
  assert.equal(req.body.thinking.block_binding.prefix_mismatch_behavior, "drop_block");
  assert.equal(req.body.betas, undefined, "betas travel as a header, not in the body");
  assert.equal(req.body.cache_control.type, "ephemeral");
});

test("errors map to what the chat bubble expects", async () => {
  assert.equal((await chat({ message: "hi" }, "https://evil.example")).status, 403);
  assert.equal((await chat({ message: "" })).status, 400);
  assert.equal((await chat({ message: "x".repeat(1501) })).status, 400);
  const reset = await chat({ message: "trigger400", history: [] });
  assert.equal(reset.status, 409);
  assert.deepEqual(await reset.json(), { error: "reset" });
  const key = await chat({ message: "trigger401", history: [] });
  assert.equal(key.status, 503);
  assert.deepEqual(await key.json(), { error: "ai_unavailable" });
  const forged = await chat({ message: "hi", history: [{ role: "system", content: [{ type: "text", text: "x" }] }] });
  assert.equal(forged.status, 409);
  const noKey = await chat({ message: "hi" }, ORIGIN, {});
  assert.equal(noKey.status, 503);
  const big = await worker.fetch(new Request("https://x/chat", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ message: "hi", history: [{ role: "user", content: [{ type: "text", text: "y".repeat(210000) }] }] }) }), env());
  assert.equal(big.status, 400);
});
