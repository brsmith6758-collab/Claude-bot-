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
  var ENDPOINT = String(cfg.chatEndpoint || "").replace(/\/+$/, "");
  var STORE_KEY = "pac:chat:v1";
  var TEASE_KEY = "pac:chat:teased";
  var HOURS = cfg.chatHours || { tz: "America/Chicago", days: [1, 2, 3, 4, 5, 6], start: 9, end: 19, noticeMinutes: 60 };
  function smallScreen() { return !!(window.matchMedia && window.matchMedia("(max-width: 560px), (max-height: 500px)").matches); }

  var T = {
    en: {
      launcher: "Questions? Chat now", title: "Prime Acre Capital", status: "AI assistant · replies instantly", statusGuided: "Virtual assistant · replies instantly",
      close: "Close chat", placeholder: "Type your message…", send: "Send", input: "Message",
      teaseTitle: "Thinking about selling?", teaseBody: "I can answer questions and set up a quick call for a cash offer.",
      teaseClose: "Dismiss",
      foot: "Automated assistant; a real person follows up. Prefer to talk? Call or text ",
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
      gPhoneBad: "That doesn't look like a 10-digit US number. Could you check it?",
      gConsent: "Is it OK if we text you at that number about your offer?",
      gConsentChips: ["Yes, texting is fine", "Calls only, please"],
      gTime: "When's a good time for a quick call? Pick one, or type a time that works.",
      gTimeAsap: "As soon as possible",
      gSending: "One moment…",
      gDone: function (when) { return "Thanks! " + (when ? "I've asked the team to call you around " + when + ". They'll confirm by call or text. " : "The team will reach out shortly. ") + "They review the property first, and a written cash offer typically follows within 24 hours of the review. If anything changes, call or text " + PHONE + "."; },
      gStale: "That time has already passed. Here are the next open options:",
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
        [/how (fast|quick|long|soon)|close|closing|days/i, "We can close in as little as 7 days once title is clear, or on a later date you pick."],
        [/condition|repair|as.?is|clean|damage|fix/i, "We buy houses as-is in any condition. No repairs, no cleaning, no showings. Leave behind anything you don't want."],
        [/legit|scam|trust|real|safe/i, "Fair question. You never pay us anything, and every closing goes through a licensed title company or closing attorney, so your money never passes through our hands. You can have your own attorney review the contract."],
        [/mortgage|owe|lien|tax|foreclos/i, "Mortgages, liens, and back taxes are paid off from the sale at closing. If you're facing foreclosure, timing matters, so the sooner we talk the better."],
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
      foot: "Asistente automatizado; una persona real le dará seguimiento. ¿Prefiere hablar? Llame o envíe un texto al ",
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
      gPhoneBad: "Ese número no parece de 10 dígitos. ¿Lo puede revisar?",
      gConsent: "¿Está bien si le enviamos mensajes de texto a ese número sobre su oferta?",
      gConsentChips: ["Sí, textos está bien", "Solo llamadas, por favor"],
      gTime: "¿Cuándo le queda bien una llamada rápida? Elija una opción o escriba un horario.",
      gTimeAsap: "Lo antes posible",
      gSending: "Un momento…",
      gDone: function (when) { return "¡Gracias! " + (when ? "Le pedí al equipo que le llame alrededor de " + when + ". Le confirmarán por llamada o texto. " : "El equipo se comunicará pronto. ") + "Revisan la propiedad primero y una oferta por escrito suele llegar dentro de 24 horas después de la revisión. Si algo cambia, llame o envíe un texto al " + PHONE + "."; },
      gStale: "Ese horario ya pasó. Estas son las próximas opciones:",
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
        [/rápid|cuánto tiempo|cerrar|cierre|días/i, "Podemos cerrar en tan solo 7 días una vez que el título esté limpio, o en una fecha posterior que usted elija."],
        [/condici|repar|arregl|limpi|daño/i, "Compramos casas tal como están, en cualquier condición. Sin reparaciones, sin limpieza, sin visitas."],
        [/estafa|confi|real|segur|legít/i, "Buena pregunta. Usted nunca nos paga nada, y cada cierre se hace con una compañía de títulos o un abogado con licencia; su dinero nunca pasa por nuestras manos."],
        [/hipoteca|debo|gravamen|impuesto|ejecuci/i, "Las hipotecas, gravámenes e impuestos atrasados se pagan con la venta al cierre. Si enfrenta una ejecución hipotecaria, el tiempo importa."],
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

    var foot = el("div", { class: "pac-foot" }, [T.foot]);
    if (PHONE) foot.appendChild(el("a", { href: "tel:" + PHONE_TEL, text: PHONE }));
    foot.appendChild(document.createTextNode(". "));
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
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 60000);
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
        (res.body.leads || []).forEach(deliverLead);
        var ui = res.body.ui || {};
        if ((res.body.leads && res.body.leads.length) || ui.booking || ui.saved) state.leadSent = true;
        save();
        return;
      }
      var err = res.body && res.body.error;
      if ((err === "reset" || err === "too_long") && !isRetry) {
        state.history = []; state.sig = ""; save();
        if (err === "too_long") bot(T.fresh);
        return aiSend(text, true);
      }
      if (err === "ai_unavailable") return switchToGuided();
      troubled(text);
    }).catch(function () {
      window.clearTimeout(timer);
      troubled(text);
    });
  }

  function troubled(text) {
    setBusy(false);
    failures++;
    if (failures >= 2) return switchToGuided();
    bot(T.trouble);
    setChips([{ label: T.tryAgain, value: text }]);
  }

  function switchToGuided() {
    setBusy(false);
    state.mode = "guided";
    showMode();
    if (state.leadSent) {
      // The team already has this seller's details: don't collect them twice.
      state.g = { step: "done", data: {} };
      save();
      bot(T.gAfter);
      card({ type: "contact" });
      return;
    }
    state.g = { step: "address", data: state.g && state.g.data ? state.g.data : {} };
    save();
    bot(T.switching);
    bot(T.gAddress);
  }

  function handleUi(ui) {
    if (ui.slots && ui.slots.length) {
      setChips(ui.slots.map(function (s) { return { label: s.label, value: s.label, slot: true }; }));
    }
    if (ui.booking) {
      card({ type: "booking", when: ui.booking.when, calendarUrl: ui.booking.calendarUrl });
    }
  }

  // Leads the Worker could not email itself go through the site's form endpoint.
  function deliverLead(lead) {
    var mapped = {
      _subject: (lead.appointment ? "Booked call " + lead.appointment.ownerLabel + ": " : "New seller lead (chat): ") + [lead.address, lead.city, lead.state].filter(Boolean).join(", "),
      address: lead.address, city: lead.city, state: lead.state, zip: lead.zip,
      name: lead.name, phone: lead.phone, email: lead.email, smsConsent: lead.smsConsent,
      propertyType: lead.propertyType, condition: lead.condition, occupancy: lead.occupancy,
      timeline: lead.timeline, reason: lead.reason, askingPrice: lead.askingPrice, notes: lead.notes,
      callTime: lead.appointment ? lead.appointment.ownerLabel + " (seller: " + lead.appointment.sellerLabel + ")" : lead.callbackPreference,
      addToCalendar: lead.appointment ? lead.appointment.ownerCalendarUrl : "",
      source: "website-chat", page: lead.page, submittedAt: lead.submittedAt, market: lead.state || "Nationwide"
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
  function looksLikeTime(text) {
    return /\d|\b(am|pm|a\.m|p\.m|morning|afternoon|evening|tonight|today|tomorrow|noon|mon|tue|wed|thu|fri|sat|sun|asap|now|any ?time|weekend|ma[nñ]ana|tarde|noche|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|cuando sea|lo antes)/i.test(text);
  }
  function extractPhone(text) {
    var m = String(text).match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!m) return null;
    var d = m[0].replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    if (d.length !== 10 || /^[01]/.test(d)) return null;
    return { formatted: "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6), raw: m[0] };
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
        var digits = text.replace(/\D/g, "");
        if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
        if (digits.length !== 10 || /^[01]/.test(digits)) { bot(T.gPhoneBad); break; }
        data.phone = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
        g.step = "consent";
        bot(T.gConsent);
        setChips(T.gConsentChips);
        break;
      case "consent":
        data.smsConsent = text === T.gConsentChips[0] || /^(?:y|yes|yeah|yep|sure|ok|okay|s[ií]|claro)(?:$|[\s,.!])/i.test(text.trim());
        g.step = "time";
        bot(T.gTime);
        setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
        break;
      case "time":
        var chosen = (lastChips || []).filter(function (c) { return c && c.ms && c.label === text; })[0];
        var notice = typeof HOURS.noticeMinutes === "number" ? HOURS.noticeMinutes : 60;
        if (chosen && chosen.ms < Date.now() + notice * 60000) {
          bot(T.gStale);
          setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
          break;
        }
        if (!chosen && text !== T.gTimeAsap && !looksLikeTime(text)) {
          if (isQuestion(text)) bot(faqAnswer(text) || T.gQuestion);
          bot(T.gTimeHint);
          setChips([{ label: T.gTimeAsap }].concat(suggestTimes()));
          break;
        }
        data.callTime = text.slice(0, 120);
        g.step = "sending";
        save();
        finishGuided();
        return;
      case "callback":
        var ph = extractPhone(text);
        var nm = text.replace(ph ? ph.raw : "", "").replace(/[,;:.]+/g, " ").replace(/\b(my name is|i'?m|this is|me llamo|soy|call me|ll[aá]menme|please|por favor|at|al)\b/gi, " ").replace(/\s+/g, " ").trim();
        if (nm) data.name = nm.slice(0, 120);
        if (!ph) { bot(T.gCallbackName); break; }
        data.phone = ph.formatted;
        data.address = data.address || T.notGiven;
        g.step = "consent";
        bot(T.gConsent);
        setChips(T.gConsentChips);
        break;
      case "sending":
        return;
      default:
        bot(faqAnswer(text) || T.gAfter);
    }
    save();
  }

  function guidedSummary(d) {
    return [
      (LANG === "es" ? "Nombre: " : "Name: ") + (d.name || ""),
      (LANG === "es" ? "Teléfono: " : "Phone: ") + (d.phone || ""),
      (LANG === "es" ? "Propiedad: " : "Property: ") + (d.address || ""),
      (LANG === "es" ? "Condición: " : "Condition: ") + (d.condition || ""),
      (LANG === "es" ? "Plazo: " : "Timeline: ") + (d.timeline || ""),
      (LANG === "es" ? "Llamada: " : "Call: ") + (d.callTime || "")
    ].join("\n");
  }

  function finishGuided() {
    var d = state.g.data;
    var asap = d.callTime === T.gTimeAsap;
    var lead = {
      _subject: "New seller lead (chat" + (asap ? "" : ", call requested " + d.callTime) + "): " + d.address,
      address: d.address, city: "", state: d.state || "", zip: "",
      name: d.name, phone: d.phone, email: "", smsConsent: !!d.smsConsent,
      condition: d.condition, timeline: d.timeline,
      callTime: d.callTime + (asap ? "" : " (requested, please confirm)"),
      source: "website-chat-guided", page: window.location.pathname, lang: LANG,
      submittedAt: new Date().toISOString(), market: d.state || "Nationwide"
    };
    setBusy(true);
    var submit = pac().submitLead ? pac().submitLead(lead) : Promise.resolve({ ok: false });
    submit.then(function (r) {
      setBusy(false);
      if (r && r.ok) {
        if (pac().trackLead) pac().trackLead({ source: "website-chat-guided", market: lead.market, state: lead.state });
        state.leadSent = true;
        if (!asap) card({ type: "booking", when: d.callTime, requested: true });
        bot(T.gDone(asap ? "" : d.callTime));
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
    if (state.g && state.g.step === "sending") state.g.step = "time";
    if (state.open && !smallScreen()) openPanel(false);
    else if (state.open) { state.open = false; save(); }
  }

  function init() {
    build();
    restore();
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
