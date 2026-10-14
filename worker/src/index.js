// Prime Acre Capital website assistant: Cloudflare Worker entry point.
//   GET  /health  -> { ok, ai }        the chat bubble checks this before using AI mode
//   POST /chat    -> one conversation turn (see agent.js)
import Anthropic from "@anthropic-ai/sdk";
import { runTurn, HistoryError } from "./agent.js";

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

// Best-effort limiter for when no Rate Limiting binding is configured (per isolate only).
const recent = new Map();
function localLimit(key, limit = 15, windowMs = 60_000) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length <= limit;
}

async function allowRequest(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.CHAT_LIMITER && typeof env.CHAT_LIMITER.limit === "function") {
    try {
      const { success } = await env.CHAT_LIMITER.limit({ key: ip });
      return success;
    } catch (e) {
      console.error("rate limiter failed", e && e.message);
    }
  }
  return localLimit(ip);
}

async function readJson(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleChat(request, env, origin) {
  if (!originOk(origin, env)) return json({ error: "forbidden" }, 403, origin, env);
  if (!(await allowRequest(request, env))) return json({ error: "slow_down" }, 429, origin, env);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "ai_unavailable" }, 503, origin, env);

  const body = await readJson(request);
  if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400, origin, env);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return json({ error: "bad_message" }, 400, origin, env);
  const context = body.context && typeof body.context === "object" ? body.context : {};

  try {
    const out = await runTurn({ env, history: body.history || [], message, context });
    return json(out, 200, origin, env);
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) {
      // Usually a history the API rejects (edited or corrupted). The browser starts a fresh history.
      console.error("bad request from API", e.message);
      return json({ error: "reset" }, 409, origin, env);
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("API key problem", e.message);
      return json({ error: "ai_unavailable" }, 503, origin, env);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "busy" }, 503, origin, env);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("API error", e.status, e.message);
      return json({ error: "busy" }, 503, origin, env);
    }
    if (e instanceof HistoryError) {
      console.warn("rejected history:", e.message);
      return json({ error: "reset" }, 409, origin, env);
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
