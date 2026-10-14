// Call-slot scheduling: business hours in the owner's time zone, shown to the
// seller in theirs. No external calendar; booked slots live in KV.

const PART_RANGES = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
};

/** True when `tz` is an IANA zone this runtime understands. */
export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsCache = new Map();
function partsFormatter(tz) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of instant `ms` in zone `tz`. weekday: 1=Mon … 7=Sun. */
export function zonedParts(ms, tz) {
  const out = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  const wk = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[out.weekday];
  return {
    year: +out.year,
    month: +out.month,
    day: +out.day,
    hour: +out.hour,
    minute: +out.minute,
    second: +out.second,
    weekday: wk,
  };
}

function offsetMs(ms, tz) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The UTC instant of wall-clock time y-m-d hh:mm in zone `tz`. */
export function zonedTimeToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let off = offsetMs(guess, tz);
  let utc = guess - off;
  const off2 = offsetMs(utc, tz);
  if (off2 !== off) utc = guess - off2;
  return utc;
}

export function ymd(p) {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function parseHHMM(s, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ""));
  if (!m) return fallback;
  const h = +m[1];
  const min = +m[2];
  if (h > 24 || min > 59) return fallback;
  return h * 60 + min;
}

/** Business-hours settings from Worker env vars, with safe defaults. */
export function scheduleConfig(env = {}) {
  const tz = isValidTimeZone(env.BUSINESS_TZ) ? env.BUSINESS_TZ : "America/Chicago";
  const days = String(env.BUSINESS_DAYS || "1,2,3,4,5,6")
    .split(",")
    .map((x) => parseInt(x, 10))
    .filter((x) => x >= 1 && x <= 7);
  const start = parseHHMM(env.BUSINESS_START, 9 * 60);
  const end = parseHHMM(env.BUSINESS_END, 19 * 60);
  const slot = Math.min(Math.max(parseInt(env.SLOT_MINUTES, 10) || 30, 15), 120);
  const lead = Math.min(Math.max(parseInt(env.MIN_NOTICE_MINUTES, 10) || 60, 0), 24 * 60);
  const ahead = Math.min(Math.max(parseInt(env.DAYS_AHEAD, 10) || 7, 1), 30);
  return {
    tz,
    days: days.length ? days : [1, 2, 3, 4, 5, 6],
    startMin: Math.min(start, end),
    endMin: Math.max(start, end),
    slotMinutes: slot,
    minNoticeMinutes: lead,
    daysAhead: ahead,
  };
}

/**
 * Every open slot start (ms since epoch, ascending) from `now` through
 * `daysAhead` local business days, minus `booked` (a Set of ISO strings).
 */
export function openSlots(nowMs, cfg, booked = new Set()) {
  const earliest = nowMs + cfg.minNoticeMinutes * 60000;
  const today = zonedParts(nowMs, cfg.tz);
  const out = [];
  for (let i = 0; i <= cfg.daysAhead; i++) {
    // Calendar arithmetic on the business-zone date, immune to DST.
    const cal = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const y = cal.getUTCFullYear();
    const m = cal.getUTCMonth() + 1;
    const d = cal.getUTCDate();
    const weekday = ((cal.getUTCDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
    if (!cfg.days.includes(weekday)) continue;
    for (let t = cfg.startMin; t + cfg.slotMinutes <= cfg.endMin; t += cfg.slotMinutes) {
      const ms = zonedTimeToUtc(y, m, d, Math.floor(t / 60), t % 60, cfg.tz);
      if (ms < earliest) continue;
      if (booked.has(new Date(ms).toISOString())) continue;
      out.push(ms);
    }
  }
  return out;
}

/**
 * Narrow open slots to the seller's request and spread the choice:
 * at most `perDay` per local date, `max` total, at least 90 minutes apart.
 */
export function pickSlots(slotsMs, { sellerTz, day = "", partOfDay = "any", perDay = 3, max = 6 }) {
  const range = PART_RANGES[partOfDay] || null;
  const byDay = new Map();
  for (const ms of slotsMs) {
    const p = zonedParts(ms, sellerTz);
    const key = ymd(p);
    if (day && key !== day) continue;
    if (range && (p.hour < range[0] || p.hour >= range[1])) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ms);
  }
  const picked = [];
  for (const [, list] of byDay) {
    const chosen = [];
    for (const ms of list) {
      if (chosen.length >= perDay) break;
      if (chosen.length && ms - chosen[chosen.length - 1] < 90 * 60000) continue;
      chosen.push(ms);
    }
    picked.push(...chosen);
    if (picked.length >= max) break;
  }
  return picked.slice(0, max);
}

/** "Tue, Oct 14 at 2:00 PM CDT" in `tz`, English or Spanish. */
export function slotLabel(ms, tz, lang = "en") {
  const locale = lang === "es" ? "es-US" : "en-US";
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
  return lang === "es" ? `${date} a las ${time}` : `${date} at ${time}`;
}

/** Google Calendar "add event" link (opens a prefilled event, nothing is sent). */
export function calendarLink({ startMs, minutes, title, details }) {
  const fmt = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", title);
  u.searchParams.set("dates", `${fmt(startMs)}/${fmt(startMs + minutes * 60000)}`);
  u.searchParams.set("details", details);
  return u.toString();
}

/** Best guess at a seller's zone from a US state code, when the browser gave none. */
export function stateTimeZone(state) {
  const s = String(state || "").toUpperCase();
  const map = {
    AZ: "America/Phoenix", FL: "America/New_York", TN: "America/Chicago", NC: "America/New_York",
    GA: "America/New_York", SC: "America/New_York", TX: "America/Chicago", IL: "America/Chicago",
    CA: "America/Los_Angeles", NV: "America/Los_Angeles", CO: "America/Denver", NY: "America/New_York",
  };
  return map[s] || "";
}
