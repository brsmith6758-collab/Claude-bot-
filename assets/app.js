/* Prime Acre Capital — site behavior: contact details, address search, multi-step lead form. */
(function () {
  "use strict";

  var cfg = window.PAC_CONFIG || {};
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var LANG = (document.documentElement.getAttribute("lang") || "en").slice(0, 2);
  var MSG = {
    en: { sending: "Sending…", cta: "Get My Cash Offer →", needAddress: "Please enter the property address.",
          needPhone: "Please enter a phone number we can reach you at.", checkFields: "Please check the highlighted fields.",
          failPrefix: "We couldn't send that just now. Please ", call: "call or text ", email: "email ", retry: "try again in a moment",
          failSuffix: " and we'll take it from there.", copied: "Copied", selectCopy: "Select and copy",
          weBuyIn: "We buy houses in ", twoSteps: ". One more step and your request is in.", nationwide: "We look at every address",
          needCityState: "Add the city and state so we look at the right property.", needName: "Please enter your name.",
          property: "Property: ", sendBtn: "Send my request →", detailsBtn: "Send details →", step: "Step " },
    es: { sending: "Enviando…", cta: "Recibir mi oferta →", needAddress: "Por favor ingrese la dirección de la propiedad.",
          needPhone: "Por favor ingrese un número de teléfono donde podamos contactarlo.", checkFields: "Por favor revise los campos marcados.",
          failPrefix: "No pudimos enviar su solicitud en este momento. Por favor ", call: "llame o envíe un texto al ", email: "escriba a ", retry: "intente de nuevo en un momento",
          failSuffix: " y nosotros nos encargamos.", copied: "Copiado", selectCopy: "Seleccione y copie",
          weBuyIn: "Compramos casas en ", twoSteps: ". Un paso más y su solicitud está lista.", nationwide: "Revisamos cualquier dirección",
          needCityState: "Agregue la ciudad y el estado para revisar la propiedad correcta.", needName: "Por favor ingrese su nombre.",
          property: "Propiedad: ", sendBtn: "Enviar mi solicitud →", detailsBtn: "Enviar detalles →", step: "Paso " }
  };
  var M = MSG[LANG] || MSG.en;

  var MARKETS = {
    AZ: { name: "Arizona", zip: /^8[56]\d{3}$/ },
    FL: { name: "Florida", zip: /^3[2-4]\d{3}$/ },
    TN: { name: "Tennessee", zip: /^3[78]\d{3}$/ },
    NC: { name: "North Carolina", zip: /^2[78]\d{3}$/ }
  };

  /* ---------- contact details from config ---------- */
  function applyContact() {
    var phone = String(cfg.phone || "").trim();
    var email = String(cfg.email || "").trim();
    $$("[data-phone]").forEach(function (el) {
      if (!phone) { el.hidden = true; return; }
      el.textContent = phone;
      if (el.tagName === "A") el.setAttribute("href", "tel:" + phone.replace(/[^\d+]/g, ""));
      el.hidden = false;
    });
    $$("[data-email]").forEach(function (el) {
      if (!email) { el.hidden = true; return; }
      el.textContent = email;
      if (el.tagName === "A") el.setAttribute("href", "mailto:" + email);
      el.hidden = false;
    });
    var smsBody = String(cfg.smsText || "").trim();
    $$("[data-sms]").forEach(function (el) {
      if (!phone) { el.hidden = true; return; }
      el.setAttribute("href", "sms:" + ("+1" + phone.replace(/\D/g, "").slice(-10)) + (smsBody ? "?&body=" + encodeURIComponent(smsBody) : ""));
      el.hidden = false;
    });
    $$("[data-phone-wrap]").forEach(function (el) { el.hidden = !phone; });
    $$("[data-email-wrap]").forEach(function (el) { el.hidden = !email; });
    $$("[data-contact-wrap]").forEach(function (el) { el.hidden = !(phone || email); });
  }

  /* ---------- analytics and ad conversion tracking (only when IDs are set) ---------- */
  var ADS = String(cfg.googleAdsConversion || "").trim();
  function initAnalytics() {
    var ga = String(cfg.ga4MeasurementId || "").trim();
    var awId = ADS.split("/")[0];
    var fb = String(cfg.metaPixelId || "").trim();
    if (ga || awId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga || awId);
      document.head.appendChild(s);
      window.gtag("js", new Date());
      if (ga) window.gtag("config", ga);
      if (awId) window.gtag("config", awId);
    }
    if (fb && !window.fbq) {
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      window._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      var f = document.createElement("script");
      f.async = true;
      f.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(f);
      window.fbq("init", fb);
      window.fbq("track", "PageView");
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href^='tel:'], a[href^='sms:']");
      if (!a) return;
      track(a.getAttribute("href").indexOf("tel:") === 0 ? "click_to_call" : "click_to_text", {});
    });
  }
  function track(name, params) {
    try {
      if (window.gtag) window.gtag("event", name, params || {});
      if (window.fbq && name === "generate_lead") window.fbq("track", "Lead", params || {});
    } catch (e) { /* tracking must never break the form */ }
  }
  function trackLead(lead) {
    track("generate_lead", { lead_source: lead.source, market: lead.market, state: lead.state });
    if (ADS && window.gtag) { try { window.gtag("event", "conversion", { send_to: ADS }); } catch (e) { /* ignore */ } }
  }

  /* ---------- header nav: menu toggle on phones, disclosure dropdowns ---------- */
  function initNav() {
    var toggle = $(".nav-toggle");
    var nav = $("#nav");
    if (!toggle || !nav) return;
    var label = toggle.textContent;
    var closeLabel = LANG === "es" ? "Cerrar" : "Close";
    var drops = $$(".nav-drop", nav);

    function setDrop(btn, open) {
      var menu = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (menu) menu.classList.toggle("open", open);
    }
    function closeDrops(except) { drops.forEach(function (b) { if (b !== except) setDrop(b, false); }); }
    function setMenu(open) {
      nav.classList.toggle("open", open);
      document.documentElement.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? closeLabel : label;
      if (!open) closeDrops();
    }

    toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
    drops.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") !== "true";
        closeDrops(btn);
        setDrop(btn, open);
      });
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav-group")) closeDrops();
      if (nav.classList.contains("open") && !e.target.closest("#nav, .nav-toggle")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var openBtn = drops.filter(function (b) { return b.getAttribute("aria-expanded") === "true"; })[0];
      // Also hide a menu the pointer is holding open, until the pointer leaves it.
      var hovered = $$(".nav-group", nav).filter(function (g) { return g.matches(":hover"); })[0];
      if (hovered) hovered.classList.add("suppress");
      if (openBtn) { closeDrops(); openBtn.focus(); return; }
      if (nav.classList.contains("open")) { setMenu(false); toggle.focus(); }
    });
    // Leaving a dropdown with the keyboard closes it.
    $$(".nav-group", nav).forEach(function (g) {
      g.addEventListener("mouseleave", function () { g.classList.remove("suppress"); });
      g.addEventListener("focusout", function (e) {
        if (e.relatedTarget && !g.contains(e.relatedTarget)) {
          var btn = $(".nav-drop", g);
          if (btn) setDrop(btn, false);
        }
      });
    });
  }

  /* ---------- address parsing (any US address) ---------- */
  var STATES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
    IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
    MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
    OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
    UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
  // First three ZIP digits to state, used only when the address doesn't name the state.
  var ZIP3 = [[10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"],
    [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 200, "DC"], [201, 201, "VA"], [202, 205, "DC"], [206, 219, "MD"],
    [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
    [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"],
    [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"],
    [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"],
    [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"],
    [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"]];

  function zipState(zip) {
    var p = parseInt(String(zip).slice(0, 3), 10);
    for (var i = 0; i < ZIP3.length; i++) if (p >= ZIP3[i][0] && p <= ZIP3[i][1]) return ZIP3[i][2];
    return "";
  }
  function stateByName(text) {
    var up = String(text || "").toUpperCase(), best = "";
    for (var k in STATES) {
      if (new RegExp("\\b" + STATES[k].toUpperCase() + "\\b").test(up) && STATES[k].length > (STATES[best] || "").length) best = k;
    }
    return best; // "West Virginia" beats "Virginia"
  }
  function detectState(text) {
    var up = String(text || "").toUpperCase().trim();
    var m = up.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/) || up.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/) ||
            up.match(/\s([A-Z]{2})\s*$/) || up.match(/,\s*([A-Z]{2})\b/);
    if (m && STATES[m[1]]) return m[1];
    var parts = up.split(",");
    var byName = stateByName(parts.length > 1 ? parts.slice(1).join(",") : up.replace(/^\d+\s+\S+/, ""));
    if (byName) return byName;
    var zip = (up.match(/\b(\d{5})(?:-\d{4})?\s*$/) || up.match(/\b(\d{5})\b/) || [])[1];
    return zip ? zipState(zip) : "";
  }
  function stripStateZip(text) {
    var t = String(text || "").replace(/\b\d{5}(-\d{4})?\b/g, "").trim();
    t = t.replace(/\s+([A-Za-z]{2})$/, function (all, ab) { return STATES[ab.toUpperCase()] ? "" : all; }).trim();
    var name = stateByName(t);
    if (name) t = t.replace(new RegExp("\\s*" + STATES[name] + "\\s*$", "i"), "").trim();
    return t;
  }
  function parseAddress(text) {
    var raw = String(text || "").trim().replace(/\s+/g, " ");
    var out = { street: raw, city: "", state: "", zip: "" };
    var zips = raw.match(/\b\d{5}(?:-\d{4})?\b/g);
    if (zips && zips.length) out.zip = zips[zips.length - 1].slice(0, 5);
    out.state = detectState(raw);
    var parts = raw.split(",").map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 2) {
      out.street = parts[0];
      for (var i = 1; i < parts.length; i++) {
        var p = stripStateZip(parts[i]);
        if (!p) continue;
        if (/^(apt|apartment|unit|suite|ste|lot|bldg|#)\b/i.test(p) || /^#/.test(p)) { out.street += ", " + p; continue; }
        out.city = p;
        break;
      }
    } else if (out.zip || out.state) {
      out.street = stripStateZip(raw); // "123 Main St Phoenix AZ 85001": city can't be split off safely
    }
    return out;
  }
  function marketName(st) { return MARKETS[st] ? MARKETS[st].name : "Nationwide"; }
  function newLeadId() { return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function textOf(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }

  function setInvalid(el, bad) {
    if (!el) return;
    var wrap = el.closest(".field");
    if (wrap) wrap.classList.toggle("invalid", bad);
    if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }

  function initSearch() {
    $$("[data-prefill-state]").forEach(function (a) {
      a.addEventListener("click", function () {
        var form = $("#lead-form");
        if (form && form.elements.state) form.elements.state.value = a.getAttribute("data-prefill-state");
      });
    });
  }

  /* ---------- lead delivery ---------- */
  function claudeDb() {
    try {
      if (!window.claude || typeof window.claude.use !== "function") return Promise.resolve(null);
      return window.claude.use("db").catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return false;
      return r.text().then(function (t) {
        try {
          var j = JSON.parse(t);
          if (j && (j.success === false || j.success === "false" || j.error)) return false;
        } catch (e) { /* non-JSON body: treat 2xx as delivered */ }
        return true;
      });
    }).catch(function () { return false; });
  }

  function submitLead(lead) {
    var endpoint = String(cfg.leadEndpoint || "").trim();
    var chain = Promise.resolve(false);
    if (endpoint) {
      var where = lead.fullAddress || [lead.address, lead.city, lead.state].filter(Boolean).join(", ");
      var subject = lead.stage === "details" ? "Details for seller lead: " + where : "New seller lead: " + where;
      var payload = Object.assign({ _subject: subject }, lead);
      chain = postJson(endpoint, payload);
    }
    return chain.then(function (sent) {
      if (sent) return { ok: true, via: "endpoint" };
      return claudeDb().then(function (db) {
        if (!db) return { ok: false };
        return db.collection("leads").add(lead)
          .then(function () { return { ok: true, via: "db" }; })
          .catch(function () { return { ok: false }; });
      });
    });
  }

  function leadSummary(lead) {
    var place = lead.fullAddress || [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
    var lines = [
      "Cash offer request — Prime Acre Capital",
      "Property: " + place,
      lead.propertyType ? "Type: " + lead.propertyType + (lead.beds ? " · " + lead.beds + " bed" : "") + (lead.baths ? " / " + lead.baths + " bath" : "") : "",
      lead.condition || lead.occupancy ? "Condition: " + (lead.condition || "–") + " · Occupancy: " + (lead.occupancy || "–") : "",
      lead.timeline || lead.reason ? "Timeline: " + (lead.timeline || "–") + (lead.reason ? " · Reason: " + lead.reason : "") : "",
      lead.askingPrice ? "Asking: " + lead.askingPrice : "",
      lead.name ? "Name: " + lead.name : "",
      "Phone: " + lead.phone + (lead.email ? " · Email: " + lead.email : ""),
      lead.notes ? "Notes: " + lead.notes : ""
    ];
    return lines.filter(Boolean).join("\n");
  }

  /* ---------- quick lead card (address + phone + optional email), sent immediately ---------- */
  var offerForm = null; // set by initForm(): lets the quick card hand its lead to the full form's details step

  function initHeroForm() {
    $$("form.hero-form").forEach(function (form) {
      var card = form.closest(".lead-card");
      var errorBox = $("[data-form-error]", form);
      var done = card ? $(".lead-done", card) : null;

      function fail(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.hidden = false;
      }

      form.addEventListener("input", function (e) {
        setInvalid(e.target, false);
        if (errorBox) errorBox.hidden = true;
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (form.elements.company && form.elements.company.value) return;
        var address = form.elements.address.value.trim();
        var phone = form.elements.phone.value.trim();
        var email = form.elements.email ? form.elements.email.value.trim() : "";
        var bad = false;
        [["address", !address], ["phone", phone.replace(/\D/g, "").length < 10],
         ["email", !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)]].forEach(function (pair) {
          var el = form.elements[pair[0]];
          setInvalid(el, pair[1]);
          if (pair[1] && !bad) { bad = true; if (el) el.focus({ preventScroll: true }); }
        });
        if (bad) { fail(address ? (phone.replace(/\D/g, "").length < 10 ? M.needPhone : M.checkFields) : M.needAddress); return; }

        var parsed = parseAddress(address);
        var state = parsed.state || (form.elements.state ? form.elements.state.value : "");
        var city = parsed.city || (form.elements.city ? form.elements.city.value : "");
        var sms = form.elements.smsConsent ? !!form.elements.smsConsent.checked : false;
        var lead = {
          leadId: newLeadId(), stage: "contact",
          address: parsed.street, city: city, state: state, zip: parsed.zip, fullAddress: address,
          phone: phone, email: email, smsConsent: sms,
          reason: form.elements.reason ? form.elements.reason.value : "",
          consentText: textOf($(".consent", form)), smsConsentText: sms ? textOf(form.elements.smsConsent.closest("label")) : "",
          consentVersion: form.getAttribute("data-consent-version") || "",
          source: "quick-form", page: window.location.pathname,
          submittedAt: new Date().toISOString(), market: marketName(state)
        };
        var btn = $("button[type=submit]", form);
        if (btn) { btn.disabled = true; btn.textContent = M.sending; }
        submitLead(lead).then(function (result) {
          if (btn) { btn.disabled = false; btn.textContent = M.cta; }
          try { window.localStorage.setItem("pac:quickLead", JSON.stringify(lead)); } catch (err) { /* storage unavailable */ }
          if (result.ok) trackLead(lead);
          if (result.ok && done) {
            form.hidden = true;
            done.hidden = false;
            done.focus({ preventScroll: true });
            var add = $("[data-add-details]", done);
            if (add) add.addEventListener("click", function () { if (offerForm) offerForm.openDetails(lead); });
            return;
          }
          var phoneTxt = String(cfg.phone || "").trim();
          var emailTxt = String(cfg.email || "").trim();
          var reach = phoneTxt ? M.call + phoneTxt : (emailTxt ? M.email + emailTxt : M.retry);
          fail(M.failPrefix + reach + M.failSuffix);
        });
      });
    });
  }

  /* ---------- full offer form: address, then contact (sends the request), then optional details ---------- */
  function initForm() {
    var form = $("#lead-form");
    if (!form) return;
    var steps = $$(".form-step", form);
    var bars = $$(".progress li", form);
    var status = $("[data-step-status]", form);
    var parts = $("[data-addr-parts]", form);
    var current = 0;
    var contact = null; // the request already sent (from step 2 or the quick card); details attach to its leadId

    function errorBox() { return $("[data-form-error]", steps[current]); }
    function fail(msg) { var b = errorBox(); if (b) { b.textContent = msg; b.hidden = false; } }
    function clearError() { $$("[data-form-error]", form).forEach(function (b) { b.hidden = true; }); }

    function show(i, focus) {
      current = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      bars.forEach(function (b, k) { b.classList.toggle("done", k < i); b.classList.toggle("current", k === i); });
      clearError();
      if (i === 1) personalize();
      var h = $("h3", steps[i]);
      if (status) status.textContent = textOf(h);
      if (h) h.setAttribute("tabindex", "-1");
      if (focus !== false) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        if (h) h.focus({ preventScroll: true });
      }
    }

    function finish(which) {
      steps.forEach(function (s) { s.hidden = true; });
      var progress = $(".progress", form);
      if (progress) progress.hidden = true;
      var panel = $("[data-result=" + which + "]", form);
      if (!panel) return panel;
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      panel.focus({ preventScroll: true });
      return panel;
    }

    function readAddress() {
      var p = parseAddress(form.elements.fullAddress.value);
      if (parts && !parts.hidden) {
        p.city = form.elements.city.value.trim() || p.city;
        p.state = form.elements.state.value || p.state;
        p.zip = form.elements.zip.value.trim() || p.zip;
      }
      return p;
    }

    function step1Ok() {
      var full = form.elements.fullAddress;
      if (!full.value.trim()) { setInvalid(full, true); full.focus(); fail(M.needAddress); return false; }
      var p = readAddress();
      if (!p.city || !p.state) {
        if (parts && parts.hidden) {
          parts.hidden = false;
          if (p.city) form.elements.city.value = p.city;
          if (p.state) form.elements.state.value = p.state;
          if (p.zip) form.elements.zip.value = p.zip;
        }
        var missing = !form.elements.city.value.trim() ? form.elements.city : (!form.elements.state.value ? form.elements.state : null);
        setInvalid(form.elements.city, !form.elements.city.value.trim());
        setInvalid(form.elements.state, !form.elements.state.value);
        if (missing) { fail(M.needCityState); missing.focus(); return false; }
        p = readAddress();
      }
      var zip = form.elements.zip.value.trim();
      if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) { setInvalid(form.elements.zip, true); fail(M.checkFields); form.elements.zip.focus(); return false; }
      form.elements.address.value = p.street;
      form.elements.city.value = p.city;
      form.elements.state.value = p.state;
      form.elements.zip.value = p.zip || zip;
      return true;
    }

    function personalize() {
      var line = $("[data-personal]", form);
      if (!line) return;
      var place = [form.elements.address.value, form.elements.city.value, (form.elements.state.value + " " + form.elements.zip.value).trim()]
        .filter(Boolean).join(", ");
      var st = form.elements.state.value;
      var where = MARKETS[st] ? (form.elements.city.value ? form.elements.city.value + ", " : "") + MARKETS[st].name : "";
      $("span", line).textContent = M.property + place + ". " + (where ? M.weBuyIn + where + M.twoSteps : M.nationwide + M.twoSteps);
      line.hidden = false;
    }

    function step2Ok() {
      var ok = true;
      var checks = [["name", !form.elements.name.value.trim(), M.needName],
                    ["phone", form.elements.phone.value.replace(/\D/g, "").length < 10, M.needPhone],
                    ["email", !!form.elements.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim()), M.checkFields]];
      checks.forEach(function (c) {
        var el = form.elements[c[0]];
        setInvalid(el, c[1]);
        if (c[1] && ok) { ok = false; el.focus({ preventScroll: false }); fail(c[2]); }
      });
      return ok;
    }

    function fallback(lead) {
      var panel = finish("fallback");
      if (!panel) return;
      var sum = $(".summary", panel);
      if (sum) sum.textContent = leadSummary(lead);
      var copy = $("[data-copy]", panel);
      if (copy) copy.onclick = function () {
        var text = leadSummary(lead);
        var done = function () { copy.textContent = M.copied; };
        var no = function () {
          if (sum) { var r = document.createRange(); r.selectNodeContents(sum); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
          copy.textContent = M.selectCopy;
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, no);
        else no();
      };
      var mail = $("[data-mail]", panel);
      if (mail) {
        var email = String(cfg.email || "").trim();
        mail.hidden = !email;
        if (email) mail.setAttribute("href", "mailto:" + email + "?subject=" + encodeURIComponent("Cash offer request: " + (lead.fullAddress || lead.address)) + "&body=" + encodeURIComponent(leadSummary(lead)));
      }
    }

    function sendContact() {
      if (!step2Ok()) return;
      if (form.elements.company && form.elements.company.value) return; // honeypot
      var p = readAddress();
      var sms = !!form.elements.smsConsent.checked;
      var lead = {
        leadId: newLeadId(), stage: "contact",
        name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim(), email: form.elements.email.value.trim(),
        smsConsent: sms, fullAddress: form.elements.fullAddress.value.trim(),
        address: p.street, city: p.city, state: p.state, zip: p.zip,
        reason: form.elements.reason ? form.elements.reason.value : "",
        consentText: textOf($(".consent", form)), smsConsentText: sms ? textOf(form.elements.smsConsent.closest("label")) : "",
        consentVersion: form.getAttribute("data-consent-version") || "",
        source: "offer-form", page: window.location.pathname, submittedAt: new Date().toISOString(), market: marketName(p.state)
      };
      var btn = $("button[type=submit]", form);
      if (btn) { btn.disabled = true; btn.textContent = M.sending; }
      submitLead(lead).then(function (result) {
        if (btn) { btn.disabled = false; btn.textContent = M.sendBtn; }
        try { window.localStorage.setItem("pac:lastLead", JSON.stringify(lead)); } catch (err) { /* storage unavailable */ }
        if (!result.ok) { fallback(lead); return; }
        trackLead(lead);
        contact = lead;
        show(2);
      });
    }

    function sendDetails(btn) {
      var keys = ["propertyType", "condition", "beds", "baths", "occupancy", "timeline", "reason", "askingPrice", "notes"];
      var d = {}, any = false;
      keys.forEach(function (k) { var el = form.elements[k]; d[k] = el ? String(el.value).trim() : ""; if (d[k]) any = true; });
      if (!any || !contact) { finish("success"); return; }
      var lead = Object.assign({
        leadId: contact.leadId, stage: "details", name: contact.name || "", phone: contact.phone, fullAddress: contact.fullAddress,
        address: contact.address, city: contact.city, state: contact.state, zip: contact.zip, market: contact.market,
        source: "offer-form-details", page: window.location.pathname, submittedAt: new Date().toISOString()
      }, d);
      btn.disabled = true; btn.textContent = M.sending;
      submitLead(lead).then(function (result) {
        btn.disabled = false; btn.textContent = M.detailsBtn;
        var note = $("[data-details-note]", form);
        if (note) note.hidden = !!result.ok;
        finish("success");
      });
    }

    form.addEventListener("click", function (e) {
      var t = e.target.closest("[data-next], [data-back], [data-skip], [data-details], [data-edit-address]");
      if (!t) return;
      e.preventDefault();
      if (t.hasAttribute("data-next")) { if (step1Ok()) show(1); return; }
      if (t.hasAttribute("data-back")) { show(Math.max(0, current - 1)); return; }
      if (t.hasAttribute("data-edit-address")) { if (parts) parts.hidden = false; show(0); return; }
      if (t.hasAttribute("data-skip")) { finish("success"); return; }
      if (t.hasAttribute("data-details")) sendDetails(t);
    });

    form.addEventListener("input", function (e) { setInvalid(e.target, false); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (current === 0) { if (step1Ok()) show(1); return; } // Enter in the address field
      if (current === 1) sendContact();
    });

    offerForm = {
      // The quick card already sent a request: skip to the optional details for that same request.
      openDetails: function (lead) {
        contact = lead;
        form.elements.fullAddress.value = lead.fullAddress || "";
        form.elements.address.value = lead.address || "";
        form.elements.city.value = lead.city || "";
        if (lead.state) form.elements.state.value = lead.state;
        form.elements.zip.value = lead.zip || "";
        if (lead.reason && form.elements.reason) form.elements.reason.value = lead.reason;
        show(2, false);
        window.setTimeout(function () { var h = $("h3", steps[2]); if (h) h.focus({ preventScroll: true }); }, 450);
      }
    };

    show(0, false);
  }

  /* ---------- phones: hide the sticky bar while typing (the keyboard is up) ---------- */
  function initTyping() {
    var root = document.documentElement;
    document.addEventListener("focusin", function (e) { if (e.target.matches("input, select, textarea")) root.classList.add("typing"); });
    document.addEventListener("focusout", function (e) { if (e.target.matches("input, select, textarea")) root.classList.remove("typing"); });
  }

  /* ---------- sticky CTA ---------- */
  function initStickyCta() {
    var bar = $(".sticky-cta");
    var offer = $("#offer");
    if (!bar || !offer || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("off", entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(offer);
  }

  /* ---------- net proceeds calculator (compare page): listing vs a cash offer the seller enters ---------- */
  function initNetCalc() {
    var root = $("#netcalc");
    if (!root) return;
    var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    var raw = function (id) { var el = $("#" + id, root); return String(el ? el.value : "").replace(/[^0-9.]/g, ""); };
    var val = function (id) { var v = parseFloat(raw(id)); return isFinite(v) && v >= 0 ? v : 0; };
    var out = function (k, text) { $$("[data-net-out=" + k + "]", root).forEach(function (el) { el.textContent = text; }); };
    var plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };
    function update() {
      var price = val("n-price"), months = val("n-months") || 1, carry = val("n-carry"), payoff = val("n-payoff");
      var comm = price * val("n-comm") / 100, close = price * val("n-close") / 100, repairs = val("n-repairs");
      var carryList = carry * months;
      var list = price - comm - close - repairs - carryList - payoff;
      var days = val("n-days") || 14, carryCash = carry * days / 30;
      out("commission", fmt.format(comm)); out("closing", fmt.format(close)); out("repairs", fmt.format(repairs));
      out("carryList", fmt.format(carryList)); out("carryCash", fmt.format(carryCash));
      out("list", fmt.format(list)); out("listTime", "in about " + plural(months, "month", "months"));
      var mo = $("#n-months-out", root);
      if (mo) mo.textContent = plural(months, "month", "months");
      if (!raw("n-offer")) {
        out("cash", "Enter an offer"); out("cashTime", ""); out("diff", "Enter a cash offer you received to compare.");
        return;
      }
      var cash = val("n-offer") - val("n-cashclose") - carryCash - payoff;
      out("cash", fmt.format(cash)); out("cashTime", "in about " + plural(days, "day", "days"));
      var diff = list - cash;
      out("diff", Math.abs(diff) < 1000 ? "About the same either way. Then it comes down to time, repairs and certainty."
        : diff > 0 ? "Listing nets about " + fmt.format(diff) + " more, if it sells at that price in that time."
        : "The cash offer nets about " + fmt.format(-diff) + " more, and closes sooner.");
    }
    $$("[data-net]", root).forEach(function (el) {
      el.addEventListener("input", update);
      if (el.type !== "range" && el.closest(".money-in")) el.addEventListener("blur", function () {
        var v = val(el.id);
        el.value = v ? new Intl.NumberFormat("en-US").format(v) : (el.id === "n-offer" ? "" : "0");
        update();
      });
    });
    update();
  }

  function initYear() {
    $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  // Shared with the chat assistant (assets/chat.js).
  window.PAC = { submitLead: submitLead, trackLead: trackLead, track: track };

  function init() {
    applyContact();
    initAnalytics();
    initNav();
    initSearch();
    initHeroForm();
    initForm();
    initTyping();
    initStickyCta();
    initNetCalc();
    initYear();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
