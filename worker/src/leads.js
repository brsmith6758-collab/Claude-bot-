// Lead validation, storage (KV) and email notification (Cloudflare Email Routing).

const MAX_FIELD = 500;

function clip(v, n = MAX_FIELD) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, n);
}

export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10 || /^[01]/.test(ten)) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(raw) {
  const email = clip(raw, 200);
  return EMAIL_RE.test(email) ? email : "";
}

/**
 * Validate and normalize a lead collected by the assistant.
 * kind "book" (a booked call) needs a phone number; kind "save" (a callback or
 * follow-up request) needs a phone number or an email address.
 * Returns { lead } or { error } where error is a short reason the model can act on.
 */
export function normalizeLead(input, { kind = "book" } = {}) {
  const name = clip(input.name, 120);
  const rawPhone = clip(input.phone, 40);
  const phone = normalizePhone(rawPhone);
  const email = cleanEmail(input.email);
  const address = clip(input.property_address, 200);
  const city = clip(input.city, 100);
  const zip = (clip(input.zip, 10).match(/\d{5}/) || [""])[0];
  if (!name) return { error: "Missing the seller's name. Ask for it, then try again." };
  if (!phone) {
    if (kind === "book") {
      return { error: "A booked call needs a valid 10-digit US phone number. Ask the seller to confirm it once; if they'd rather not share one, offer email follow-up with save_lead instead." };
    }
    if (/\d/.test(rawPhone)) {
      return { error: "The phone number is not a valid 10-digit US number. Ask the seller to confirm it once; if they'd rather not share one, send an empty phone with their email." };
    }
    if (!email) {
      return { error: "Needs a phone number or an email address. Ask once; if the seller won't share either, give them our phone number instead and don't ask again." };
    }
  }
  if (kind === "book" && !address && !city && !zip) return { error: "Missing where the property is. Ask for the address, or at least the city or ZIP." };
  const state = clip(input.state, 2).toUpperCase();
  return {
    lead: {
      name,
      phone: phone || "",
      email,
      address,
      city,
      state: /^[A-Z]{2}$/.test(state) ? state : "",
      zip,
      smsConsent: Boolean(phone) && input.sms_consent === true,
      propertyType: clip(input.property_type, 100),
      condition: clip(input.condition),
      occupancy: clip(input.occupancy, 100),
      timeline: clip(input.timeline, 200),
      reason: clip(input.reason, 300),
      askingPrice: clip(input.asking_price, 60),
      notes: clip(input.notes, 1000),
      callbackPreference: clip(input.callback_preference, 200),
    },
  };
}

/** Validate a "stop contacting me" request. Returns { notice } or { error }. */
export function normalizeStop(input) {
  const rawPhone = clip(input.phone, 40);
  const phone = normalizePhone(rawPhone);
  const email = cleanEmail(input.email);
  if (!phone && !email) {
    return {
      error: /\d/.test(rawPhone)
        ? "That phone number is not a valid 10-digit US number. Ask the seller to confirm it once."
        : "Needs the phone number or email address to stop contacting. Ask the seller once which one.",
    };
  }
  const channels = ["all", "calls", "texts", "email"].includes(input.channels) ? input.channels : "all";
  return { notice: { name: clip(input.name, 120), phone: phone || "", email, channels, note: clip(input.note, 500) } };
}

function randomId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Record a do-not-contact request in KV (when bound), keyed by phone and by email. */
export async function storeStop(env, notice) {
  if (!env.LEADS) return false;
  const value = JSON.stringify(notice);
  if (notice.phone) await env.LEADS.put(`dnc:phone:${digitsOf(notice.phone)}`, value);
  if (notice.email) await env.LEADS.put(`dnc:email:${notice.email.toLowerCase()}`, value);
  return true;
}

/** Store the lead in KV (when bound). Keys sort by time: lead:<iso>:<rand>. */
export async function storeLead(env, lead) {
  if (!env.LEADS) return false;
  const key = `lead:${lead.submittedAt}:${randomId()}`;
  await env.LEADS.put(key, JSON.stringify(lead), {
    expirationTtl: 60 * 60 * 24 * 400,
    metadata: { name: lead.name, phone: lead.phone, address: lead.address, appointment: lead.appointment?.start || "" },
  });
  return true;
}

