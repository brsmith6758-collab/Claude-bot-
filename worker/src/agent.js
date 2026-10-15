// One chat turn: append the seller's message, run Claude with our tools until it
// answers, and return the reply plus the updated (append-only) history.
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, TOOLS, contextLine, cleanPage } from "./prompt.js";
import {
  scheduleConfig, openSlots, pickSlots, slotLabel, isValidTimeZone, calendarLink, stateTimeZone, zonedParts, ymd,
} from "./slots.js";
import {
  normalizeLead, normalizeStop, storeLead, storeStop, emailLead, emailStop, bookedSlots, isSlotTaken, reserveSlot,
  phoneBooking, bookingsToday, countBooking, markBooked, leadPlace,
} from "./leads.js";

const MAX_MODEL_CALLS = 5;
const MAX_TOKENS = 16000;          // room for thinking plus the reply (non-streaming default)
const TURN_BUDGET_MS = 45000;      // the browser gives up at 75 s
const MAX_HISTORY_MESSAGES = 100;
const MAX_HISTORY_CHARS = 150000;
const MAX_BOOKINGS_PER_CONVERSATION = 2;
const MAX_BOOKINGS_PER_DAY = 3;    // per visitor network, when KV is bound
const MAX_STOPS_PER_CONVERSATION = 8; // distinct contact+channel pairs; more than that is abuse, not a seller
const MAX_STOPS_PER_DAY = 5;       // do-not-contact requests, per visitor network
const MAX_TRANSCRIPT_CHARS = 6000;

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

/** A history the Worker will not use. `code` is "reset" (start over) or "too_long". */
export class HistoryError extends Error {
  constructor(message, code = "reset") {
    super(message);
    this.code = code;
  }
}

/**
 * The browser holds the conversation and sends it back each turn, signed (see
 * signHistory). Besides the signature, accept only shapes this Worker produces:
 * user/assistant turns with text, tool and thinking blocks. No system turns,
 * images, or documents. Returns the array unchanged.
 */
export function checkHistory(history) {
  const fail = (why, code) => { throw new HistoryError(why, code); };
  if (!Array.isArray(history)) fail("history must be an array");
  if (history.length > MAX_HISTORY_MESSAGES) fail("conversation too long", "too_long");
  if (JSON.stringify(history).length > MAX_HISTORY_CHARS) fail("conversation too long", "too_long");
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

// The history is signed with a key derived from the Worker's secret, so a visitor
// cannot send the model forged turns or fake tool results.
const keyCache = new Map();
async function historyKey(env) {
  const secret = env.HISTORY_SECRET || env.ANTHROPIC_API_KEY || "";
  if (!keyCache.has(secret)) {
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`prime-acre-chat-history-v1:${secret}`));
    keyCache.set(secret, await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  }
  return keyCache.get(secret);
}

function b64url(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signHistory(env, history) {
  const key = await historyKey(env);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(history))));
}

export async function verifyHistory(env, history, sig) {
  if (!Array.isArray(history) || history.length === 0) return true;
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false;
  const bin = atob(sig.replace(/-/g, "+").replace(/_/g, "/") + "=");
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const key = await historyKey(env);
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(JSON.stringify(history)));
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

function mergeStopped(a, b) {
  if (!a || !b) return a || b;
  const set = new Set([...a.split("+"), ...b.split("+")]);
  if (set.has("all") || ["calls", "texts", "email"].every((c) => set.has(c))) return "all";
  return ["calls", "texts", "email"].filter((c) => set.has(c)).join("+");
}

/** Keys for the contacts and channel a stop request covers: "p:<digits>:texts", "e:<email>:all". */
function stopKeys(notice) {
  const keys = [];
  const phone = notice.phone || notice.phoneAsGiven;
  if (phone) keys.push(`p:${phone.replace(/\D/g, "")}:${notice.channels}`);
  if (notice.email) keys.push(`e:${notice.email.toLowerCase()}:${notice.channels}`);
  return keys;
}

/**
 * Successful tool results in this conversation: bookings/callbacks, stop requests,
 * and the contacts already stopped (so a repeat is recognised, and a new one is not).
 */
