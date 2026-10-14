// One chat turn: append the seller's message, run Claude with our tools until it
// answers, and return the reply plus the updated (append-only) history.
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, TOOLS, contextLine } from "./prompt.js";
import {
  scheduleConfig, openSlots, pickSlots, slotLabel, isValidTimeZone, calendarLink, stateTimeZone,
} from "./slots.js";
import { normalizeLead, storeLead, emailLead, bookedSlots, isSlotTaken, reserveSlot } from "./leads.js";

const MAX_MODEL_CALLS = 5;

const ZONE_NAMES = {
  "America/Chicago": "Central time",
  "America/New_York": "Eastern time",
  "America/Denver": "Mountain time",
  "America/Phoenix": "Arizona time",
  "America/Los_Angeles": "Pacific time",
};
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}

function hoursLabel(cfg) {
  const d = [...cfg.days].sort((a, b) => a - b);
  const contiguous = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const days = d.length === 7 ? "Every day" : contiguous && d.length > 2
    ? `${DAY_NAMES[d[0] - 1]} to ${DAY_NAMES[d[d.length - 1] - 1]}`
    : d.map((x) => DAY_NAMES[x - 1]).join(", ");
  return `${days}, ${fmtMinutes(cfg.startMin)} to ${fmtMinutes(cfg.endMin)} ${ZONE_NAMES[cfg.tz] || cfg.tz}`;
}

/** Business identity and settings. Every value has a default, so only the API key is required. */
export function businessInfo(env = {}) {
  const cfg = scheduleConfig(env);
  return {
    brand: env.BRAND || "Prime Acre Capital",
    legalName: env.LEGAL_NAME || "Prime Acre Capital LLC",
    domain: env.SITE_DOMAIN || "primeacrehomebuyers.com",
    phone: env.BUSINESS_PHONE || "(773) 937-5416",
    email: env.BUSINESS_EMAIL || "brsmith6758@gmail.com",
    hoursLabel: hoursLabel(cfg),
    cfg,
  };
}

const systemCache = new Map();
function systemPrompt(biz) {
  const key = JSON.stringify([biz.brand, biz.legalName, biz.domain, biz.phone, biz.email, biz.hoursLabel]);
  if (!systemCache.has(key)) systemCache.set(key, buildSystemPrompt(biz));
  return systemCache.get(key);
}

// ---------------------------------------------------------------- history checks

const USER_BLOCKS = new Set(["text", "tool_result"]);
const ASSISTANT_BLOCKS = new Set(["text", "thinking", "redacted_thinking", "tool_use", "fallback"]);

/**
 * The browser holds the conversation and sends it back each turn. Accept only
 * shapes this Worker produces: user/assistant turns with text, tool and thinking
 * blocks. No system turns, images, or documents. Returns the array unchanged.
 */
export class HistoryError extends Error {}

export function checkHistory(history) {
  const fail = (why) => { throw new HistoryError(why); };
  if (!Array.isArray(history)) fail("history must be an array");
  if (history.length > 80) fail("conversation too long");
  history.forEach((msg, i) => {
    if (!msg || typeof msg !== "object") fail(`message ${i} is not an object`);
    if (i === 0 && msg.role !== "user") fail("first message must be from the user");
    const allowed = msg.role === "user" ? USER_BLOCKS : msg.role === "assistant" ? ASSISTANT_BLOCKS : null;
    if (!allowed) fail(`message ${i} has role ${msg.role}`);
    if (!Array.isArray(msg.content)) fail(`message ${i} content must be blocks`);
    for (const b of msg.content) {
      if (!b || !allowed.has(b.type)) fail(`message ${i} has a ${b && b.type} block`);
      if (b.type === "tool_result" && typeof b.content !== "string") fail(`message ${i} tool_result must be text`);
    }
  });
  return history;
}

/**
 * After a server-side fallback the docs say to omit thinking, redacted_thinking
 * and tool_use blocks that come before the last `fallback` block.
 */
export function cleanAssistantContent(content) {
  const last = content.map((b) => b.type).lastIndexOf("fallback");
  if (last < 0) return content;
  return content.filter((b, i) => i > last || b.type === "text");
}

// ---------------------------------------------------------------- tools

function validDay(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : "";
}