// Upcoming booked slots live in one index key, read at most every 20 seconds per
// isolate. KV list is avoided on purpose: the free plan allows 1,000 lists a day,
// and every "show me times" would use one. The index is a hint for offering
// times; the per-slot key checked in book_call is what guards a booking.
const INDEX_KEY = "slots:index";
let slotCache = { at: 0, set: null, env: null };

/** Reserved call slots, as a Set of ISO strings. Never throws: on a KV error it reuses the last list. */
export async function bookedSlots(env, nowMs = Date.now()) {
  if (!env.LEADS) return new Set();
  if (slotCache.set && slotCache.env === env.LEADS && nowMs - slotCache.at < 20000) return slotCache.set;
  let booked;
  try {
    const list = await env.LEADS.get(INDEX_KEY, { type: "json" });
    booked = new Set(Array.isArray(list) ? list.filter((x) => typeof x === "string") : []);
  } catch (e) {
    console.error("slot index read failed", e && e.message);
    booked = slotCache.set && slotCache.env === env.LEADS ? slotCache.set : new Set();
  }
  slotCache = { at: nowMs, set: booked, env: env.LEADS };
  return booked;
}

async function addToIndex(env, iso, nowMs) {
  const now = new Date(nowMs).toISOString();
  let list = [];
  try {
    const v = await env.LEADS.get(INDEX_KEY, { type: "json" });
    if (Array.isArray(v)) list = v;
  } catch { /* rebuild from this booking */ }
  const next = [...new Set([...list.filter((x) => typeof x === "string" && x > now), iso])].sort().slice(-500);
  await env.LEADS.put(INDEX_KEY, JSON.stringify(next));
}

/** Test hook: forget the cached slot list. */
export function resetSlotCache() {
  slotCache = { at: 0, set: null, env: null };
}

const digitsOf = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

/** The future call already booked for this phone number, if any: { start } or null. */
export async function phoneBooking(env, phone, nowMs) {
  if (!env.LEADS) return null;
  const raw = await env.LEADS.get(`phone:${digitsOf(phone)}`);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Date.parse(v.start) > nowMs ? v : null;
  } catch {
    return null;
  }
}

/**
 * Requests made today from one visitor network. kind "bk" counts bookings and
 * callback requests; "dn" counts do-not-contact requests.
 */
export async function bookingsToday(env, clientKey, nowMs, kind = "bk") {
  if (!env.LEADS || !clientKey) return 0;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return parseInt((await env.LEADS.get(`${kind}:${clientKey}:${day}`)) || "0", 10) || 0;
}

export async function countBooking(env, clientKey, nowMs, kind = "bk") {
  if (!env.LEADS || !clientKey) return;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const n = (await bookingsToday(env, clientKey, nowMs, kind)) + 1;
  await env.LEADS.put(`${kind}:${clientKey}:${day}`, String(n), { expirationTtl: 60 * 60 * 26 });
}

export async function isSlotTaken(env, iso) {
  if (!env.LEADS) return false;
  return (await env.LEADS.get(`slot:${iso}`)) !== null;
}

/**
 * Reserve a slot: "reserved", "taken" (someone else's write won), or "unstored" (no KV).
 * KV has no compare-and-set; writing a token and reading it back catches most races in
 * the same location, not all. The owner sees every booking by email either way.
 */
export async function reserveSlot(env, iso, startMs, holder, nowMs = Date.now()) {
  if (!env.LEADS) return "unstored";
  const expiration = Math.floor(startMs / 1000) + 60 * 60 * 24 * 3;
  const token = crypto.randomUUID();
  await env.LEADS.put(`slot:${iso}`, JSON.stringify({ ...holder, token }), { expiration, metadata: { name: holder.name } });
  const back = await env.LEADS.get(`slot:${iso}`);
  try {
    if (back && JSON.parse(back).token !== token) return "taken";
  } catch { /* unreadable: keep ours */ }
  await env.LEADS.put(`phone:${digitsOf(holder.phone)}`, JSON.stringify({ start: iso }), { expiration: Math.floor(startMs / 1000) + 3600 });
  if (slotCache.set && slotCache.env === env.LEADS) slotCache.set.add(iso);
  try { await addToIndex(env, iso, nowMs); } catch (e) { console.error("slot index write failed", e && e.message); }
  return "reserved";
}

// ---------------------------------------------------------------- email

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

