/* Prime Acre Capital — website chat assistant.
   AI mode: talks to the Cloudflare Worker at PAC_CONFIG.chatEndpoint.
   Guided mode: a scripted conversation that still collects the lead and a call time,
   used when the Worker is not deployed or not reachable. */
(function () {
  "use strict";
  if (window.__pacChat) return;
  window.__pacChat = true;

  var cfg = window.PAC_CONFIG || {};
  var LANG = (document.documentElement.getAttribute("lang") || "en").slice(0, 2) === "es" ? "es" : "en";
  var PHONE = String(cfg.phone || "").trim();
  var PHONE_TEL = PHONE ? "+1" + PHONE.replace(/\D/g, "").slice(-10) : "";
  var EMAIL = String(cfg.email || "").trim();
  var ENDPOINT = String(cfg.chatEndpoint || "").replace(/\/+$/, "");
  var STORE_KEY = "pac:chat:v1";
  var TEASE_KEY = "pac:chat:teased";
  var HOURS = cfg.chatHours || { tz: "America/Chicago", days: [1, 2, 3, 4, 5, 6], start: 9, end: 19, noticeMinutes: 60 };
  // Keep in step with the full-screen rules in chat.css.
  var SMALL_SCREEN = "(max-width: 560px), (max-height: 500px)";
  function smallScreen() { return !!(window.matchMedia && window.matchMedia(SMALL_SCREEN).matches); }

  var T = {
    en: {
      launcher: "Questions? Chat now", title: "Prime Acre Capital", status: "AI assistant · replies instantly", statusGuided: "Virtual assistant · replies instantly",
      close: "Close chat", placeholder: "Type your message…", send: "Send", input: "Message",
      teaseTitle: "Thinking about selling?", teaseBody: "I can answer questions and set up a quick call for a cash offer.",
      teaseClose: "Dismiss",
      foot: "Automated assistant. Chats may be processed by our AI provider (Anthropic) and are shared with our team. Please don't share SSN or bank details. Prefer to talk? Call or text ",
      footShort: "AI chat, processed by Anthropic and shared with our team. ",
      privacy: "Privacy",
      greet: "Hi! I'm the Prime Acre Capital assistant. I can answer your questions and set up a quick call to get you a no-obligation cash offer. What brings you here today?",
      chips: ["I want a cash offer", "How does it work?", "Book a call", "Talk to a person"],
      person: "You can call or text us at " + PHONE + " any time. Or leave your name and number here and we'll call you.",
      trouble: "I'm having trouble connecting right now. You can try again, or call or text " + PHONE + ".",
      fresh: "This chat got long, so I'm starting a fresh page. Anything you already booked is saved with the team.",
      tryAgain: "Try again",
      switching: "Let me take your details the quick way so the team can reach you.",
      booked: "Call booked", requestedCall: "Call requested", addCal: "Add to my calendar", call: "Call", text: "Text",
      copy: "Copy my details", copied: "Copied",
      // guided mode
      gAddress: "Great, let's get you an offer. What's the address of the property?",
      gCondition: "Thanks. What condition is the house in?",
      gConditionChips: ["Move-in ready", "Needs some work", "Needs major repairs", "Not livable right now"],
      gTimeline: "Got it. When are you hoping to sell?",
      gTimelineChips: ["As soon as possible", "Within 30 days", "In 1 to 3 months", "Just exploring"],
      gName: "Thanks. What's your name?",
      gPhone: function (n) { return "Nice to meet you" + (n ? ", " + n : "") + ". What's the best phone number to reach you?"; },
      gPhoneBad: "That doesn't look like a 10-digit US number. You can check it, or if you'd rather not share a number, the team can email you instead.",
      gEmailInstead: "Email me instead",
      gEmail: "Sure. What's the best email address?",
      gEmailBad: "That email doesn't look right. Could you check it?",
      gConsent: "Can we text you at that number about your offer? Msg & data rates may apply; reply STOP to opt out. Agreeing isn't required.",
      gConsentAgain: "Just to be sure: is texting OK? Please tap one.",
      gConsentChips: ["Yes, texting is fine", "Calls only, please"],
      gTime: "When's a good time for a quick call? Pick one, or type a time that works.",
      gTimeAsap: "As soon as possible",
      gSending: "One moment…",
      gDone: function (when, sms) { return "Thanks! " + (when ? "I've asked the team to call you around " + when + ". They'll confirm by " + (sms ? "call or text" : "phone") + ". " : "The team will reach out shortly. ") + "They review the property first, and a written cash offer typically follows within 24 hours of the review. If anything changes, call or text " + PHONE + "."; },
      gDoneEmail: function (email) { return "Thanks! The team will email you at " + email + ". They review the property first, and a written cash offer typically follows within 24 hours of the review."; },
      emailOnly: "Email follow-up only",
      gStopAsk: "Understood. What phone number or email should we stop contacting?",
      gStopDoneFor: function (ch) { return "Done. " + ({ calls: "We won't call you again.", texts: "We won't text you again.", email: "We won't email you again." }[ch] || "We won't contact you again. Sorry for the bother."); },
      gNoTexts: "Got it, no texts. The team will call you.",
      gNoTextsMid: "Got it, we won't text you.",
      gNoEmailMid: "Got it, we won't email you.",
      gNoCalls: "Got it, we won't call you. If you'd like your offer by email instead, what's the best email address? If you'd rather we didn't contact you at all, just say stop.",
      gNeutral: "You can call or text us at " + PHONE + " any time.",
      gTimeConfirm: function (t) { return "Just to check: should the team call you around \u201c" + t + "\u201d?"; },
      gTimeConfirmChips: ["Yes, that works", "Pick another time"],
      gStopFail: "I couldn't send that automatically. Please email " + (EMAIL || "us") + " with the number or email to remove, and we'll take care of it.",
      gStale: "That time has already passed. Here are the next times you can request:",
      gNoTimes: function (hours) { return "Our call hours are " + hours + ", which is early or late where you are. Tap 'As soon as possible' and the team will reach out at a good time for you."; },
      gFail: "I couldn't send that automatically. Please call or text " + PHONE + " and mention these details:",
      gAfter: "The team has your details and will reach out. For anything else, call or text " + PHONE + ".",
      gOffer: "Want me to set up a quick call so you can get a real number?",
      gOfferChips: ["Yes, let's do it", "I have another question"],
      gAsk: "Sure, what would you like to know?",
      gQuestion: "Good question. The team can go over that with you on the call.",
      gCallbackName: "Got it. What's the best number to reach you, and your name?",
      gTimeHint: "What day and time work best? For example: tomorrow afternoon, or Friday at 10.",
      notGiven: "(not given yet)",
      requested: "requested time",
      faq: [
        [/fee|commission|cost|charge|pay (you|anything)/i, "There are no fees or commissions, and we pay the standard closing costs. The offer you accept is what you walk away with, minus anything owed on the property."],
        [/mortgage|\bowe[ds]?\b|\bliens?\b|back tax|foreclos|auction|behind on|underwater|upside.down|notice of default|sheriff|trustee sale|repossess|lose (my|the) (house|home)|(bank|lender) (is )?(taking|going to take|trying to take)|tak(e|ing) my (house|home)/i, "If the sale price covers what you owe, your mortgage, liens, and back taxes are paid off from the sale at closing. If you might owe more than the house is worth, the team will go over the numbers with you honestly. If you're facing foreclosure, timing matters, and a free HUD-approved housing counselor can also help: hud.gov or 800-569-4287."],
        [/how (fast|quick|long|soon)|\bclos(e|ing)\b|\bdays?\b/i, "We can close in as little as 7 days once title is clear, or on a later date you pick."],
        [/condition|repair|as.?is|clean|damage|fix/i, "We buy houses as-is in any condition. No repairs, no cleaning, no showings. Leave behind anything you don't want."],
        [/legit|scam|trust|real|safe/i, "Fair question. You never pay us anything, and every closing goes through a licensed title company or closing attorney, so your money never passes through our hands. You can have your own attorney review the contract."],
        [/where|state|area|arizona|florida|tennessee|carolina|nationwide/i, "We focus on Arizona, Florida, Tennessee, and North Carolina, and buy nationwide through local buying partners."],
        [/how (does|do) (it|this) work|process|steps/i, "It's simple: tell us about the house, we review it and send a written, no-obligation cash offer, and you pick the closing date."],
        [/how much|worth|price|value|offer amount/i, "The offer comes after the team reviews the property, so I can't give a number here. A quick call is the fastest way to a real offer."],
        [/tenant|rent|landlord/i, "Yes, we buy houses with tenants in place and work with the existing lease."],
        [/inherit|probate|estate/i, "We buy inherited and probate properties all the time, and can work with your attorney on the paperwork."]
      ]
    },
    es: {
      launcher: "¿Preguntas? Chatee ahora", title: "Prime Acre Capital", status: "Asistente de IA · responde al instante", statusGuided: "Asistente virtual · responde al instante",
      close: "Cerrar chat", placeholder: "Escriba su mensaje…", send: "Enviar", input: "Mensaje",
      teaseTitle: "¿Piensa vender?", teaseBody: "Puedo responder sus preguntas y programar una llamada para una oferta en efectivo.",
      teaseClose: "Cerrar",
      foot: "Asistente automatizado. Los chats pueden ser procesados por nuestro proveedor de IA (Anthropic) y se comparten con nuestro equipo. No comparta su número de Seguro Social ni datos bancarios. ¿Prefiere hablar? Llame o envíe un texto al ",
      footShort: "Chat de IA, procesado por Anthropic y compartido con nuestro equipo. ",
      privacy: "Privacidad",
      greet: "¡Hola! Soy el asistente de Prime Acre Capital. Puedo responder sus preguntas y programar una llamada rápida para darle una oferta en efectivo sin compromiso. ¿En qué le puedo ayudar?",
      chips: ["Quiero una oferta en efectivo", "¿Cómo funciona?", "Programar una llamada", "Hablar con una persona"],
      person: "Puede llamarnos o enviarnos un texto al " + PHONE + " cuando quiera. O deje aquí su nombre y número y le llamamos.",
      trouble: "Tengo problemas para conectarme. Puede intentarlo de nuevo, o llamar o enviar un texto al " + PHONE + ".",
      fresh: "Esta conversación se hizo larga, así que empiezo una nueva. Lo que ya programó está guardado con el equipo.",
      tryAgain: "Intentar de nuevo",
      switching: "Permítame tomar sus datos de forma rápida para que el equipo se comunique con usted.",
      booked: "Llamada programada", requestedCall: "Llamada solicitada", addCal: "Agregar a mi calendario", call: "Llamar", text: "Texto",
      copy: "Copiar mis datos", copied: "Copiado",
      gAddress: "Perfecto, vamos a conseguirle una oferta. ¿Cuál es la dirección de la propiedad?",
      gCondition: "Gracias. ¿En qué condición está la casa?",
      gConditionChips: ["Lista para vivir", "Necesita algunos arreglos", "Necesita reparaciones mayores", "No habitable"],
      gTimeline: "Entendido. ¿Cuándo le gustaría vender?",
      gTimelineChips: ["Lo antes posible", "En 30 días", "En 1 a 3 meses", "Solo estoy explorando"],
      gName: "Gracias. ¿Cuál es su nombre?",
      gPhone: function (n) { return "Mucho gusto" + (n ? ", " + n : "") + ". ¿Cuál es el mejor número para comunicarnos con usted?"; },
      gPhoneBad: "Ese número no parece de 10 dígitos. Puede revisarlo, o si prefiere no dar un número, el equipo le puede escribir por correo electrónico.",
      gEmailInstead: "Prefiero correo electrónico",
      gEmail: "Claro. ¿Cuál es su correo electrónico?",
      gEmailBad: "Ese correo no parece correcto. ¿Lo puede revisar?",
      gConsent: "¿Le podemos enviar mensajes de texto a ese número sobre su oferta? Pueden aplicarse tarifas de mensajes y datos; responda STOP para cancelar. No es obligatorio aceptar.",
      gConsentAgain: "Para estar seguros: ¿le podemos enviar textos? Elija una opción, por favor.",
      gConsentChips: ["Sí, textos está bien", "Solo llamadas, por favor"],
      gTime: "¿Cuándo le queda bien una llamada rápida? Elija una opción o escriba un horario.",
      gTimeAsap: "Lo antes posible",
      gSending: "Un momento…",
      gDone: function (when, sms) { return "¡Gracias! " + (when ? "Le pedí al equipo que le llame alrededor de " + when + ". Le confirmarán por " + (sms ? "llamada o texto" : "teléfono") + ". " : "El equipo se comunicará pronto. ") + "Revisan la propiedad primero y una oferta por escrito suele llegar dentro de 24 horas después de la revisión. Si algo cambia, llame o envíe un texto al " + PHONE + "."; },
      gDoneEmail: function (email) { return "¡Gracias! El equipo le escribirá a " + email + ". Revisan la propiedad primero y una oferta por escrito suele llegar dentro de 24 horas después de la revisión."; },
      emailOnly: "Solo seguimiento por correo electrónico",
      gStopAsk: "Entendido. ¿Qué número de teléfono o correo electrónico debemos dejar de contactar?",
      gStopDoneFor: function (ch) { return "Listo. " + ({ calls: "No volveremos a llamarle.", texts: "No le enviaremos más mensajes de texto.", email: "No le enviaremos más correos." }[ch] || "No volveremos a contactarle. Disculpe la molestia."); },
      gNoTexts: "Entendido, sin mensajes de texto. El equipo le llamará.",
      gNoTextsMid: "Entendido, no le enviaremos mensajes de texto.",
      gNoEmailMid: "Entendido, no le enviaremos correos.",
      gNoCalls: "Entendido, no le llamaremos. Si prefiere recibir su oferta por correo, ¿cuál es su correo electrónico? Si prefiere que no le contactemos en absoluto, solo diga stop.",
      gNeutral: "Puede llamarnos o enviarnos un texto al " + PHONE + " cuando quiera.",
      gTimeConfirm: function (t) { return "Para confirmar: ¿el equipo le llama alrededor de \u201c" + t + "\u201d?"; },
      gTimeConfirmChips: ["Sí, está bien", "Elegir otro horario"],
      gStopFail: "No pude enviar esto automáticamente. Por favor escriba a " + (EMAIL || "nuestro correo") + " con el número o correo que debemos quitar y nos encargamos.",
      gStale: "Ese horario ya pasó. Estos son los próximos horarios que puede pedir:",
      gNoTimes: function (hours) { return "Nuestro horario de llamadas es " + hours + ", que es temprano o tarde donde usted está. Elija 'Lo antes posible' y el equipo le contactará a una buena hora para usted."; },
      gFail: "No pude enviar esto automáticamente. Por favor llame o envíe un texto al " + PHONE + " con estos datos:",
      gAfter: "El equipo tiene sus datos y se comunicará con usted. Para cualquier otra cosa, llame o envíe un texto al " + PHONE + ".",
      gOffer: "¿Quiere que programemos una llamada rápida para darle un número real?",
      gOfferChips: ["Sí, adelante", "Tengo otra pregunta"],
      gAsk: "Claro, ¿qué le gustaría saber?",
      gQuestion: "Buena pregunta. El equipo puede explicarle eso en la llamada.",
      gCallbackName: "Entendido. ¿Cuál es el mejor número para comunicarnos, y su nombre?",
      gTimeHint: "¿Qué día y hora le quedan mejor? Por ejemplo: mañana en la tarde, o el viernes a las 10.",
      notGiven: "(aún no indicado)",
      requested: "horario solicitado",
      faq: [
        [/comisi|cobr|costo|cargo|pagar/i, "No hay comisiones ni cargos, y nosotros pagamos los gastos de cierre habituales. La oferta que acepte es lo que recibe, menos lo que deba sobre la propiedad."],
        [/hipoteca|\bdebo\b|\bdebe\b|gravamen|impuesto|ejecuci|embargo|subasta|atrasad|foreclos|remate|quitar(me)? la casa|perder (la|mi) casa/i, "Si el precio de venta cubre lo que debe, la hipoteca, los gravámenes y los impuestos atrasados se pagan con la venta al cierre. Si podría deber más de lo que vale la casa, el equipo revisará los números con usted honestamente. Si enfrenta una ejecución hipotecaria, el tiempo importa, y un consejero de vivienda aprobado por HUD también puede ayudarle gratis: hud.gov o 800-569-4287."],
        [/rápid|cuánto tiempo|\bcerrar\b|\bcierre\b|\bd[ií]as?\b/i, "Podemos cerrar en tan solo 7 días una vez que el título esté limpio, o en una fecha posterior que usted elija."],
        [/condici|repar|arregl|limpi|daño/i, "Compramos casas tal como están, en cualquier condición. Sin reparaciones, sin limpieza, sin visitas."],
        [/estafa|confi|real|segur|legít/i, "Buena pregunta. Usted nunca nos paga nada, y cada cierre se hace con una compañía de títulos o un abogado con licencia; su dinero nunca pasa por nuestras manos."],
        [/dónde|donde|estado|arizona|florida|tennessee|carolina/i, "Nos enfocamos en Arizona, Florida, Tennessee y Carolina del Norte, y compramos en todo el país con compradores locales asociados."],
        [/cómo funciona|como funciona|proceso|pasos/i, "Es sencillo: nos cuenta de la casa, la revisamos y le enviamos una oferta por escrito sin compromiso, y usted elige la fecha de cierre."],
        [/cuánto|cuanto|vale|precio|valor/i, "La oferta llega después de que el equipo revisa la propiedad, así que no puedo darle un número aquí. Una llamada rápida es la forma más fácil de obtener una oferta real."],
        [/inquilin|renta|arrend/i, "Sí, compramos casas con inquilinos y respetamos el contrato existente."],
        [/hered|sucesi|testament/i, "Compramos propiedades heredadas y en sucesión con frecuencia, y podemos trabajar con su abogado."]
      ]
    }
  }[LANG];

  // ------------------------------------------------------------ state

  function load() {
    try { return JSON.parse(window.sessionStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
  var state = load() || { v: 1, mode: "", history: [], sig: "", transcript: [], chips: [], g: { step: "intent", data: {} }, open: false };
  function save() {
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function pac() { return window.PAC || {}; }
  function track(name, params) { try { if (pac().track) pac().track(name, params || {}); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------ DOM

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(path, vb) {
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg viewBox="' + (vb || "0 0 24 24") + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
    return wrap.firstChild;
  }
  var ICON_CHAT = '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>';
  var ICON_SEND = '<path d="M4 12l16-8-6 16-2.5-6.5z"/>';
  var HOUSE = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#1E4FA3"/><path d="M8 21l12-10 12 10v11H8z" fill="#fff"/><rect x="17" y="24" width="6" height="8" fill="#F59E0B"/></svg>';

  // Turn phone numbers, emails and https links in plain text into links, without innerHTML.
  function richText(text) {
    var frag = document.createDocumentFragment();
    var re = /(https?:\/\/[^\s)]+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\bhud\.gov\b)/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var s = m[0];
      var href = /^https?:/.test(s) ? s : s.indexOf("@") > 0 ? "mailto:" + s : /hud\.gov/.test(s) ? "https://www.hud.gov/" : "tel:+1" + s.replace(/\D/g, "").slice(-10);
      var a = el("a", { href: href, text: s });
      if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      frag.appendChild(a);
      last = m.index + s.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  var root, launcher, panel, log, chipsBox, form, input, sendBtn, teaser, statusEl;
  function showMode() { if (statusEl) statusEl.textContent = state.mode === "ai" ? T.status : T.statusGuided; }

  function build() {
    root = el("div", { class: "pac-chat", "data-open": "false" });
    var icon = el("span", { class: "pac-ico" }, [svg(ICON_CHAT), el("span", { class: "pac-dot" })]);
    launcher = el("button", { class: "pac-launcher", type: "button", "aria-expanded": "false", "aria-controls": "pac-panel", "aria-label": T.launcher }, [icon, el("span", { class: "pac-label", text: T.launcher })]);
    launcher.addEventListener("click", function () { openPanel(true); });

    var avatar = el("span", { class: "pac-avatar" });
    avatar.innerHTML = HOUSE;
    var closeBtn = el("button", { class: "pac-close", type: "button", "aria-label": T.close, text: "×" });
    closeBtn.addEventListener("click", function () { closePanel(true); });
    var head = el("div", { class: "pac-head" }, [avatar, el("div", { class: "pac-title" }, [el("h2", { id: "pac-title", text: T.title }), statusEl = el("p", { text: state.mode === "ai" ? T.status : T.statusGuided })]), closeBtn]);

    log = el("div", { class: "pac-log", role: "log", "aria-live": "polite", "aria-relevant": "additions" });
    chipsBox = el("div", { class: "pac-chips" });

    input = el("textarea", { id: "pac-input", rows: "1", maxlength: "1500", placeholder: T.placeholder, autocomplete: "off" });
    sendBtn = el("button", { class: "pac-send", type: "submit", "aria-label": T.send }, [svg(ICON_SEND)]);
    form = el("form", { class: "pac-compose", novalidate: "" }, [el("label", { class: "pac-sr", for: "pac-input", text: T.input }), input, sendBtn]);
    form.addEventListener("submit", function (e) { e.preventDefault(); submitInput(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitInput(); }
    });
    input.addEventListener("input", grow);

    // Short screens (phones in landscape) get the short notice, so the conversation keeps its room.
    var longFoot = el("span", { class: "pac-foot-long" }, [T.foot]);
    if (PHONE) longFoot.appendChild(el("a", { href: "tel:" + PHONE_TEL, text: PHONE }));
    longFoot.appendChild(document.createTextNode(". "));
    var foot = el("div", { class: "pac-foot" }, [longFoot, el("span", { class: "pac-foot-short", text: T.footShort })]);
    foot.appendChild(el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: T.privacy }));

    panel = el("section", { id: "pac-panel", class: "pac-panel", role: "dialog", "aria-labelledby": "pac-title", hidden: "" }, [head, log, chipsBox, form, foot]);
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(true); });

    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);
  }

  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  // ------------------------------------------------------------ transcript

  function renderItem(item) {
    if (item.kind === "card") return renderCard(item);
    var bubble = el("div", { class: "pac-msg " + (item.who === "me" ? "me" : "bot") });
    bubble.appendChild(item.who === "me" ? document.createTextNode(item.text) : richText(item.text));
    return bubble;
  }

  function renderCard(item) {
    var card = el("div", { class: "pac-card" });
    var d = item.data || {};
    if (d.type === "booking") {
      card.appendChild(el("b", { text: d.requested ? T.requestedCall : T.booked }));
      card.appendChild(el("p", { class: "pac-when", text: d.when }));
      var acts = el("div", { class: "pac-actions" });
      if (d.calendarUrl && /^https:\/\/calendar\.google\.com\//.test(d.calendarUrl)) {
        acts.appendChild(el("a", { class: "pac-action", href: d.calendarUrl, target: "_blank", rel: "noopener", text: T.addCal }));
      }
      if (PHONE) acts.appendChild(el("a", { class: "pac-action", href: "tel:" + PHONE_TEL, text: T.call + " " + PHONE }));
      card.appendChild(acts);
    } else if (d.type === "contact") {
      var a2 = el("div", { class: "pac-actions" });
      if (PHONE) {
        a2.appendChild(el("a", { class: "pac-action", href: "tel:" + PHONE_TEL, text: T.call + " " + PHONE }));
        a2.appendChild(el("a", { class: "pac-action", href: "sms:" + PHONE_TEL, text: T.text }));
      }
      card.appendChild(a2);
    } else if (d.type === "summary") {
      card.appendChild(el("pre", { text: d.text }));
      var copyBtn = el("button", { class: "pac-action", type: "button", text: T.copy });
      copyBtn.addEventListener("click", function () {
        var pre = card.querySelector("pre");
        var done = function () { copyBtn.textContent = T.copied; };
        var fail = function () {
          var r = document.createRange(); r.selectNodeContents(pre);
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.text).then(done, fail);
        else fail();
      });
      card.appendChild(el("div", { class: "pac-actions" }, [copyBtn]));
    }
    return card;
  }

  function push(item) {
    state.transcript.push(item);
    if (state.transcript.length > 120) state.transcript.splice(0, state.transcript.length - 120);
    save();
    log.appendChild(renderItem(item));
    scrollDown();
  }
  function bot(text) { push({ who: "bot", text: text }); }
  function me(text) { push({ who: "me", text: text }); }
  function card(data) { push({ kind: "card", data: data }); }

  function setChips(list) {
    state.chips = (list || []).slice(0, 8);
    save();
    renderChips();
  }
  function renderChips() {
    chipsBox.textContent = "";
    state.chips.forEach(function (c) {
      var chip = typeof c === "string" ? { label: c } : c;
      var b = el("button", { class: "pac-chip" + (chip.slot ? " slot" : ""), type: "button", text: chip.label });
      b.addEventListener("click", function () { input.focus({ preventScroll: true }); send(chip.value || chip.label); });
      chipsBox.appendChild(b);
    });
  }

  var typingEl = null;
  function typing(on) {
    if (on && !typingEl) {
      typingEl = el("div", { class: "pac-typing", "aria-label": "…" }, [el("span"), el("span"), el("span")]);
      log.appendChild(typingEl);
      scrollDown();
    } else if (!on && typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  var busy = false;
  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    typing(b);
  }

  // ------------------------------------------------------------ open / close

  // On small screens the panel covers the page: lock scrolling and make the page inert.
  var inerted = [];
  function lockScroll(on) {
    var modal = on && smallScreen();
    document.documentElement.classList.toggle("pac-lock", modal);
    if (modal) {
      panel.setAttribute("aria-modal", "true");
      Array.prototype.forEach.call(document.body.children, function (n) {
        if (n !== root && !n.inert) { n.inert = true; inerted.push(n); }
      });
    } else {
      panel.removeAttribute("aria-modal");
      inerted.forEach(function (n) { n.inert = false; });
      inerted = [];
    }
  }

  function openPanel(userAction) {
    hideTeaser(true);
    panel.hidden = false;
    root.setAttribute("data-open", "true");
    launcher.setAttribute("aria-expanded", "true");
    state.open = true;
    save();
    lockScroll(true);
    if (userAction) track("chat_open", {});
    ensureStarted();
    scrollDown();
    if (userAction) window.setTimeout(function () { input.focus({ preventScroll: true }); }, 50);
  }

  function closePanel(userAction) {
    panel.hidden = true;
    root.setAttribute("data-open", "false");
    launcher.setAttribute("aria-expanded", "false");
    state.open = false;
    save();
    lockScroll(false);
    if (userAction) launcher.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ teaser

  function hideTeaser(remember) {
    if (teaser) { teaser.remove(); teaser = null; }
    if (remember) { try { window.localStorage.setItem(TEASE_KEY, "1"); } catch (e) { /* ignore */ } }
  }

  function scheduleTeaser() {
    var seen = false;
    try { seen = window.localStorage.getItem(TEASE_KEY) === "1"; } catch (e) { seen = false; }
    if (seen || state.transcript.length) return;
    var small = smallScreen();
    window.setTimeout(function () {
      if (state.open || state.transcript.length) return;
      var active = document.activeElement;
      if (active && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return; // don't interrupt someone filling the form
      var x = el("button", { class: "pac-teaser-close", type: "button", "aria-label": T.teaseClose, text: "×" });
      teaser = el("div", { class: "pac-teaser", role: "status" }, [el("b", { text: T.teaseTitle }), T.teaseBody, x]);
      x.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(true); });
      teaser.addEventListener("click", function () { openPanel(true); });
      root.appendChild(teaser);
    }, small ? 30000 : 18000);
  }

  // ------------------------------------------------------------ mode selection

  var modeReady = null;
  function decideMode() {
    if (state.mode) return Promise.resolve(state.mode);
    if (modeReady) return modeReady;
    if (!ENDPOINT || !window.fetch) { state.mode = "guided"; save(); showMode(); return Promise.resolve("guided"); }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    modeReady = fetch(ENDPOINT + "/health", { method: "GET", signal: ctrl ? ctrl.signal : undefined, credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.ok && j.ai ? "ai" : "guided"; })
      .catch(function () { return "guided"; })
      .then(function (m) { window.clearTimeout(timer); state.mode = m; save(); showMode(); return m; });
    return modeReady;
  }

  function ensureStarted() {
    if (state.transcript.length) return;
    bot(T.greet);
    setChips(T.chips);
    decideMode();
  }

  // ------------------------------------------------------------ sending

  function submitInput() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    grow();
    send(text);
  }

  var lastChips = [];
  function send(text) {
    if (busy) return;
    lastChips = state.chips.slice();
    me(text);
    setChips([]);
    track("chat_message", { mode: state.mode || "pending" });
    if (text === T.chips[3]) { // Talk to a person
      bot(T.person);
      card({ type: "contact" });
      if (state.mode !== "ai") { state.g.step = "callback"; save(); }
      return;
    }
    setBusy(true);
    decideMode().then(function (mode) {
      if (mode === "ai") aiSend(text, false);
      else { window.setTimeout(function () { setBusy(false); guided(text); }, 450); }
    });
  }

  function context() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { tz = ""; }
    var local = "";
    try {
      local = new Date().toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { local = String(new Date()); }
    return { page: window.location.pathname, lang: LANG, localTime: local, timeZone: tz };
  }

  var failures = 0;
  function aiSend(text, isRetry) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 75000); // the Worker stops itself at about 45 s
    fetch(ENDPOINT + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({ message: text, history: state.history, sig: state.sig || "", context: context() })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      window.clearTimeout(timer);
      if (res.status === 200 && res.body && typeof res.body.reply === "string") {
        failures = 0;
        if (Array.isArray(res.body.history)) { state.history = res.body.history; state.sig = res.body.sig || ""; }
        setBusy(false);
        bot(res.body.reply);
        handleUi(res.body.ui || {});
        var leads = res.body.leads || [];
        leads.forEach(function (l) {
          if (l.phone || l.email) state.contact = { name: l.name || "", phone: l.phone || "", email: l.email || "" };
          deliverLead(l);
        });
        var ui = res.body.ui || {};
        if (leads.some(function (l) { return l.type !== "do_not_contact"; }) || ui.booking || ui.saved) state.leadSent = true;
        if (ui.stopped) {
          state.stopped = ui.stopped === true ? "all" : ui.stopped;
          if (state.stopped === "all") state.optedOut = true;
        }
        save();
        return;
      }
      var err = res.body && res.body.error;
      if ((err === "reset" || err === "too_long") && !isRetry) {
        state.history = []; state.sig = ""; save();
        if (err === "too_long") bot(T.fresh);
        return aiSend(text, true);
      }
      if (err === "ai_unavailable") return switchToGuided(text);
      troubled(text);
    }).catch(function () {
      window.clearTimeout(timer);
      troubled(text);
    });
  }

  function troubled(text) {
    setBusy(false);
    failures++;
    if (failures >= 2) return switchToGuided(text);
    bot(T.trouble);
    setChips([{ label: T.tryAgain, value: text }]);
  }

  // `pending` is the message that could not be answered; a stop request in it is still honoured.
  function switchToGuided(pending) {
    setBusy(false);
    state.mode = "guided";
    showMode();
    var stopping = !!(pending && classifyStop(pending));
    if (state.leadSent || state.optedOut) {
      // The team already has this seller's details (or they asked us to stop): don't collect them again.
      state.g = { step: "done", data: state.g && state.g.data ? state.g.data : {} };
      save();
      if (stopping) { guided(pending); return; }
      if (state.optedOut) { bot(T.gStopDoneFor("all")); return; }
      bot(T.gAfter);
      card({ type: "contact" });
      return;
    }
    state.g = { step: "address", data: state.g && state.g.data ? state.g.data : {} };
    save();
    if (stopping) { state.g.step = "intent"; guided(pending); return; }
    bot(T.switching);
    bot(T.gAddress);
  }

  function handleUi(ui) {
    if (ui.slots && ui.slots.length) {
      setChips(ui.slots.map(function (s) { return { label: s.label, value: s.label, slot: true }; }));
    }
    if (ui.booking) {
      card({ type: "booking", when: ui.booking.when, calendarUrl: ui.booking.calendarUrl, requested: !!ui.booking.requested });
    }
  }

  // Leads the Worker could not email itself go through the site's form endpoint.
  function deliverLead(lead) {
    if (lead.type === "do_not_contact") {
      if (lead.delivered) return;
      var sent = pac().submitLead
        ? pac().submitLead(stopNotice(lead.name, lead.phone, lead.email, lead.note, lead.channels, lead.transcript, "website-chat"))
        : Promise.resolve({ ok: false });
      sent.then(function (r) {
        if (r && r.ok) return;
        // The seller was told it's done; it isn't until the team has it. Say how to reach us.
        console.warn("chat stop-request email fallback failed");
        state.stopFailed = true;
        save();
        bot(T.gStopFail);
      });
      return;
    }
    var mapped = {
      _subject: (lead.appointment ? (lead.appointment.reserved === false ? "Call request (confirm the time) " : "Booked call ") + lead.appointment.ownerLabel + ": " : "New seller lead (chat): ") + [lead.address, lead.city, lead.state].filter(Boolean).join(", "),
      address: lead.address, city: lead.city, state: lead.state, zip: lead.zip,
      name: lead.name, phone: lead.phone, email: lead.email, smsConsent: lead.smsConsent,
      propertyType: lead.propertyType, condition: lead.condition, occupancy: lead.occupancy,
      timeline: lead.timeline, reason: lead.reason, askingPrice: lead.askingPrice, notes: lead.notes,
      callTime: lead.appointment ? lead.appointment.ownerLabel + " (seller: " + lead.appointment.sellerLabel + ")" + (lead.appointment.reserved === false ? " - requested, please confirm" : "") : lead.callbackPreference,
      textingQuestion: lead.textingConsent ? lead.textingConsent.question : "", textingAnswer: lead.textingConsent ? lead.textingConsent.answer : "",
      addToCalendar: lead.appointment ? lead.appointment.ownerCalendarUrl : "",
      source: "website-chat", page: lead.page, submittedAt: lead.submittedAt, market: lead.state || "Nationwide",
      transcript: lead.transcript || ""
    };
    if (!lead.delivered && pac().submitLead) {
      pac().submitLead(mapped).then(function (r) { if (!r || !r.ok) console.warn("chat lead email fallback failed"); });
    }
    if (pac().trackLead) pac().trackLead({ source: "website-chat", market: mapped.market, state: lead.state });
  }

  // ------------------------------------------------------------ guided mode

  function faqAnswer(text) {
    for (var i = 0; i < T.faq.length; i++) if (T.faq[i][0].test(text)) return T.faq[i][1];
    return "";
  }

  function isQuestion(text) {
    return /\?\s*$/.test(text) || /^(how|what|when|why|who|where|do|does|did|can|could|is|are|will|would|should|qu[eé]|c[oó]mo|cu[aá]ndo|por qu[eé]|d[oó]nde|puede|tiene|hay)\b/i.test(text.trim());
  }
  // A day or time someone would actually type: "Friday at 10", "tomorrow afternoon", "3pm".
  // Whole words only, so "money", "amount" or "Am I..." don't count, and no bare digits.
  var TIME_RE = /(^|[^\wáéíóúñ])(\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.?|p\.m\.?)|\d{1,2}:\d{2}|(at|around|after|before|by|from|between|a las|despu[eé]s de las|antes de las|entre las|de)\s+\d{1,2}|\d{1,2}\s*(-|\u2013|to|and|a|y)\s*\d{1,2}\s*(am|pm)?|noon|midday|mornings?|afternoons?|evenings?|nights?|tonight|today|tomorrow|asap|any ?time|whenever|weekends?|weekdays?|(mon|tues?|wed(nes)?|thu(rs)?|fri|satur|sun)days?|mon|tue|wed|thu|fri|sat|sun|ma[nñ]anas?|mediod[ií]a|tardes?|noches?|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?|fines? de semana|cuando sea|lo antes|ahora( mismo)?)(?![\wáéíóúñ])/i;
  // "Now" only as an answer ("now", "right now", "call me now"), not "do you pay cash now?".
  var NOW_RE = /^(right )?now\b|\bright now\b|\b(call|ll[aá]men)(me)? (me )?(right )?now\b/i;
  function looksLikeTime(text) { var t = plain(text); return TIME_RE.test(t) || NOW_RE.test(t); }
  function extractPhone(text) {
    var m = String(text).match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!m) return null;
    var d = m[0].replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    if (d.length !== 10 || /^[01]/.test(d)) return null;
    return { formatted: "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6), raw: m[0] };
  }

  function extractEmail(text) {
    var m = String(text).match(/[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[A-Za-z]{2,}/);
    return m ? m[0].slice(0, 200) : "";
  }

  // Curly quotes (iPhone "smart punctuation") and spacing, made plain for matching.
  function plain(text) {
    return String(text).replace(/[\u2018\u2019\u02bc\u00b4`]/g, "'").replace(/\s+/g, " ").trim();
  }

  // A reply made only of yes-words ("yes", "sure, go ahead", "sí, claro", "yes, no problem") is a clear yes.
  var YES_RE = /^(?:y|yes|yeah|yep|yup|sure|ok|okay|of course|go ahead|s[ií]|claro(?: que s[ií])?|por supuesto|est[aá] bien|adelante)(?:[\s,.!]+(?:yes|yeah|sure|ok|okay|of course|go ahead|please|thanks|thank you|that's fine|thats fine|is fine|fine|text me|no problem|no worries|that works|works for me|sounds good|s[ií]|claro(?: que s[ií])?|por supuesto|est[aá] bien|adelante|por favor|gracias|no hay problema))*[\s.!]*$/i;
  var NO_RE = /\b(no|not|nope|nah|don't|dont|do not|never|only|solo|nunca|sin|prefiero llamadas)\b/i;

  // ------------------------------------------------------------ stop requests
  // A request for US to stop contacting them, and nothing else: "the bank won't stop
  // calling me", "don't call me before 5" or "remove me from the deed" are not opt-outs.
  // Each clause is checked on its own, so "don't call me, text me instead" stops calls only.
  var STOP_ONLY = /^(please |just |ok |okay )?(stop|stop all|stop it|stop now|stop please|stop already|quit|end|cancel|revoke|unsubscribe|opt[- ]?out|opt me out|remove me|leave me alone|cancelar|alto|basta|ya basta|parar?|d[eé]jenme en paz)( please| por favor| now| it)?[\s.!]*$/i;
  var LEAD_IN = "^(?:(?:please|pls|plz|just|and|so|then|now|ok|okay|can you|could you|would you|will you|i want you to|i need you to|i'd like you to|y'all|you guys|guys)\\s+)*";
  var TIME_AFTER = "(?!\\s*(?:before|after|until|till|til|at|on|between|during|in the|this|today|tonight|tomorrow|while|when|antes|despu[eé]s|hasta|entre|a las|por la|en la|hoy|ma[nñ]ana)\\b)";
  var STOP_PATTERNS = [
    [new RegExp(LEAD_IN + "(?:stop|quit|cease)\\s+(calling|phoning|texting|messaging|contacting|emailing|e-mailing|bothering|harassing)\\b", "i")],
    [new RegExp(LEAD_IN + "(?:do not|don't|dont|never|no longer)\\s+(call|phone|text|message|contact|email|e-mail|bother)\\s+me\\b" + TIME_AFTER, "i")],
    [/\bno more (calls|phone calls|texts|text messages|messages|emails|e-mails|contact)\b/i],
    [/\b(?:remove|take) (?:me|my (?:number|phone|email|info|information|name)) (?:from|off) (?:your|the|this|all) (?:(call|text|texting|email|mailing|contact) )?(?:list|lists|database)\b/i],
    [new RegExp("^(?:(?:por favor|ya|y|pues)\\s+)*(?:no me (llamen|llamen m[aá]s|escriban|manden|env[ií]en|contacten|molesten|vuelvan a \\w+)|dejen de (llamar\\w*|escribir\\w*|mandar\\w*|enviar\\w*|contactar\\w*|molestar\\w*))\\b" + TIME_AFTER, "i")]
  ];
  function channelOf(word, clause) {
    var w = String(word || "").toLowerCase();
    if (/^(call|calls|calling|phone|phoning|phone calls|llam)/.test(w)) return "calls";
    if (/^(text|texts|texting|message|messages|messaging|text messages|mand|envi)/.test(w)) return /e-?mail|correo/i.test(clause) ? "all" : "texts";
    if (/^(e-?mail|emails|e-mails|e-mailing|emailing)/.test(w)) return "email";
    if (/^escrib/.test(w)) return /mensaje|texto/i.test(clause) ? "texts" : /correo/i.test(clause) ? "email" : "all";
    return "all";
  }
  /** "" when the message isn't a stop request, else the channel to stop: all, calls, texts or email. */
  function classifyStop(text) {
    var t = plain(text);
    if (STOP_ONLY.test(t)) return "all";
    var found = {};
    t.split(/[.!?;,:\u00a1\u00bf]+|\s+but\s+|\s+pero\s+/i).forEach(function (clause) {
      clause = clause.trim();
      if (!clause) return;
      for (var i = 0; i < STOP_PATTERNS.length; i++) {
        var m = STOP_PATTERNS[i][0].exec(clause);
        if (!m) continue;
        var ch = channelOf(m.slice(1).filter(Boolean)[0], clause);
        // "stop calling and texting me" names more than one channel.
        if (ch === "calls" && /\b(text|texting|texts|message)/i.test(clause)) ch = "all";
        if (ch === "texts" && /\b(call|calling|calls)\b/i.test(clause)) ch = "all";
        found[ch] = true;
      }
    });
    var keys = Object.keys(found);
    if (!keys.length) return "";
    return keys.length === 1 ? keys[0] : "all";
  }

  function chatTranscript() {
    var out = state.transcript.filter(function (i) { return i && i.text; })
      .map(function (i) { return (i.who === "me" ? "Seller: " : "Assistant: ") + i.text; }).join("\n");
    return out.length > 6000 ? "..." + out.slice(-6000) : out;
  }

  // Same wording as the Worker's owner email (worker/src/leads.js STOP_WORDING).
  var STOP_WORDING = {
    all: ["DO NOT CONTACT", "Stop all calls, texts and email to this person. Remove them from your call, text and email lists and cancel any call they booked."],
    calls: ["DO NOT CALL", "Stop calling this person. Remove them from your call list and cancel any call they booked. Texts and email are still OK only if they agreed to them."],
    texts: ["DO NOT TEXT", "Stop texting this person. Remove them from your text list. Calls and email are still OK, and keep any call they booked."],
    email: ["DO NOT EMAIL", "Stop emailing this person. Remove them from your email list. Calls are still OK, and keep any call they booked."]
  };
  function stopNotice(name, phone, email, words, channels, transcript, source) {
    var w = STOP_WORDING[channels] || STOP_WORDING.all;
    return {
      _subject: w[0] + ": " + [name, phone, email].filter(Boolean).join(" "),
      type: "do_not_contact", channels: STOP_WORDING[channels] ? channels : "all", action: w[1],
      name: name || "", phone: phone || "", email: email || "", note: String(words || "").slice(0, 300),
      source: source, page: window.location.pathname, lang: LANG, submittedAt: new Date().toISOString(),
      transcript: transcript || ""
    };
  }

  function guidedStop(phone, email, words, channel) {
    var g = state.g;
    channel = STOP_WORDING[channel] ? channel : "all";
    g.step = "stopping";
    save();
    setBusy(true);
    var name = g.data.name || (state.contact && state.contact.name) || "";
    var notice = stopNotice(name, phone, email, words, channel, chatTranscript(), "website-chat-guided");
    var submit = pac().submitLead ? pac().submitLead(notice) : Promise.resolve({ ok: false });
    submit.then(function (r) {
      setBusy(false);
      if (r && r.ok) {
        state.stopFailed = false;
        state.stopped = channel;
        if (channel === "all") state.optedOut = true;
        bot(T.gStopDoneFor(channel));
      } else {
        state.stopFailed = true; // never claim it's done when the team didn't get it
        bot(T.gStopFail);
      }
      g.step = "done";
      save();
    });
  }

  // A stop request typed anywhere in the guided chat.
  function handleStop(channel, text) {
    var g = state.g;
    var d = g.data;
    var bare = STOP_ONLY.test(plain(text));
    // Answering the texting question with STOP or "don't text me" declines texts; the call goes ahead.
    if (g.step === "consent" && (channel === "texts" || bare)) {
      d.smsConsent = false;
      d.consentReply = text.slice(0, 200);
      askTime(T.gNoTexts);
      return;
    }
    var midFlow = !state.leadSent && !/^(intent|faq|done)$/.test(g.step);
    // Before anything was sent, "no texts" or "no email" just changes how we follow up.
    if (midFlow && channel === "texts") {
      d.noTexts = true;
      d.smsConsent = false;
      d.consentReply = d.consentReply || text.slice(0, 200);
      bot(T.gNoTextsMid);
      reprompt();
      return;
    }
    if (midFlow && channel === "email") {
      d.noEmail = true;
      bot(T.gNoEmailMid);
      reprompt();
      return;
    }
    // Before anything was sent, "don't call me" moves the follow-up to email.
    if (midFlow && channel === "calls" && g.step !== "email") {
      d.noCalls = true;
      g.step = "email";
      bot(T.gNoCalls);
      return;
    }
    // Anything else: send it with what we know, or ask once for the number.
    var c = state.contact || {};
    var phone = d.phone || c.phone || "";
    var email = d.email || c.email || "";
    if (phone || email) { guidedStop(phone, email, text, channel); return; }
    g.step = "stop";
    g.stopTries = 0;
    g.stopChannel = channel;
    g.stopWords = text.slice(0, 300);
    bot(T.gStopAsk);
  }

  // Ask the current step's question again (after a side remark such as "no texts please").
  function reprompt() {
    var g = state.g;
    switch (g.step) {
      case "address": bot(T.gAddress); break;
      case "condition": bot(T.gCondition); setChips(T.gConditionChips); break;
      case "timeline": bot(T.gTimeline); setChips(T.gTimelineChips); break;
      case "name": bot(T.gName); break;
      case "phone": bot(T.gPhone(String(g.data.name || "").split(/\s+/)[0])); break;
      case "email": bot(T.gEmail); break;
      case "callback": bot(T.gCallbackName); break;
      case "time":
      case "timeConfirm": askTime(); break;
    }
  }

  function askTime(lead) {
    state.g.step = "time";
    var times = suggestTimes();
    if (lead) bot(lead);
    bot(times.length ? T.gTime : T.gNoTimes(hoursText()));
    setChips([{ label: T.gTimeAsap }].concat(times));
  }

  function wantsOffer(text) {
    return /offer|sell|book|call|yes|let'?s|oferta|vender|llamada|programar|sí|adelante/i.test(text);
  }

  function parseState(text) {
    var m = String(text).toUpperCase().match(/\b(AZ|FL|TN|NC|ARIZONA|FLORIDA|TENNESSEE|NORTH CAROLINA)\b/);
    if (!m) return "";
    return { ARIZONA: "AZ", FLORIDA: "FL", TENNESSEE: "TN", "NORTH CAROLINA": "NC" }[m[1]] || m[1];
  }

  // Business-hours call options in the visitor's time zone (requests, confirmed by the team).
  function zonedParts(ms, tz) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
  }
  function zoned(y, m, d, hh, mm, tz) {
    var guess = Date.UTC(y, m - 1, d, hh, mm);
    var off = function (ms) { var p = zonedParts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; };
    var o1 = off(guess);
    var utc = guess - o1;
    var o2 = off(utc);
    return o2 === o1 ? utc : guess - o2;
  }
  function hoursText() {
    try {
      var loc = LANG === "es" ? "es-US" : "en-US";
      var fmt = function (h) { return new Intl.DateTimeFormat(loc, { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h))); };
      var zone = new Intl.DateTimeFormat(loc, { timeZone: HOURS.tz, timeZoneName: "short" }).formatToParts(new Date())
        .filter(function (p) { return p.type === "timeZoneName"; })[0];
      return fmt(HOURS.start) + "–" + fmt(HOURS.end) + (zone ? " " + zone.value : "");
    } catch (e) { return HOURS.start + ":00–" + HOURS.end + ":00"; }
  }

  function suggestTimes() {
    var out = [];
    try {
      var now = Date.now();
      var notice = typeof HOURS.noticeMinutes === "number" ? HOURS.noticeMinutes : 60;
      var earliest = now + notice * 60000;
      var today = zonedParts(now, HOURS.tz);
      for (var i = 0; i <= 6 && out.length < 4; i++) {
        var cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
        var wd = ((cal.getUTCDay() + 6) % 7) + 1;
        if (HOURS.days.indexOf(wd) < 0) continue;
        var perDay = 0;
        for (var h = HOURS.start; h < HOURS.end && perDay < 2 && out.length < 4; h += 3) {
          var ms = zoned(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), h, 0, HOURS.tz);
          if (ms < earliest) continue;
          var localHour = new Date(ms).getHours(); // the visitor's own clock
          if (localHour < 7 || localHour >= 21) continue;
          out.push(ms);
          perDay++;
        }
      }
    } catch (e) { return []; }
    var loc = LANG === "es" ? "es-US" : "en-US";
    return out.map(function (ms) {
      var dfmt = new Intl.DateTimeFormat(loc, { weekday: "short", month: "short", day: "numeric" }).format(new Date(ms));
      var tfmt = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ms));
      return { label: LANG === "es" ? dfmt + " a las " + tfmt : dfmt + " at " + tfmt, ms: ms, slot: true };
    });
  }

  function guided(text) {
    var g = state.g;
    var data = g.data;
    var answer;
    var stopWhat = /^(stop|stopping|sending)$/.test(g.step) ? "" : classifyStop(text);
    if (stopWhat) {
      handleStop(stopWhat, text);
      save();
      return;
    }
    switch (g.step) {
      case "intent":
      case "faq":
        answer = faqAnswer(text);
        if (answer && !(g.step === "faq" && wantsOffer(text) && !/\?/.test(text))) {
          bot(answer);
          bot(T.gOffer);
          setChips(T.gOfferChips);
          g.step = "faq";
          break;
        }
        if (g.step === "faq" && text === T.gOfferChips[1]) { bot(T.gAsk); break; }
        g.step = "address";
        bot(T.gAddress);
        break;
      case "address":
        if (isQuestion(text)) {
          bot(faqAnswer(text) || T.gQuestion);
          bot(T.gAddress);
          break;
        }
        data.address = text.slice(0, 200);
        data.state = parseState(text);
        g.step = "condition";
        bot(T.gCondition);
        setChips(T.gConditionChips);
        break;
      case "condition":
        data.condition = text.slice(0, 200);
        g.step = "timeline";
        bot(T.gTimeline);
        setChips(T.gTimelineChips);
        break;
      case "timeline":
        data.timeline = text.slice(0, 200);
        g.step = "name";
        bot(T.gName);
        break;
      case "name":
        data.name = text.slice(0, 120);
        g.step = "phone";
        bot(T.gPhone(data.name.split(/\s+/)[0]));
        break;
      case "phone":
        var typedEmail = extractEmail(text);
        if (text === T.gEmailInstead || (typedEmail && !extractPhone(text))) {
          if (typedEmail) { data.email = typedEmail; finishEmailOnly(); return; }
          g.step = "email";
          bot(T.gEmail);
          break;
        }
        var digits = text.replace(/\D/g, "");
        if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
        if (digits.length !== 10 || /^[01]/.test(digits)) {
          bot(T.gPhoneBad);
          setChips([T.gEmailInstead, T.chips[3]]);
          break;
        }
        data.phone = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
        if (data.noTexts) { askTime(); break; }
        g.step = "consent";
        bot(T.gConsent);
        setChips(T.gConsentChips);
        break;
      case "email":
        var em = extractEmail(text);
        if (!em && /^(no|nope|nah|no thanks|no gracias)\b/i.test(plain(text))) { bot(T.gNeutral); g.step = "done"; break; }
        if (!em) { bot(T.gEmailBad); setChips([T.chips[3]]); break; }
        data.email = em;
        finishEmailOnly();
        return;
      case "consent":
        // Only a clear yes counts. "OK but calls only" or anything unclear is not consent.
        var said = text.trim();
        var p = plain(said);
        var yes = said === T.gConsentChips[0] || YES_RE.test(p);
        var no = said === T.gConsentChips[1] || NO_RE.test(p.replace(/\b(no problem|no worries|no hay problema)\b/gi, ""));
        if ((yes === no) && !g.consentAsked) { // unclear, or both: ask once with the buttons
          g.consentAsked = true;
          bot(T.gConsentAgain);
          setChips(T.gConsentChips);
          break;
        }
        data.smsConsent = yes && !no;
        data.consentReply = said.slice(0, 200);
        askTime();
        break;
      case "time":
        var chosen = (lastChips || []).filter(function (c) { return c && c.ms && c.label === text; })[0];
        var notice = typeof HOURS.noticeMinutes === "number" ? HOURS.noticeMinutes : 60;
        if (chosen && chosen.ms < Date.now() + notice * 60000) {
          bot(T.gStale);
          setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
          break;
        }
        if (!chosen && text !== T.gTimeAsap) {
          if (!looksLikeTime(text)) {
            if (isQuestion(text)) bot(faqAnswer(text) || T.gQuestion);
            bot(T.gTimeHint);
            setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
            break;
          }
          if (isQuestion(text)) {
            // A time inside a question ("can you call at 3?", "can you close by Friday?"): answer, then check.
            var fa = faqAnswer(text);
            if (fa) bot(fa);
            g.pendingTime = text.slice(0, 120);
            g.step = "timeConfirm";
            bot(T.gTimeConfirm(g.pendingTime));
            setChips(T.gTimeConfirmChips);
            break;
          }
        }
        data.callTime = text.slice(0, 120);
        g.step = "sending";
        save();
        finishGuided();
        return;
      case "timeConfirm":
        var tp = plain(text);
        if (text === T.gTimeConfirmChips[0] || YES_RE.test(tp)) {
          data.callTime = g.pendingTime;
        } else if (looksLikeTime(text) && !isQuestion(text)) {
          data.callTime = text.slice(0, 120);
        } else {
          if (text !== T.gTimeConfirmChips[1] && !/^(no|nope|nah)\b/i.test(tp) && isQuestion(text)) bot(faqAnswer(text) || T.gQuestion);
          g.step = "time";
          bot(T.gTimeHint);
          setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
          break;
        }
        g.step = "sending";
        save();
        finishGuided();
        return;
      case "callback":
        var ph = extractPhone(text);
        var ce = ph ? "" : extractEmail(text);
        var nm = plain(text.replace(ph ? ph.raw : ce, "")).replace(/[,;:.]+/g, " ")
          .replace(/\b(my name is|i'm|im|this is|me llamo|soy|call me|ll[aá]menme|please|por favor|at|al|my e-?mail is|e-?mail me|just|mi correo es|escr[ií]banme|a|me|is|es|you can|puede)\b/gi, " ")
          .replace(/\s+/g, " ").trim();
        if (nm && !isQuestion(nm) && !data.name) data.name = nm.slice(0, 120);
        if (!ph && ce) { data.email = ce; data.address = data.address || T.notGiven; finishEmailOnly(); return; }
        if (!ph) { bot(T.gCallbackName); break; }
        data.phone = ph.formatted;
        data.address = data.address || T.notGiven;
        if (data.noTexts) { askTime(); break; }
        g.step = "consent";
        bot(T.gConsent);
        setChips(T.gConsentChips);
        break;
      case "stop":
        var sp = extractPhone(text);
        var se = extractEmail(text);
        if (sp || se) { guidedStop(sp ? sp.formatted : "", se, (g.stopWords ? g.stopWords + " / " : "") + text, g.stopChannel); return; }
        if (!classifyStop(text) && (wantsOffer(text) || isQuestion(text))) {
          // They came to sell after all (or the "stop" was about something else): back to the offer.
          if (isQuestion(text)) bot(faqAnswer(text) || T.gQuestion);
          g.step = "address";
          bot(T.gAddress);
          break;
        }
        g.stopTries = (g.stopTries || 0) + 1;
        if (g.stopTries >= 2) { state.stopFailed = true; bot(T.gStopFail); g.step = "done"; break; }
        bot(T.gStopAsk);
        break;
      case "sending":
      case "stopping":
        return;
      default:
        // Never say "the team will reach out" unless a lead actually went out.
        bot(faqAnswer(text) || (state.stopFailed ? T.gStopFail
          : state.stopped ? T.gStopDoneFor(state.stopped)
            : state.leadSent ? T.gAfter : T.gNeutral));
    }
    save();
  }

  function guidedSummary(d) {
    return [
      (LANG === "es" ? "Nombre: " : "Name: ") + (d.name || ""),
      d.email && !d.phone ? (LANG === "es" ? "Correo: " : "Email: ") + d.email : (LANG === "es" ? "Teléfono: " : "Phone: ") + (d.phone || ""),
      (LANG === "es" ? "Propiedad: " : "Property: ") + (d.address || ""),
      (LANG === "es" ? "Condición: " : "Condition: ") + (d.condition || ""),
      (LANG === "es" ? "Plazo: " : "Timeline: ") + (d.timeline || ""),
      (LANG === "es" ? "Llamada: " : "Call: ") + (d.callTime || "")
    ].join("\n");
  }

  function finishEmailOnly() {
    var d = state.g.data;
    d.phone = "";
    d.smsConsent = false;
    d.callTime = T.emailOnly;
    state.g.step = "sending";
    save();
    finishGuided();
  }

  function finishGuided() {
    var d = state.g.data;
    var asap = d.callTime === T.gTimeAsap;
    var emailOnly = !d.phone && !!d.email;
    var lead = {
      _subject: "New seller lead (chat" + (emailOnly ? ", email only" : asap ? "" : ", call requested " + d.callTime) + "): " + d.address,
      address: d.address, city: "", state: d.state || "", zip: "",
      name: d.name, phone: d.phone || "", email: d.email || "", smsConsent: !!d.smsConsent,
      textingQuestion: d.phone && !d.noTexts ? T.gConsent : "", textingAnswer: d.phone ? (d.consentReply || "") : "",
      contactLimits: [d.noCalls && "no calls", (d.noTexts || !d.smsConsent) && "no texts", d.noEmail && "no email"].filter(Boolean).join(", ") + (d.noCalls || d.noTexts || d.noEmail ? " (asked in the chat)" : ""),
      condition: d.condition, timeline: d.timeline,
      callTime: emailOnly ? T.emailOnly : d.callTime + (asap ? "" : " (requested, please confirm)"),
      source: "website-chat-guided", page: window.location.pathname, lang: LANG,
      submittedAt: new Date().toISOString(), market: d.state || "Nationwide",
      transcript: chatTranscript()
    };
    setBusy(true);
    var submit = pac().submitLead ? pac().submitLead(lead) : Promise.resolve({ ok: false });
    submit.then(function (r) {
      setBusy(false);
      if (r && r.ok) {
        if (pac().trackLead) pac().trackLead({ source: "website-chat-guided", market: lead.market, state: lead.state });
        state.leadSent = true;
        if (emailOnly) bot(T.gDoneEmail(d.email));
        else {
          if (!asap) card({ type: "booking", when: d.callTime, requested: true });
          bot(T.gDone(asap ? "" : d.callTime, !!d.smsConsent));
        }
      } else {
        bot(T.gFail);
        card({ type: "summary", text: guidedSummary(d) });
        card({ type: "contact" });
      }
      state.g.step = "done";
      save();
    });
  }

  // ------------------------------------------------------------ boot

  function restore() {
    state.transcript.forEach(function (item) { log.appendChild(renderItem(item)); });
    renderChips();
    if (state.g && state.g.step === "sending") state.g.step = state.g.data && state.g.data.phone ? "time" : "email";
    if (state.g && state.g.step === "stopping") state.g.step = "stop";
    if (state.open && !smallScreen()) openPanel(false);
    else if (state.open) { state.open = false; save(); }
  }

  function watchScreenSize() {
    var mq = window.matchMedia && window.matchMedia(SMALL_SCREEN);
    if (!mq) return;
    var onChange = function () {
      if (!state.open) return;
      lockScroll(false); // clear any earlier inert and aria-modal
      lockScroll(true);  // re-apply only if the panel is full screen now
      if (smallScreen() && !panel.contains(document.activeElement)) input.focus({ preventScroll: true });
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function init() {
    build();
    restore();
    watchScreenSize();
    scheduleTeaser();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) closePanel(true);
    });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-open-chat]");
      if (t) { e.preventDefault(); openPanel(true); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