async function runTool(name, input, ctx) {
  const { env, biz, sellerTz, lang, nowMs } = ctx;
  const cfg = biz.cfg;

  if (name === "get_call_times") {
    const booked = await bookedSlots(env);
    const all = openSlots(nowMs, cfg, booked);
    const day = validDay(input.day);
    const part = ["morning", "afternoon", "evening"].includes(input.part_of_day) ? input.part_of_day : "any";
    let picked = pickSlots(all, { sellerTz, day, partOfDay: part });
    let note = "";
    if (!picked.length && (day || part !== "any")) {
      note = "No open times match that request. These are the soonest open times instead.";
      picked = pickSlots(all, { sellerTz });
    }
    const available = picked.map((ms) => ({ slot_id: new Date(ms).toISOString(), label: slotLabel(ms, sellerTz, lang) }));
    return {
      content: {
        seller_time_zone: sellerTz,
        business_hours: biz.hoursLabel,
        available,
        ...(note ? { note } : {}),
        ...(available.length ? {} : { note: "No open times in the next week. Offer to save a callback request instead." }),
      },
      ui: available.length ? { slots: available } : undefined,
    };
  }

  if (name === "book_call" || name === "save_lead") {
    const { lead, error } = normalizeLead(input);
    if (error) return { content: { error }, isError: true };

    let appointment;
    if (name === "book_call") {
      const ms = Date.parse(String(input.slot_id || ""));
      const iso = Number.isFinite(ms) ? new Date(ms).toISOString() : "";
      const legit = iso && openSlots(nowMs, cfg).includes(ms);
      if (!legit) {
        return { content: { error: "That slot_id is not an open time. Call get_call_times and use one of its slot_id values." }, isError: true };
      }
      if (await isSlotTaken(env, iso)) {
        return { content: { error: "That time was just taken. Offer other times from get_call_times." }, isError: true };
      }
      const sellerLabel = slotLabel(ms, sellerTz, lang);
      const ownerLabel = slotLabel(ms, cfg.tz, "en");
      appointment = {
        start: iso,
        minutes: cfg.slotMinutes,
        sellerLabel,
        sellerTimeZone: sellerTz,
        ownerLabel,
        ownerCalendarUrl: calendarLink({
          startMs: ms,
          minutes: cfg.slotMinutes,
          title: `Seller call: ${lead.name} (${lead.address})`,
          details: `${lead.name} ${lead.phone}\n${[lead.address, lead.city, lead.state].filter(Boolean).join(", ")}\nBooked through the website chat.`,
        }),
        sellerCalendarUrl: calendarLink({
          startMs: ms,
          minutes: cfg.slotMinutes,
          title: lang === "es" ? `Llamada con ${biz.brand}` : `Call with ${biz.brand}`,
          details: lang === "es"
            ? `Le llamaremos al ${lead.phone} para hablar de su propiedad. Preguntas: ${biz.phone}`
            : `We'll call you at ${lead.phone} about your property. Questions: ${biz.phone}`,
        }),
      };
      await reserveSlot(env, iso, ms, { name: lead.name, phone: lead.phone });
    }

    const full = {
      ...lead,
      appointment,
      market: lead.state || "",
      source: "website-chat",
      page: ctx.page,
      lang,
      submittedAt: new Date(nowMs).toISOString(),
    };
    let stored = false;
    let emailed = false;
    try { stored = await storeLead(env, full); } catch (e) { console.error("storeLead failed", e && e.message); }
    try { emailed = await emailLead(env, full); } catch (e) { console.error("emailLead failed", e && e.message); }

    const content = appointment
      ? { booked: true, when: appointment.sellerLabel, call_length_minutes: cfg.slotMinutes, what_next: "The team reviews the property before the call; a written cash offer typically follows within 24 hours of the review." }
      : { saved: true, what_next: `The team will reach out during business hours (${biz.hoursLabel}).` };
    return {
      content,
      lead: { ...full, delivered: emailed, stored },
      ui: appointment
        ? { booking: { when: appointment.sellerLabel, calendarUrl: appointment.sellerCalendarUrl } }
        : { saved: true },
    };
  }

  return { content: { error: `Unknown tool ${name}` }, isError: true };
}

// ---------------------------------------------------------------- the turn

export function sellerTimeZone(context, biz) {
  if (isValidTimeZone(context.timeZone)) return context.timeZone;
  return stateTimeZone(context.state) || biz.cfg.tz;
}