function priorActions(history) {
  const n = { bookings: 0, stops: 0, stopped: new Set(), attempted: new Set() };
  const stopInputs = new Map();
  for (const m of history) {
    if (m.role === "assistant") {
      for (const b of m.content) if (b.type === "tool_use" && b.name === "do_not_contact") stopInputs.set(b.id, b.input || {});
      continue;
    }
    for (const b of m.content) {
      if (b.type !== "tool_result" || b.is_error) continue;
      try {
        const r = JSON.parse(b.content);
        if (r.booked === true || r.saved === true) n.bookings++;
        if (r.recorded === true && !r.duplicate) {
          n.stops++;
          // Only a stop the Worker emailed itself is known to have reached the team. Otherwise
          // a repeat is sent again, so the browser gets another chance to deliver it.
          const { notice } = normalizeStop(stopInputs.get(b.tool_use_id) || {});
          if (notice) for (const k of stopKeys(notice)) n.attempted.add(k);
          if (notice && r.team_notified === true) for (const k of stopKeys(notice)) n.stopped.add(k);
        }
      } catch { /* not ours */ }
    }
  }
  return n;
}

const CONTEXT_PREFIX = /^\[Site context[^\]\n]*\]\n?/;

/**
 * The conversation as plain text, newest part kept: the team's record of what
 * the seller said, including their answer to the texting question.
 */
export function transcriptText(messages, max = MAX_TRANSCRIPT_CHARS) {
  const lines = [];
  for (const m of messages) {
    for (const b of m.content || []) {
      if (b.type !== "text") continue;
      const t = (m.role === "user" ? b.text.replace(CONTEXT_PREFIX, "") : b.text).trim();
      if (t) lines.push(`${m.role === "user" ? "Seller" : "Assistant"}: ${t}`);
    }
  }
  const out = lines.join("\n");
  return out.length > max ? `...${out.slice(out.length - max)}` : out;
}

// The disclosure the prompt requires in the texting question, in either language.
const CONSENT_QUESTION = /(msg|messag\w*)\s*(&|and|\/)\s*data|mensajes y (de )?datos|reply stop|responda stop/i;

/**
 * The texting question and the seller's reply, kept apart from the transcript so
 * the transcript's length cap can never drop it: the last assistant message with
 * the texting disclosure that the seller has answered, and that answer.
 */
export function consentExchange(messages) {
  const texts = [];
  for (const m of messages) {
    const t = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    if (t) texts.push({ role: m.role, text: m.role === "user" ? t.replace(CONTEXT_PREFIX, "") : t });
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    if (texts[i].role !== "assistant" || !CONSENT_QUESTION.test(texts[i].text) || !texts[i].text.includes("?")) continue;
    const reply = texts.slice(i + 1).find((x) => x.role === "user");
    if (reply) return { question: texts[i].text.slice(0, 600), answer: reply.text.slice(0, 600) };
  }
  return null;
}

function textingRecord(messages, lead) {
  if (!lead.phone) return null;
  const x = consentExchange(messages);
  return { agreed: lead.smsConsent, question: x ? x.question : "", answer: x ? x.answer : "" };
}

/** Await a storage check; on error log it, call onFail (if given), and use the fallback value. */
async function soft(promise, fallback, what, onFail) {
  try {
    return await promise;
  } catch (e) {
    console.error(`${what} failed`, e && e.message);
    if (onFail) onFail();
    return fallback;
  }
}

// ---------------------------------------------------------------- tools

function validDay(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : "";
}

