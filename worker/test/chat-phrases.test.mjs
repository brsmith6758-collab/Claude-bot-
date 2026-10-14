// Guided-mode phrase checks: how the chat bubble (site/assets/chat.js) reads stop requests,
// texting-consent answers and call times. Guided mode has no AI, so these matchers decide
// what happens to a seller's words: act on a clear opt-out, ask when it only sounds like
// one, ignore it when it's about someone else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../site/assets/chat.js", import.meta.url), "utf8");
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const code = [
  grab("  function plain(text)", "  function chatTranscript()"),
  grab("  var TIME_RE", "  var CONFIRM_RE"),
  "function isQuestion(text) {" + grab("function isQuestion(text) {", "function looksLikeTime").slice("function isQuestion(text) {".length).replace(/\n  \}\s*$/, "\n}"),
  "var CONFIRM_RE = " + src.match(/var CONFIRM_RE = (\/.*\/i);/)[1] + ";",
  "return { stopSignal, YES_RE, NO_RE, LEAD_YES, OK_NEGATIONS, plain, looksLikeTime, CONFIRM_RE };",
].join("\n");
const { stopSignal, YES_RE, NO_RE, LEAD_YES, OK_NEGATIONS, plain, looksLikeTime, CONFIRM_RE } = new Function(code)();
const S = (c) => ["strong", c], W = ["weak"], N = ["none"];
const cases = [
  ["STOP", S("all")], ["stop", S("all")], ["Stop please", S("all")], ["please stop", S("all")], ["Stop it", S("all")], ["quit", S("all")],
  ["cancel", S("all")], ["end", S("all")], ["revoke", S("all")], ["unsubscribe", S("all")], ["opt out", S("all")], ["just stop", S("all")],
  ["leave me alone", S("all")], ["No thanks, please stop", S("all")], ["I'm not interested, stop", S("all")], ["STOP. Not interested", S("all")],
  ["I said STOP", S("all")], ["STOP STOP", S("all")], ["stop thanks", S("all")], ["Stop all", S("all")], ["stop contacting me", S("all")],
  ["stop calling and texting me", S("all")], ["Don’t contact me", S("all")], ["Don't contact me at all", S("all")],
  ["Do not contact me at this number", S("all")], ["Please do not contact me on this number", S("all")], ["Don't call or text me", S("all")],
  ["do not call or text me", S("all")], ["Don't text or email me", S("all")], ["I want to opt out", S("all")], ["I'd like to opt out", S("all")],
  ["unsubscribe me", S("all")], ["Please unsubscribe me", S("all")], ["I want to unsubscribe", S("all")], ["Remove my number", S("all")],
  ["remove my phone", S("all")], ["Please remove my number", S("all")], ["Remove my info please", S("all")], ["take me off", S("all")],
  ["Please take me off", S("all")], ["Remove me from all your lists", S("all")], ["remove me from your list", S("all")],
  ["you can stop contacting me now", S("all")], ["No me contacten", S("all")], ["cancelar", S("all")], ["basta", S("all")], ["alto", S("all")],
  ["Por favor borren mi número", S("all")], ["déjenme en paz", S("all")], ["ya basta", S("all")], ["No me llamen ni me manden mensajes", S("all")],
  ["Hey stop calling me", S("calls")], ["I need you guys to stop calling me", S("calls")], ["stop calling me", S("calls")],
  ["Please stop calling me", S("calls")], ["don't call me", S("calls")], ["Don’t call me again", S("calls")], ["never call me again", S("calls")],
  ["no more calls", S("calls")], ["Actually I changed my mind. Don’t call me again.", S("calls")], ["take me off your calling list", S("calls")],
  ["no me llamen", S("calls")], ["no me llamen más", S("calls")], ["dejen de llamar", S("calls")], ["Les pido que dejen de llamarme", S("calls")],
  ["No más llamadas", S("calls")], ["Ya no quiero que me llamen", S("calls")],
  ["stop texting me", S("texts")], ["do not text me", S("texts")], ["please don't text me", S("texts")], ["No, never text me again", S("texts")],
  ["no more texts", S("texts")], ["Stop sending me texts", S("texts")], ["I don't want any texts", S("texts")], ["I want to opt out of texts", S("texts")],
  ["Don't text me at this number", S("texts")], ["ya no me manden mensajes", S("texts")], ["No más mensajes", S("texts")], ["No me envíen mensajes de texto", S("texts")],
  ["Stop emailing me", S("email")], ["No me manden correos", S("email")], ["No me envíen correos", S("email")], ["Dejen de enviarme correos", S("email")],
  ["Please don't contact me before 5pm, I'm at work", W], ["Don't call me before 5", W], ["don't call me at work", W],
  ["Please don't text me, calling is fine", W], ["Don't call me, text me instead", W], ["Please don't call me early tomorrow, I work nights", W],
  ["Please don't call me too early, after 10 is best", W], ["Stop calling me before 9am, anytime after is fine", W],
  ["No me llamen al trabajo, mejor después de las 6", W], ["No me contacten antes de las 5, estoy trabajando", W], ["no me llamen hasta mañana", W],
  ["Can I opt out after I sign?", W], ["Can you stop texting me?", W], ["My ex wants to remove me from the deed", W], ["Can you take me off the loan?", W],
  ["not interested", W], ["Don't call me, text me only", W],
  ["The bank won't stop calling me about the late payments. Can you help?", N], ["the lender won't stop calling me", N], ["I'm at the bus stop", N],
  ["How does it work?", N], ["I want to sell my house", N], ["they keep calling me nonstop", N], ["Please stop by anytime to see the house", N],
  ["Can you call after 5? I work days", N], ["I quit my job", N], ["Mi casa tiene un precio alto", N], ["End of the month works", N],
  ["I need to cancel my listing first", N], ["Mis inquilinos no dejan de llamarme", N], ["Yes, texting is fine", N], ["Calls only, please", N],
];
test("guided-mode phrases are read correctly", () => {
let bad = 0;
const problems = [];
const log = (...a) => problems.push(a.join(" "));
for (const [t, [kind, ch]] of cases) {
  const s = stopSignal(t);
  const got = s.strong ? "strong" : s.weak ? "weak" : "none";
  if (got !== kind || (kind === "strong" && s.channel !== ch)) { bad++; log("MISMATCH", JSON.stringify(t), "->", got, s.channel, " want", kind, ch || ""); }
}
const bare = ["STOP", "stop", "please stop", "Stop please", "alto"].filter((t) => !stopSignal(t).bare);
const notBare = ["Stop all", "leave me alone", "déjenme en paz", "ya basta", "unsubscribe"].filter((t) => stopSignal(t).bare);
if (bare.length || notBare.length) { bad++; log("BARE wrong", bare, notBare); }
const consent = (t) => { const p = plain(t); const yes = YES_RE.test(p); const no = NO_RE.test(p.replace(OK_NEGATIONS, "")); const mixed = !yes && no && LEAD_YES.test(p); return yes && !no ? "yes" : (yes === no || mixed) ? "ask" : "no"; };
for (const [t, want] of [["yes", "yes"], ["Yes, no problem", "yes"], ["Sure, no problem", "yes"], ["Sí, no hay problema", "yes"], ["Sí, claro que sí", "yes"], ["Yes, that works", "yes"],
  ["Yes, I don't mind", "yes"], ["Sure, why not", "yes"], ["Of course, why not", "yes"], ["Yes, not a problem", "yes"], ["Sí, no me molesta", "yes"], ["Yes, I don’t mind", "yes"],
  ["ok but calls only", "ask"], ["no", "no"], ["nah", "no"], ["Yes, but I don't want texts", "ask"], ["maybe", "ask"], ["Sure, not now", "ask"]]) {
  if (consent(t) !== want) { bad++; log("CONSENT", JSON.stringify(t), consent(t), "want", want); }
}
for (const t of ["Sounds good", "Correct", "Perfect", "Yes, that's right", "Correcto", "Perfecto", "Así es", "That works", "Works for me"]) if (!CONFIRM_RE.test(plain(t))) { bad++; log("CONFIRM miss", t); }
const times = ["Evenings", "Mornings are best", "Afternoons work", "Weekends", "Mondays", "Right now", "call me now", "Por las tardes", "Los sábados", "between 2 and 4", "4-6", "tomorrow afternoon", "Friday at 10", "3pm", "de 2 a 4", "now", "anytime"];
const notimes = ["How much money will you offer?", "What amount will you pay?", "Am I obligated to sell?", "Do you pay cash now?", "Can you close in 7 days?", "Do you pay 100% of closing costs?", "I have 3 bedrooms and 2 baths", "Do I need to be home for the call?"];
for (const t of times) if (!looksLikeTime(t)) { bad++; log("TIME miss", t); }
for (const t of notimes) if (looksLikeTime(t)) { bad++; log("TIME false", t); }
assert.equal(bad, 0, problems.join("\n"));
});