function requestParams(env, system, messages) {
  const model = env.MODEL || "claude-opus-5-5";
  const effort = ["low", "medium", "high", "xhigh", "max"].includes(env.EFFORT) ? env.EFFORT : "low";
  // Server-side refusal fallback: on by default; Haiku models have no server-side fallback.
  const useFallback = env.FALLBACKS !== "off" && !/haiku/.test(model);
  const betas = ["thinking-binding-controls-2026-08-01"];
  if (useFallback) betas.unshift("server-side-fallback-2026-07-01");
  return {
    model,
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    tool_choice: { type: "auto" },
    messages,
    thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
    output_config: { effort },
    cache_control: { type: "ephemeral" },
    betas,
    ...(useFallback ? { fallbacks: "default" } : {}),
  };
}

/**
 * Run one turn. Returns { reply, history, ui, leads, refused }.
 * Throws Anthropic.APIError subclasses for API failures (the caller maps them).
 */
export async function runTurn({ env, history, message, context, nowMs = Date.now(), client }) {
  const biz = businessInfo(env);
  const lang = context.lang === "es" ? "es" : "en";
  const sellerTz = sellerTimeZone(context, biz);
  const page = String(context.page || "/").slice(0, 200);
  const ctx = { env, biz, sellerTz, lang, page, nowMs };

  const base = checkHistory(history);
  const text = base.length === 0
    ? `${contextLine({ page, lang, localTime: context.localTime, timeZone: sellerTz })}\n${message}`
    : message;
  const messages = [...base, { role: "user", content: [{ type: "text", text }] }];
  const firstNew = base.length;

  const api = client || new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
    timeout: 30000,
    maxRetries: 1,
  });
  const system = systemPrompt(biz);

  const ui = {};
  const leads = [];
  let lastStop = "";
  for (let call = 0; call < MAX_MODEL_CALLS; call++) {
    const response = await api.beta.messages.create(requestParams(env, system, messages));
    lastStop = response.stop_reason;
    const u = response.usage || {};
    console.log(JSON.stringify({ evt: "model", model: response.model, stop: lastStop, in: u.input_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, out: u.output_tokens }));

    if (response.stop_reason === "refusal") {
      if (leads.length) break; // keep what was already booked this turn
      return { reply: refusalText(lang, biz), history: base, ui: {}, leads: [], refused: true };
    }

    const content = cleanAssistantContent(response.content);
    messages.push({ role: "assistant", content });
    if (response.stop_reason !== "tool_use") break;

    const results = [];
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      let out;
      try {
        out = await runTool(block.name, block.input || {}, ctx);
      } catch (e) {
        console.error("tool failed", block.name, e && e.message);
        out = { content: { error: "Something went wrong on our side. Offer to save a callback request, or share our phone number." }, isError: true };
      }
      if (out.ui) Object.assign(ui, out.ui);
      if (out.lead) leads.push(out.lead);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(out.content),
        ...(out.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
  }

  const reply = messages
    .slice(firstNew)
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.content.filter((b) => b.type === "text").map((b) => b.text.trim()))
    .filter(Boolean)
    .join("\n\n");

  return {
    reply: reply || fallbackText(lang, biz, ui, lastStop),
    history: messages,
    ui,
    leads,
    refused: false,
  };
}

function refusalText(lang, biz) {
  return lang === "es"
    ? `Lo siento, no puedo ayudar con eso aquí. Si quiere vender una casa, con gusto le ayudo, o puede llamar o enviar un texto al ${biz.phone}.`
    : `Sorry, I can't help with that here. If you're thinking about selling a house, I'm happy to help, or you can call or text ${biz.phone}.`;
}

function fallbackText(lang, biz, ui, stop) {
  if (ui.booking) {
    return lang === "es" ? `Listo, su llamada quedó para ${ui.booking.when}.` : `You're all set for ${ui.booking.when}.`;
  }
  if (ui.saved) {
    return lang === "es" ? "Listo, el equipo se comunicará con usted pronto." : "Got it. The team will reach out soon.";
  }
  console.warn("empty reply", stop);
  return lang === "es"
    ? `Perdón, ¿me lo puede repetir? También puede llamar o enviar un texto al ${biz.phone}.`
    : `Sorry, could you say that again? You can also call or text ${biz.phone}.`;
}
