import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, normalizeLead, buildMime, leadEmailText } from "../src/leads.js";

test("phone numbers", () => {
  assert.equal(normalizePhone("773-937-5416"), "(773) 937-5416");
  assert.equal(normalizePhone("+1 (602) 555 0143"), "(602) 555-0143");
  assert.equal(normalizePhone("555-0143"), null);
  assert.equal(normalizePhone("123-456-7890"), null, "area codes never start with 1");
});

const base = {
  name: "Dana Lee", phone: "6025550143", email: "dana@example.com", property_address: "123 Main St",
  city: "Mesa", state: "az", zip: "85201-1234", sms_consent: true, property_type: "", condition: "needs a roof",
  occupancy: "", timeline: "", reason: "", asking_price: "", notes: "",
};

test("lead normalization", () => {
  const { lead } = normalizeLead(base);
  assert.equal(lead.phone, "(602) 555-0143");
  assert.equal(lead.state, "AZ");
  assert.equal(lead.zip, "85201");
  assert.equal(lead.smsConsent, true);
  assert.equal(normalizeLead({ ...base, sms_consent: "yes" }).lead.smsConsent, false, "only a real true counts");
  assert.equal(normalizeLead({ ...base, email: "nope" }).lead.email, "");
  assert.match(normalizeLead({ ...base, name: " " }).error, /name/);
  assert.match(normalizeLead({ ...base, phone: "12" }).error, /phone/);
  assert.match(normalizeLead({ ...base, property_address: "" }).error, /address/);
});

test("email message is valid MIME with a decodable body", () => {
  const { lead } = normalizeLead(base);
  const text = leadEmailText({ ...lead, page: "/", submittedAt: "2026-10-14T15:00:00.000Z", appointment: { ownerLabel: "Wed, Oct 14 at 2:00 PM CDT", sellerLabel: "Wed, Oct 14 at 12:00 PM MST", ownerCalendarUrl: "https://calendar.google.com/x" } });
  assert.match(text, /CALL BOOKED: Wed, Oct 14 at 2:00 PM CDT/);
  assert.match(text, /Texts OK: yes/);
  const raw = buildMime({ from: "a@primeacrehomebuyers.com", fromName: "Prime Acre website", to: "b@gmail.com", replyTo: lead.email, subject: "New booked call — Mesa", text, domain: "primeacrehomebuyers.com" });
  const [head, body] = raw.split("\r\n\r\n");
  for (const h of ["From:", "To: <b@gmail.com>", "Subject: =?UTF-8?B?", "Date:", "Message-ID: <", "MIME-Version: 1.0", "Content-Transfer-Encoding: base64", "Reply-To: <dana@example.com>"]) {
    assert.ok(head.includes(h), `header ${h}`);
  }
  for (const line of body.trim().split("\r\n")) assert.ok(line.length <= 76);
  assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), text);
});
