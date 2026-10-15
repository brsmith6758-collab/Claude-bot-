// Guided-mode phrase checks: how the chat bubble (site/assets/chat.js) reads stop requests,
// texting-consent answers and call times. Guided mode has no AI, so it never decides what an
// opt-out means from the wording: a bare stop word is acted on, anything else that may be about
// contact is passed on word for word (after a lead) or asked about with buttons (before one),
// and messages about someone else are left alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../site/assets/chat.js", import.meta.url), "utf8");
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const code = [
  grab("  function plain(text)", "  // ------------------------------------------------------------ stop requests"),
  grab("  // ------------------------------------------------------------ stop requests", "  function chatTranscript()"),
  grab("  var TIME_RE", "  var CONFIRM_RE"),
  "function isQuestion(text) {" + grab("function isQuestion(text) {", "function looksLikeTime").slice("function isQuestion(text) {".length).replace(/\n  \}\s*$/, "\n}"),
  "var CONFIRM_RE = " + src.match(/var CONFIRM_RE = (\/.*\/i);/)[1] + ";",
  "return { stopSignal, YES_RE, NO_RE, LEAD_YES, OK_NEGATIONS, plain, looksLikeTime, CONFIRM_RE };",
].join("\n");
const { stopSignal, YES_RE, NO_RE, LEAD_YES, OK_NEGATIONS, plain, looksLikeTime, CONFIRM_RE } = new Function(code)();

const kind = (t) => { const s = stopSignal(t); return s.keywordOnly ? "act" : s.stop ? "stop" : "none"; };

test("bare stop words are acted on at once", () => {
  for (const t of ["STOP", "stop", "Stop please", "please stop", "Stop it", "quit", "cancel", "end", "revoke", "unsubscribe", "opt out",
    "just stop", "leave me alone", "No thanks, please stop", "I'm not interested, stop", "STOP. Not interested", "I said STOP", "STOP STOP",
    "stop thanks", "Stop all", "Please unsubscribe me", "unsubscribe me", "remove me", "take me off", "DNC", "alto", "basta", "cancelar",
    "déjenme en paz", "ya basta", "Denme de baja", "Stop everything", "Remove me from all your lists"]) {
    assert.equal(kind(t), "act", t);
  }
});

test("anything else that may be about contact is caught (passed on, or asked about)", () => {
  for (const t of ["stop calling me", "Please stop calling me", "stop texting me", "Stop emailing me", "stop contacting me", "Hey stop calling me",
    "I need you guys to stop calling me", "Stop sending me texts", "don't call me", "Don’t call me again", "Don't ever call me again",
    "never call me again", "Don't call or text me", "do not text me", "please don't text me", "No, never text me again", "Don't contact me at all",
    "Do not contact me at this number", "I don't want you to contact me", "I don't want to be contacted", "I do not wish to be contacted",
    "I don't want you calling me", "I don't want any texts", "I withdraw my consent", "No texts please", "No calls please", "No calls, no texts",
    "no more calls", "Lose my number", "I want to opt out", "I want to opt out of texts", "Remove my number", "Please remove my number",
    "take me off your calling list", "not interested", "Can you just stop?", "Can you stop texting me?",
    "Don't call me this week, I'm traveling", "Please don't call me right now, I'm at the hospital", "Please don't call me during work hours",
    "Don't call me while I'm driving", "Please don't contact me before 5pm, I'm at work", "Don't call me, text me instead",
    "Please don't text me, calling is fine", "Can I opt out after I sign?",
    "no me llamen", "no me llamen más", "No me contacten", "No me llamen esta semana", "No me llamen ni me manden mensajes",
    "ya no me manden mensajes", "Ya no quiero que me llamen", "No quiero que me contacten", "No quiero que me llamen", "No más llamadas",
    "No más mensajes", "No quiero más mensajes", "Quítenme de su lista", "Bórrenme de su lista", "Elimínenme de su lista", "Quiero darme de baja",
    "No me interesa", "Paren de llamarme", "No llamen más", "dejen de llamar", "Les pido que dejen de llamarme", "Por favor borren mi número",
    "No me manden correos", "No me envíen mensajes de texto", "No me contacten antes de las 5, estoy trabajando",
    "Stop the calls", "Stop the texts please", "stop with the calls", "Stop spamming me", "Stop f***ing calling me", "Stop constantly calling me",
    "Stop reaching out to me", "Stop bugging me", "Stop pestering me", "Stop, wrong number", "STOP - wrong person", "Stop. Not selling.",
    "Stop, I'm not selling", "Stop. I sold the house", "STOP. I never asked for this", "no more texting", "no more calling", "no texting please",
    "don't send me texts", "I'm no longer interested", "No longer interested", "Cease and desist", "I don't want to hear from you again",
    "No further contact please", "I prefer not to be contacted", "Actually, just stop everything, I'm not selling",
    "No estoy interesado", "Ya no estoy interesada", "No, gracias. No estoy interesado.", "Favor de no llamarme", "¿Pueden dejar de llamarme?",
    "Borren mis datos", "No me llame más", "No me llame", "Por favor no me llame", "No me vuelva a llamar", "Deje de llamarme", "Deje de escribirme",
    "Deje de mandarme mensajes", "Déjeme en paz", "No me contacte", "No me mande más mensajes", "No me envíe mensajes", "No me moleste",
    "Quíteme de su lista", "Bórreme de su lista", "Sáqueme de su lista", "Elimíneme de su lista", "No quiero que me llame", "Sáquenme de su lista",
    "No me hablen más", "No me hable más", "No deseo que me contacten", "Saquen mi número de su lista"]) {
    assert.equal(kind(t), "stop", t);
  }
});