function wrap76(s) {
  return s.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** A minimal RFC 5322 text/plain message. */
export function buildMime({ from, fromName, to, replyTo, subject, text, domain }) {
  const headers = [
    `From: ${encodeHeader(fromName)} <${from}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  return `${headers.join("\r\n")}\r\n\r\n${wrap76(b64(text))}\r\n`;
}

export function leadEmailText(lead) {
  const row = (label, value) => (value ? `${label}: ${value}` : null);
  const lines = [
    lead.appointment
      ? `${lead.appointment.reserved === false ? "CALL REQUESTED (the time could not be locked in: confirm it with the seller)" : "CALL BOOKED"}: ${lead.appointment.ownerLabel} (seller's time: ${lead.appointment.sellerLabel})`
      : `CALLBACK REQUEST: ${lead.callbackPreference || "as soon as possible"}`,
    "",
    row("Name", lead.name),
    row("Phone", lead.phone),
    row("Email", lead.email),
    lead.phone ? row("Texts OK", lead.smsConsent ? "yes" : "no - call or email only") : row("Contact", "email only (no phone given)"),
    lead.textingConsent && lead.textingConsent.question ? row("Texting question", `"${lead.textingConsent.question}"`) : null,
    lead.textingConsent && lead.textingConsent.question ? row("Their answer", `"${lead.textingConsent.answer || "(no reply)"}"`) : null,
    "",
    row("Property", [lead.address, lead.city, [lead.state, lead.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")),
    row("Type", lead.propertyType),
    row("Condition", lead.condition),
    row("Occupancy", lead.occupancy),
    row("Timeline", lead.timeline),
    row("Reason", lead.reason),
    row("Price in mind", lead.askingPrice),
    row("Notes", lead.notes),
    "",
    row("Came from", `${lead.page || "/"} (website chat${lead.lang === "es" ? ", Spanish" : ""})`),
    row("Submitted", lead.submittedAt),
    lead.appointment ? row("Add to your calendar", lead.appointment.ownerCalendarUrl) : null,
  ];
  const body = lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
  return lead.transcript ? `${body}\n\nCONVERSATION (keep for your records; it includes the texting answer)\n${lead.transcript}` : body;
}

export function stopEmailText(notice) {
  const row = (label, value) => (value ? `${label}: ${value}` : null);
  const what = { all: "calls, texts and email", calls: "calls", texts: "texts", email: "email" }[notice.channels] || "calls, texts and email";
  const lines = [
    `DO NOT CONTACT: stop all ${what} to this person.`,
    "Remove them from your call and text lists and cancel any call they booked.",
    "",
    row("Name", notice.name),
    row("Phone", notice.phone),
    row("Email", notice.email),
    row("Their words", notice.note),
    "",
    row("Came from", `${notice.page || "/"} (website chat${notice.lang === "es" ? ", Spanish" : ""})`),
    row("Submitted", notice.submittedAt),
  ];
  const body = lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
  return notice.transcript ? `${body}\n\nCONVERSATION\n${notice.transcript}` : body;
}

async function emailOwner(env, { subject, text, replyTo }) {
  if (!env.SEND_EMAIL) return false;
  const to = env.LEAD_TO || "brsmith6758@gmail.com";
  const from = env.LEAD_FROM || "assistant@primeacrehomebuyers.com";
  const domain = from.split("@")[1] || "localhost";
  const raw = buildMime({ from, fromName: "Prime Acre website", to, replyTo: replyTo || undefined, subject: subject.slice(0, 180), text, domain });
  // Loaded only when email is configured, so the Worker never depends on it otherwise.
  const { EmailMessage } = await import("cloudflare:email");
  await env.SEND_EMAIL.send(new EmailMessage(from, to, raw));
  return true;
}

/** Email the lead to the owner through the SEND_EMAIL binding, when configured. */
export async function emailLead(env, lead) {
  const where = [lead.address, lead.city, lead.state].filter(Boolean).join(", ");
  const subject = lead.appointment
    ? `${lead.appointment.reserved === false ? "Call request (confirm the time)" : "New booked call"} ${lead.appointment.ownerLabel}: ${where}`
    : `New seller lead (${lead.phone ? "callback" : "email follow-up"}): ${where}`;
  return emailOwner(env, { subject, text: leadEmailText(lead), replyTo: lead.email });
}

/** Email the owner a do-not-contact notice, when email is configured. */
export async function emailStop(env, notice) {
  const who = [notice.name, notice.phone, notice.email].filter(Boolean).join(" ");
  return emailOwner(env, { subject: `DO NOT CONTACT: ${who}`, text: stopEmailText(notice) });
}
