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

/**
 * Validate and normalize a lead collected by the assistant.
 * Returns { lead } or { error } where error is a short reason the model can act on.
 */
export function normalizeLead(input) {
  const name = clip(input.name, 120);
  const phone = normalizePhone(input.phone);
  const address = clip(input.property_address, 200);
  if (!name) return { error: "Missing the seller's name. Ask for it, then try again." };
  if (!phone) return { error: "The phone number is not a valid 10-digit US number. Ask the seller to confirm it, then try again." };
  if (!address) return { error: "Missing the property address. Ask for it, then try again." };
  let email = clip(input.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = "";
  const state = clip(input.state, 2).toUpperCase();
  return {
    lead: {
      name,
      phone,
      email,
      address,
      city: clip(input.city, 100),
      state: /^[A-Z]{2}$/.test(state) ? state : "",
      zip: (clip(input.zip, 10).match(/\d{5}/) || [""])[0],
      smsConsent: input.sms_consent === true,
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

function randomId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
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

// Booked slots are listed at most every 20 seconds per isolate: KV list operations
// are limited (1,000 a day on the free plan) and every "show me times" would use one.
let slotCache = { at: 0, set: null, env: null };

/** Reserved call slots, as a Set of ISO strings. */
export async function bookedSlots(env, nowMs = Date.now()) {
  if (!env.LEADS) return new Set();
  if (slotCache.set && slotCache.env === env.LEADS && nowMs - slotCache.at < 20000) return slotCache.set;
  const booked = new Set();
  let cursor;
  do {
    const page = await env.LEADS.list({ prefix: "slot:", cursor });
    for (const k of page.keys) booked.add(k.name.slice(5));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  slotCache = { at: nowMs, set: booked, env: env.LEADS };
  return booked;
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

/** Bookings and callback requests made today from one visitor network. */
export async function bookingsToday(env, clientKey, nowMs) {
  if (!env.LEADS || !clientKey) return 0;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return parseInt((await env.LEADS.get(`bk:${clientKey}:${day}`)) || "0", 10) || 0;
}

export async function countBooking(env, clientKey, nowMs) {
  if (!env.LEADS || !clientKey) return;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const n = (await bookingsToday(env, clientKey, nowMs)) + 1;
  await env.LEADS.put(`bk:${clientKey}:${day}`, String(n), { expirationTtl: 60 * 60 * 26 });
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
export async function reserveSlot(env, iso, startMs, holder) {
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
    lead.appointment ? `CALL BOOKED: ${lead.appointment.ownerLabel} (seller's time: ${lead.appointment.sellerLabel})` : `CALLBACK REQUEST: ${lead.callbackPreference || "as soon as possible"}`,
    "",
    row("Name", lead.name),
    row("Phone", lead.phone),
    row("Email", lead.email),
    row("Texts OK", lead.smsConsent ? "yes" : "no - call or email only"),
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
  return lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Email the lead to the owner through the SEND_EMAIL binding, when configured. */
export async function emailLead(env, lead) {
  if (!env.SEND_EMAIL) return false;
  const to = env.LEAD_TO || "brsmith6758@gmail.com";
  const from = env.LEAD_FROM || "assistant@primeacrehomebuyers.com";
  const where = [lead.address, lead.city, lead.state].filter(Boolean).join(", ");
  const subject = lead.appointment
    ? `New booked call ${lead.appointment.ownerLabel}: ${where}`
    : `New seller lead (callback): ${where}`;
  const domain = from.split("@")[1] || "localhost";
  const raw = buildMime({
    from,
    fromName: "Prime Acre website",
    to,
    replyTo: lead.email || undefined,
    subject: subject.slice(0, 180),
    text: leadEmailText(lead),
    domain,
  });
  // Loaded only when email is configured, so the Worker never depends on it otherwise.
  const { EmailMessage } = await import("cloudflare:email");
  await env.SEND_EMAIL.send(new EmailMessage(from, to, raw));
  return true;
}