test("messages about someone else, or about other things, are left alone", () => {
  for (const t of ["The bank won't stop calling me about the late payments. Can you help?", "the lender won't stop calling me", "I'm at the bus stop",
    "How does it work?", "I want to sell my house", "they keep calling me nonstop", "Please stop by anytime to see the house",
    "Can you call after 5? I work days", "I quit my job", "Mi casa tiene un precio alto", "End of the month works", "I need to cancel my listing first",
    "Mis inquilinos no dejan de llamarme", "Yes, texting is fine", "Calls only, please", "My ex wants to take me off the deed",
    "My ex wants to remove me from the deed", "Can you take me off the loan?", "I want to stop paying the mortgage", "Ya no vivo en la casa",
    "No quiero más problemas con esta casa", "Can you call me at 3?", "tomorrow afternoon", "123 Main St, Mesa AZ",
    "The house has bugs in the attic", "When will I hear from you?", "Quiero dejar la casa como está", "Is it OK to stop by the house?"]) {
    assert.equal(kind(t), "none", t);
  }
});

test("only a bare STOP counts as the answer to the texting question", () => {
  for (const t of ["STOP", "stop", "please stop", "Stop please", "alto"]) assert.ok(stopSignal(t).bare, t);
  for (const t of ["Stop all", "leave me alone", "déjenme en paz", "ya basta", "unsubscribe", "remove me"]) assert.ok(!stopSignal(t).bare, t);
});

test("texting consent: only a clear yes counts, mixed answers are asked again", () => {
  const consent = (t) => {
    const p = plain(t);
    const yes = YES_RE.test(p);
    const no = NO_RE.test(p.replace(OK_NEGATIONS, ""));
    const mixed = !yes && no && LEAD_YES.test(p);
    return yes && !no ? "yes" : (yes === no || mixed) ? "ask" : "no";
  };
  for (const [t, want] of [["yes", "yes"], ["Yes, no problem", "yes"], ["Sure, no problem", "yes"], ["Sí, no hay problema", "yes"],
    ["Sí, claro que sí", "yes"], ["Yes, that works", "yes"], ["Yes, I don't mind", "yes"], ["Sure, why not", "yes"], ["Of course, why not", "yes"],
    ["Yes, not a problem", "yes"], ["Sí, no me molesta", "yes"], ["Yes, I don’t mind", "yes"], ["ok but calls only", "ask"], ["no", "no"],
    ["nah", "no"], ["Yes, but I don't want texts", "ask"], ["maybe", "ask"], ["Sure, not now", "ask"]]) {
    assert.equal(consent(t), want, t);
  }
});

test("call times: real answers count, questions and numbers don't", () => {
  for (const t of ["Sounds good", "Correct", "Perfect", "Yes, that's right", "Correcto", "Perfecto", "Así es", "That works", "Works for me"]) {
    assert.ok(CONFIRM_RE.test(plain(t)), `confirm: ${t}`);
  }
  for (const t of ["Evenings", "Mornings are best", "Afternoons work", "Weekends", "Mondays", "Right now", "call me now", "Por las tardes",
    "Los sábados", "between 2 and 4", "4-6", "tomorrow afternoon", "Friday at 10", "3pm", "de 2 a 4", "now", "anytime"]) {
    assert.ok(looksLikeTime(t), `time: ${t}`);
  }
  for (const t of ["How much money will you offer?", "What amount will you pay?", "Am I obligated to sell?", "Do you pay cash now?",
    "Can you close in 7 days?", "Do you pay 100% of closing costs?", "I have 3 bedrooms and 2 baths", "Do I need to be home for the call?"]) {
    assert.ok(!looksLikeTime(t), `not a time: ${t}`);
  }
});
