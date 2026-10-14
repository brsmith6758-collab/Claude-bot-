import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedTimeToUtc, zonedParts, openSlots, pickSlots, slotLabel, scheduleConfig, isValidTimeZone, calendarLink,
} from "../src/slots.js";

const cfg = scheduleConfig({});
const WED_1010_CDT = Date.UTC(2026, 9, 14, 15, 10); // Wed Oct 14 2026, 10:10 AM Central

test("wall-clock to UTC across daylight saving", () => {
  assert.equal(zonedTimeToUtc(2026, 10, 30, 9, 0, "America/Chicago"), Date.UTC(2026, 9, 30, 14, 0)); // CDT
  assert.equal(zonedTimeToUtc(2026, 11, 2, 9, 0, "America/Chicago"), Date.UTC(2026, 10, 2, 15, 0)); // CST after Nov 1
  assert.equal(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/Phoenix"), Date.UTC(2026, 0, 15, 16, 0));
  assert.equal(zonedTimeToUtc(2026, 7, 15, 9, 0, "America/Phoenix"), Date.UTC(2026, 6, 15, 16, 0)); // no DST in AZ
});

test("defaults: Mon-Sat 9-7 Central, 30 minute slots", () => {
  assert.equal(cfg.tz, "America/Chicago");
  assert.deepEqual(cfg.days, [1, 2, 3, 4, 5, 6]);
  assert.equal(cfg.startMin, 540);
  assert.equal(cfg.endMin, 1140);
  assert.equal(cfg.slotMinutes, 30);
});

test("open slots respect notice, hours, days and bookings", () => {
  const slots = openSlots(WED_1010_CDT, cfg);
  assert.ok(slots.length > 100);
  assert.ok(slots[0] >= WED_1010_CDT + 60 * 60000, "first slot is at least an hour out");
  assert.equal(slots[0], Date.UTC(2026, 9, 14, 16, 30), "first slot is 11:30 AM Central");
  for (const ms of slots) {
    const p = zonedParts(ms, "America/Chicago");
    assert.notEqual(p.weekday, 7, "no Sunday slots");
    const min = p.hour * 60 + p.minute;
    assert.ok(min >= 540 && min + 30 <= 1140, `inside business hours: ${p.hour}:${p.minute}`);
    assert.equal(p.minute % 30, 0);
  }
  const thursday = slots.filter((ms) => zonedParts(ms, "America/Chicago").day === 15);
  assert.equal(thursday.length, 20);
  const booked = new Set([new Date(slots[0]).toISOString()]);
  assert.equal(openSlots(WED_1010_CDT, cfg, booked)[0], slots[1]);
});

test("slots after the DST change land on the right UTC hour", () => {
  const slots = openSlots(Date.UTC(2026, 9, 30, 12, 0), cfg);
  const monday = slots.filter((ms) => zonedParts(ms, "America/Chicago").day === 2 && zonedParts(ms, "America/Chicago").month === 11);
  assert.equal(monday[0], Date.UTC(2026, 10, 2, 15, 0));
});

test("picking slots for a seller in Arizona", () => {
  const all = openSlots(WED_1010_CDT, cfg);
  const picked = pickSlots(all, { sellerTz: "America/Phoenix" });
  assert.ok(picked.length >= 4 && picked.length <= 6);
  for (let i = 1; i < picked.length; i++) {
    const a = zonedParts(picked[i - 1], "America/Phoenix");
    const b = zonedParts(picked[i], "America/Phoenix");
    if (a.day === b.day) assert.ok(picked[i] - picked[i - 1] >= 90 * 60000, "spread out within a day");
  }
  const evening = pickSlots(all, { sellerTz: "America/Phoenix", partOfDay: "evening" });
  for (const ms of evening) assert.ok(zonedParts(ms, "America/Phoenix").hour >= 17);
  const friday = pickSlots(all, { sellerTz: "America/Phoenix", day: "2026-10-16" });
  assert.ok(friday.length > 0);
  for (const ms of friday) assert.equal(zonedParts(ms, "America/Phoenix").day, 16);
  assert.deepEqual(pickSlots(all, { sellerTz: "America/Phoenix", day: "2026-10-18" }), [], "Sunday has nothing");
});

test("labels and calendar links", () => {
  const ms = Date.UTC(2026, 9, 14, 19, 0);
  assert.equal(slotLabel(ms, "America/Chicago"), "Wed, Oct 14 at 2:00 PM CDT");
  assert.equal(slotLabel(ms, "America/Phoenix"), "Wed, Oct 14 at 12:00 PM MST");
  assert.match(slotLabel(ms, "America/Chicago", "es"), /14.*a las 2:00/);
  const link = calendarLink({ startMs: ms, minutes: 30, title: "Call", details: "x" });
  assert.match(link, /dates=20261014T190000Z%2F20261014T193000Z/);
  assert.ok(isValidTimeZone("America/New_York"));
  assert.ok(!isValidTimeZone("Not/AZone"));
  assert.ok(!isValidTimeZone(""));
});

test("sellers far from Central only see waking-hour times", () => {
  const all = openSlots(WED_1010_CDT, cfg);
  const hawaii = pickSlots(all, { sellerTz: "Pacific/Honolulu" });
  assert.ok(hawaii.length > 0);
  for (const ms of hawaii) {
    const h = zonedParts(ms, "Pacific/Honolulu").hour;
    assert.ok(h >= 7 && h < 21, `Honolulu hour ${h}`);
  }
  const morning = pickSlots(all, { sellerTz: "Pacific/Honolulu", partOfDay: "morning" });
  for (const ms of morning) assert.ok(zonedParts(ms, "Pacific/Honolulu").hour >= 7, "morning never means 4 AM");
  const any = pickSlots(all, { sellerTz: "Pacific/Honolulu", sellerHours: null });
  assert.ok(zonedParts(any[0], "Pacific/Honolulu").hour < 7, "without the filter the soonest slot is before 7 AM");
});

test("a zero-minute notice is honoured", () => {
  const zero = scheduleConfig({ MIN_NOTICE_MINUTES: "0" });
  assert.equal(zero.minNoticeMinutes, 0);
  assert.equal(openSlots(Date.UTC(2026, 9, 14, 15, 0), zero)[0], Date.UTC(2026, 9, 14, 15, 0));
  assert.equal(scheduleConfig({}).minNoticeMinutes, 60);
});