async function runTool(name, input, ctx) {
  const { env, biz, sellerTz, lang, nowMs } = ctx;
  const cfg = biz.cfg;

  if (name === "get_call_times") {
    const booked = new Set(await bookedSlots(env, nowMs)); // never throws
    const today = zonedParts(nowMs, sellerTz);
    const sellerToday = ymd(today);
    const day = validDay(input.day);
    const part = ["morning", "afternoon", "evening"].includes(input.part_of_day) ? input.part_of_day : "any";
    let picked;
    let note;
    let last;
    // The index is only a hint; the per-slot keys are the truth. Check the few times
    // about to be offered (a handful of KV reads), and pick again if any are taken.
    const stale = [];
    const free = new Set(); // times already checked and open
    for (let round = 0; round < 8; round++) {
      const all = openSlots(nowMs, cfg, booked);
      last = all.length ? ymd(zonedParts(all[all.length - 1], sellerTz)) : sellerToday;
      picked = pickSlots(all, { sellerTz, day, partOfDay: part });
      note = "";
      if (!picked.length && (day || part !== "any")) {
        note = day && day < sellerToday
          ? "That date is in the past. These are the soonest open times instead."
          : day && day > last
            ? `Calls can only be booked through ${last}. These are the soonest open times instead.`
            : "No open times match that request. These are the soonest open times instead.";
        picked = pickSlots(all, { sellerTz });
      }
      if (!picked.length) {
        // Only times outside the seller's usual waking hours remain (e.g. far time zones).
        picked = pickSlots(all, { sellerTz, sellerHours: null });
        if (picked.length) note = "These are the only open times, and they are early or late in the seller's time zone; mention that.";
      }
      const unknown = picked.map((ms) => new Date(ms).toISOString()).filter((iso) => !free.has(iso));
      if (!unknown.length) break;
      const taken = await Promise.all(unknown.map((iso) => soft(isSlotTaken(env, iso), false, "isSlotTaken")));
      unknown.forEach((iso, i) => { if (taken[i]) { booked.add(iso); stale.push(iso); } else free.add(iso); });
      if (!taken.some(Boolean)) break;
    }
    // Only times checked and found open are ever offered (at most ~30 KV reads, even after a big backlog).
    picked = picked.filter((ms) => free.has(new Date(ms).toISOString()));
    if (stale.length) await soft(markBooked(env, stale, nowMs), undefined, "markBooked"); // heal the index, one write
    const available = picked.map((ms) => ({ slot_id: new Date(ms).toISOString(), label: slotLabel(ms, sellerTz, lang) }));
    if (!available.length) {
      note = stale.length
        ? "Couldn't confirm open times right now. Offer to save a callback request instead."
        : "No open times in the next week. Offer to save a callback request instead.";
    }
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: sellerTz, weekday: "long" }).format(new Date(nowMs));
    return {
      content: {
        seller_today: `${weekday} ${sellerToday}`,
        bookable_through: last,
        seller_time_zone: sellerTz,
        business_hours: biz.hoursLabel,
        available,
        ...(note ? { note } : {}),
      },
      ui: available.length ? { slots: available } : undefined,
    };
  }

  if (name === "book_call" || name === "save_lead") {
    // Limits enforced in code, whatever the conversation says.
    if (ctx.bookingsThisResponse >= 1) {
      return { content: { error: "Only one booking or callback request can be made at a time. Confirm this one with the seller first." }, isError: true };
    }
    if (ctx.prior.bookings + ctx.bookingsThisTurn >= MAX_BOOKINGS_PER_CONVERSATION) {
      return { content: { error: `This conversation already has a booking. Tell the seller the team has their details, and that they can call or text ${biz.phone} to change anything.` }, isError: true };
    }
    // Storage checks fail open: a KV error must never cost a seller their booking.
    if ((await soft(bookingsToday(env, ctx.clientKey, nowMs), 0, "bookingsToday")) >= MAX_BOOKINGS_PER_DAY) {
      return { content: { error: `No more bookings can be made from this connection today. Ask the seller to call or text ${biz.phone}.` }, isError: true };
    }
    ctx.bookingsThisResponse++;

    const { lead, error } = normalizeLead(input, { kind: name === "book_call" ? "book" : "save" });
    if (error) { ctx.bookingsThisResponse--; return { content: { error }, isError: true }; }

    let appointment;
    let slotTrouble = false; // the check for this very slot failed: don't call the time locked in
    if (name === "book_call") {
      const ms = Date.parse(String(input.slot_id || ""));
      const iso = Number.isFinite(ms) ? new Date(ms).toISOString() : "";
      const legit = iso && openSlots(nowMs, cfg).includes(ms);
      if (!legit) {
        ctx.bookingsThisResponse--;
        return { content: { error: "That slot_id is not an open time. Call get_call_times and use one of its slot_id values." }, isError: true };
      }
      const existing = await soft(phoneBooking(env, lead.phone, nowMs), null, "phoneBooking");
      if (existing) {
        ctx.bookingsThisResponse--;
        const when = slotLabel(Date.parse(existing.start), sellerTz, lang);
        return { content: { error: `This phone number already has a call booked for ${when}. Tell the seller, and that they can call or text ${biz.phone} to change it.` }, isError: true };
      }
      if (await soft(isSlotTaken(env, iso), false, "isSlotTaken", () => { slotTrouble = true; })) {
        ctx.bookingsThisResponse--;
        return { content: { error: "That time was just taken. Offer other times from get_call_times." }, isError: true };
      }
      appointment = {
        start: iso,
        minutes: cfg.slotMinutes,
        sellerLabel: slotLabel(ms, sellerTz, lang),
        sellerTimeZone: sellerTz,
        ownerLabel: slotLabel(ms, cfg.tz, "en"),
        ownerCalendarUrl: calendarLink({
          startMs: ms,
          minutes: cfg.slotMinutes,
          title: leadPlace(lead) ? `Seller call: ${lead.name} (${leadPlace(lead)})` : `Seller call: ${lead.name}`,
          details: [`${lead.name} ${lead.phone}`, leadPlace(lead), "Booked through the website chat."].filter(Boolean).join("\n"),
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
      try {
        const r = await reserveSlot(env, iso, ms, { name: lead.name, phone: lead.phone }, nowMs);
        if (r === "taken") {
          ctx.bookingsThisResponse--;
          return { content: { error: "That time was just taken. Offer other times from get_call_times." }, isError: true };
        }
        appointment.reserved = r === "reserved" && !slotTrouble;
      } catch (e) {
        console.error("reserveSlot failed", e && e.message);
        appointment.reserved = false; // the lead still goes out; the owner confirms the time
      }
    }

    const full = {
      ...lead,
      appointment,
      market: lead.state || "",
      source: "website-chat",
      page: ctx.page,
      lang,
      submittedAt: new Date(nowMs).toISOString(),
      transcript: transcriptText(ctx.messages),
      textingConsent: textingRecord(ctx.messages, lead),
    };
    let stored = false;
    let emailed = false;
    try { stored = await storeLead(env, full); } catch (e) { console.error("storeLead failed", e && e.message); }
    try { emailed = await emailLead(env, full); } catch (e) { console.error("emailLead failed", e && e.message); }
    try { await countBooking(env, ctx.clientKey, nowMs); } catch (e) { console.error("countBooking failed", e && e.message); }
    ctx.bookingsThisTurn++;

    const confirmed = !appointment || appointment.reserved;
    const content = appointment
      ? {
        booked: true,
        when: appointment.sellerLabel,
        time_confirmed: confirmed,
        call_length_minutes: cfg.slotMinutes,
        what_next: confirmed
          ? "The team reviews the property before the call; a written cash offer typically follows within 24 hours of the review."
          : "The time is requested but could not be locked in, so the team will confirm it with the seller by phone. Tell the seller exactly that; don't call it confirmed.",
      }
      : { saved: true, what_next: `The team will ${lead.phone ? "reach out" : "follow up by email"} during business hours (${biz.hoursLabel}).` };
    return {
      content,
      lead: { ...full, delivered: emailed, stored },
      ui: appointment
        ? { booking: { when: appointment.sellerLabel, calendarUrl: appointment.sellerCalendarUrl, requested: !confirmed } }
        : { saved: true },
    };
  }

  if (name === "do_not_contact") {
    const { notice, error } = normalizeStop(input);
    if (error) {
      return { content: { error: `${error} If they give the same details again, ask them to email ${biz.email} so the team can remove them.` }, isError: true };
    }
    // A repeat of a stop already recorded (same contact, same or wider channel) is confirmed
    // without a second notice. Anything new is always recorded and sent: never report
    // "recorded" for a request the team did not get.
    const keys = stopKeys(notice);
    const covered = (k) => ctx.stopped.has(k) || ctx.stopped.has(k.replace(/:[a-z]+$/, ":all"));
    if (keys.every(covered)) {
      return { content: { recorded: true, duplicate: true, note: "Already recorded in this conversation. Just confirm it to the seller." } };
    }
    // The cap counts distinct contacts and channels, so resending one that didn't get through never uses it up.
    const fresh = keys.filter((k) => !ctx.attempted.has(k));
    if (fresh.length && (ctx.attempted.size + fresh.length > MAX_STOPS_PER_CONVERSATION
      || (await soft(bookingsToday(env, ctx.clientKey, nowMs, "dn"), 0, "stop count")) >= MAX_STOPS_PER_DAY)) {
      return { content: { error: `Too many requests from this chat. Ask the seller to email ${biz.email} with the number or email to remove, and say the team will take care of it.` }, isError: true };
    }
    ctx.stopsThisTurn++;
    for (const k of keys) ctx.attempted.add(k);
    const full = {
      ...notice,
      type: "do_not_contact",
      source: "website-chat",
      page: ctx.page,
      lang,
      submittedAt: new Date(nowMs).toISOString(),
      transcript: transcriptText(ctx.messages),
    };
    let stored = false;
    let emailed = false;
    try { stored = await storeStop(env, full); } catch (e) { console.error("storeStop failed", e && e.message); }
    try { emailed = await emailStop(env, full); } catch (e) { console.error("emailStop failed", e && e.message); }
    if (fresh.length) {
      try { await countBooking(env, ctx.clientKey, nowMs, "dn"); } catch (e) { console.error("count stop failed", e && e.message); }
    }
    if (emailed) for (const k of keys) ctx.stopped.add(k);
    const promise = {
      all: "we won't call, text, or email them again",
      calls: "we won't call them again",
      texts: "we won't text them again",
      email: "we won't email them again",
    }[notice.channels];
    return {
      content: {
        recorded: true,
        team_notified: emailed,
        stopped: notice.channels,
        what_next: notice.phoneAsGiven
          ? `Confirm in one sentence that ${promise}, and ask them to double-check the number "${notice.phoneAsGiven}"; if it was mistyped, record the right one too.`
          : `Confirm in one sentence that ${promise}. Don't add anything else.`,
      },
      lead: { ...full, delivered: emailed, stored },
      ui: { stopped: notice.channels },
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
    max_tokens: MAX_TOKENS,
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
 * Run one turn. Returns { reply, history, sig, ui, leads, refused }.
 * Throws HistoryError for a history it will not use, and Anthropic.APIError
 * subclasses for API failures that happened before anything was booked.
 */
export async function runTurn({
  env, history, sig, message, context, clientKey = "", nowMs = Date.now(), client, budgetMs = TURN_BUDGET_MS,
}) {
  const startedAt = Date.now();
  const biz = businessInfo(env);
  const lang = context.lang === "es" ? "es" : "en";
  const sellerTz = sellerTimeZone(context, biz);
  const page = cleanPage(context.page);

  const base = checkHistory(history);
  if (!(await verifyHistory(env, base, sig))) throw new HistoryError("history signature does not match");
  // Only the website writes the site-context line; a visitor can't type one.
  const said = String(message).replace(/\[(\s*site context)/gi, "($1");
  const text = base.length === 0
    ? `${contextLine({ page, lang, localTime: context.localTime, timeZone: sellerTz })}\n${said}`
    : said;
  const messages = [...base, { role: "user", content: [{ type: "text", text }] }];
  const ctx = {
    env, biz, sellerTz, lang, page, nowMs, clientKey, messages,
    prior: priorActions(base), bookingsThisTurn: 0, bookingsThisResponse: 0, stopsThisTurn: 0,
  };
  ctx.stopped = new Set(ctx.prior.stopped);
  ctx.attempted = new Set(ctx.prior.attempted);
  const firstNew = base.length;

  const api = client || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  const system = systemPrompt(biz);
  const finish = async (out) => ({ ...out, sig: await signHistory(env, out.history) });

  const ui = {};
  const leads = [];
  let lastStop = "";
  for (let call = 0; call < MAX_MODEL_CALLS; call++) {
    const remaining = budgetMs - (Date.now() - startedAt);
    if (call > 0 && remaining < 8000) { lastStop = "deadline"; break; }

    let response;
    try {
      const left = Math.max(5000, remaining);
      response = await api.beta.messages.create(requestParams(env, system, messages), {
        timeout: Math.min(30000, left),
        maxRetries: left > 35000 ? 1 : 0,
        // One deadline for the attempt, any retry, and any retry-after wait together.
        signal: AbortSignal.timeout(left),
      });
    } catch (e) {
      // A booking already happened this turn: report it rather than lose it.
      if (leads.length) { console.error("model call failed after a booking", e && e.message); lastStop = "error"; break; }
      throw e;
    }
    lastStop = response.stop_reason;
    const u = response.usage || {};
    console.log(JSON.stringify({ evt: "model", model: response.model, stop: lastStop, in: u.input_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, out: u.output_tokens }));

    if (["refusal", "max_tokens", "model_context_window_exceeded"].includes(response.stop_reason)) {
      // Never store a declined or cut-off response. Keep what was booked; otherwise undo the turn.
      if (leads.length) break;
      const reply = response.stop_reason === "refusal" ? refusalText(lang, biz) : fallbackText(lang, biz, {}, lastStop);
      return finish({ reply, history: base, ui: {}, leads: [], refused: response.stop_reason === "refusal" });
    }

    const content = cleanAssistantContent(response.content);
    messages.push({ role: "assistant", content });
    if (response.stop_reason !== "tool_use") break;

    const results = [];
    ctx.bookingsThisResponse = 0;
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      let out;
      try {
        out = await runTool(block.name, block.input || {}, ctx);
      } catch (e) {
        console.error("tool failed", block.name, e && e.message);
        out = { content: { error: "Something went wrong on our side. Offer to save a callback request, or share our phone number." }, isError: true };
      }
      if (out.ui) {
        // Several stops in one reply: confirm exactly the channels stopped ("calls+texts"), or "all".
        const stopped = mergeStopped(ui.stopped, out.ui.stopped);
        Object.assign(ui, out.ui);
        if (stopped) ui.stopped = stopped;
      }
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

  return finish({
    reply: reply || fallbackText(lang, biz, ui, lastStop),
    history: messages,
    ui,
    leads,
    refused: false,
  });
}

function refusalText(lang, biz) {
  return lang === "es"
    ? `Lo siento, no puedo ayudar con eso aquí. Si quiere vender una casa, con gusto le ayudo, o puede llamar o enviar un texto al ${biz.phone}.`
    : `Sorry, I can't help with that here. If you're thinking about selling a house, I'm happy to help, or you can call or text ${biz.phone}.`;
}

function fallbackText(lang, biz, ui, stop) {
  if (ui.booking && ui.booking.requested) {
    return lang === "es"
      ? `Pedí su llamada para ${ui.booking.when}. El equipo le confirmará la hora por teléfono.`
      : `I've requested your call for ${ui.booking.when}. The team will confirm the time with you by phone.`;
  }
  if (ui.booking) {
    return lang === "es" ? `Listo, su llamada quedó para ${ui.booking.when}.` : `You're all set for ${ui.booking.when}.`;
  }
  if (ui.saved) {
    return lang === "es" ? "Listo, el equipo se comunicará con usted pronto." : "Got it. The team will reach out soon.";
  }
  if (ui.stopped) {
    const parts = String(ui.stopped).split("+");
    if (parts.includes("all")) return lang === "es" ? "Listo. No volveremos a contactarle." : "Done. We won't contact you again.";
    const en = { calls: "call", texts: "text", email: "email" };
    const es = { calls: "llamarle", texts: "enviarle mensajes de texto", email: "enviarle correos" };
    return lang === "es"
      ? `Listo. No volveremos a ${parts.map((c) => es[c]).join(" ni a ")}.`
      : `Done. We won't ${parts.map((c) => en[c]).join(" or ")} you again.`;
  }
  console.warn("empty reply", stop);
  return lang === "es"
    ? `Perdón, ¿me lo puede repetir? También puede llamar o enviar un texto al ${biz.phone}.`
    : `Sorry, could you say that again? You can also call or text ${biz.phone}.`;
}
