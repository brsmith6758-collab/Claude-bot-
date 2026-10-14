// Prime Acre Capital website assistant: Cloudflare Worker entry point.
//   GET  /health  -> { ok, ai }        the chat bubble checks this before using AI mode
//   POST /chat    -> one conversation turn (see agent.js)
import Anthropic from "@anthropic-ai/sdk";
import { runTurn, HistoryError } from "./agent.js";
import { clientKey } from "./net.js";

const DEFAULT_ORIGINS = [
  "https://primeacrehomebuyers.com",
  "https://www.primeacrehomebuyers.com",
  "http://primeacrehomebuyers.com",
  "http://www.primeacrehomebuyers.com",
  "https://brsmith6758-collab.github.io",
];
const MAX_BODY_BYTES = 200_000;
const MAX_MESSAGE_CHARS = 1500;

function allowedOrigins(env) {
  const list = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  return new Set(list);
}

function originOk(origin, env) {
  if (!origin) return false;
  if (allowedOrigins(env).has(origin)) return true;
  return env.ALLOW_LOCALHOST === "true" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function cors(origin, env) {
  const h = { Vary: "Origin" };
  if (originOk(origin, env)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origin, env) },
  });
}

// Fallback limiter when no Rate Limiting binding is configured (per isolate, best effort).
const recent = new Map();
function localLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.delete(key);
  recent.set(key, hits); // re-insert so the Map stays in least-recently-used order
  if (recent.size > 5000) {
    let drop = recent.size - 4000;
    for (const k of recent.keys()) { if (drop-- <= 0) break; recent.delete(k); }
  }
  return hits.length <= limit;
}

async function bindingLimit(binding, key) {
  if (!binding || typeof binding.limit !== "function") return null;
  try {
    const { success } = await binding.limit({ key });
    return success;
  } catch (e) {
    console.error("rate limiter failed", e && e.message);
    return null;
  }
}

async function allowRequest(env, key) {
  const perVisitor = await bindingLimit(env.CHAT_LIMITER, key);
  if (perVisitor === false) return false;
  if (perVisitor === null && !localLimit(key, 15)) return false;
  const overall = await bindingLimit(env.GLOBAL_LIMITER, "all");
  if (overall === false) return false;
  if (overall === null && !localLimit("__all__", 120)) return false;
  return true;
}

/** Read at most MAX_BODY_BYTES of JSON, counting real bytes, with or without Content-Length. */
async function readJson(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

// A 400 from the API that a fresh history can fix (thinking signature, tool pairing).
// Anything else (billing, configuration) means the AI is unavailable right now.
function historyProblem(e) {
  return /signature|thinking|tool_use|tool_result|messages\.\d+/i.test(String((e && e.message) || ""));
}

async function handleChat(request, env, origin) {
  if (!originOk(origin, env)) return json({ error: "forbidden" }, 403, origin, env);
  const key = clientKey(request.headers.get("CF-Connecting-IP"));
  if (!(await allowRequest(env, key))) return json({ error: "slow_down" }, 429, origin, env);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "ai_unavailable" }, 503, origin, env);

  const body = await readJson(request);
  if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400, origin, env);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return json({ error: "bad_message" }, 400, origin, env);
  const context = body.context && typeof body.context === "object" ? body.context : {};

  try {
    const out = await runTurn({ env, history: body.history || [], sig: body.sig, message, context, clientKey: key });
    return json(out, 200, origin, env);
  } catch (e) {
    if (e instanceof HistoryError) {
      console.warn("rejected history:", e.message);
      return e.code === "too_long" ? json({ error: "too_long" }, 413, origin, env) : json({ error: "reset" }, 409, origin, env);
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error("bad request from API", e.message);
      return historyProblem(e) ? json({ error: "reset" }, 409, origin, env) : json({ error: "ai_unavailable" }, 503, origin, env);
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("API key problem", e.message);
      return json({ error: "ai_unavailable" }, 503, origin, env);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("API error", e.status, e.message);
      return json({ error: "busy" }, 503, origin, env);
    }
    console.error("chat failed", e && e.stack);
    return json({ error: "server_error" }, 500, origin, env);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: originOk(origin, env) ? 204 : 403, headers: cors(origin, env) });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, ai: Boolean(env.ANTHROPIC_API_KEY) }, 200, origin, env);
    }
    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env, origin);
    }
    return json({ error: "not_found" }, 404, origin, env);
  },
};
