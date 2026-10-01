/* Prime Acre Capital — site behavior: contact details, address search, multi-step lead form. */
(function () {
  "use strict";

  var cfg = window.PAC_CONFIG || {};
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

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
    $$("[data-phone-wrap]").forEach(function (el) { el.hidden = !phone; });
    $$("[data-email-wrap]").forEach(function (el) { el.hidden = !email; });
    $$("[data-contact-wrap]").forEach(function (el) { el.hidden = !(phone || email); });
  }

  /* ---------- header nav ---------- */
  function initNav() {
    var toggle = $(".nav-toggle");
    var nav = $("#nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      }
    });
  }

  /* ---------- address parsing ---------- */
  function detectState(text) {
    var t = String(text || "").toUpperCase();
    var abbr;
    for (abbr in MARKETS) {
      if (new RegExp("\\b" + abbr + "\\b").test(t) || t.indexOf(MARKETS[abbr].name.toUpperCase()) !== -1) return abbr;
    }
    var zip = (t.match(/\b\d{5}\b/) || [])[0];
    if (zip) for (abbr in MARKETS) { if (MARKETS[abbr].zip.test(zip)) return abbr; }
    return "";
  }

  function parseAddress(text) {
    var raw = String(text || "").trim();
    var out = { street: raw, city: "", state: "", zip: "" };
    var zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) out.zip = zipMatch[1];
    out.state = detectState(raw);
    var parts = raw.split(",").map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 2) {
      out.street = parts[0];
      out.city = parts[1].replace(/\b\d{5}(-\d{4})?\b/, "").replace(/\b[A-Z]{2}\b$/i, "").trim();
      if (parts.length >= 3 && !out.state) {
        var st = parts[2].replace(/\d.*$/, "").trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(st)) out.state = st;
      }
    } else if (out.zip || out.state) {
      // "123 Main St Phoenix AZ 85001" without commas: keep the street portion only.
      out.street = raw.replace(/\b\d{5}(-\d{4})?\b/, "").replace(/\b(AZ|FL|TN|NC|ARIZONA|FLORIDA|TENNESSEE|NORTH CAROLINA)\b/i, "").trim();
    }
    return out;
  }

  function prefillForm(parsed) {
    var form = $("#lead-form");
    if (!form) return;
    var set = function (name, value, force) {
      var el = form.elements[name];
      if (!el || (!value && !force)) return;
      if (value || force) el.value = value;
    };
    set("address", parsed.street);
    set("city", parsed.city);
    set("zip", parsed.zip);
    if (parsed.state && form.elements.state) {
      var opt = $$("option", form.elements.state).some(function (o) { return o.value === parsed.state; });
      if (opt) form.elements.state.value = parsed.state;
    }
  }

  function goToForm(parsed) {
    prefillForm(parsed);
    var offer = $("#offer");
    if (offer) offer.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(function () {
      var form = $("#lead-form");
      if (!form) return;
      var first = ["address", "city", "zip"].map(function (n) { return form.elements[n]; })
        .filter(function (el) { return el && !el.value; })[0] || form.elements.city;
      if (first) first.focus({ preventScroll: true });
    }, 450);
  }

  function initSearch() {
    $$("form.search").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = $("input", f);
        goToForm(parseAddress(input ? input.value : ""));
      });
    });
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
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function submitLead(lead) {
    var endpoint = String(cfg.leadEndpoint || "").trim();
    var chain = Promise.resolve(false);
    if (endpoint) {
      var payload = Object.assign({ _subject: "New seller lead: " + lead.address + ", " + lead.city + " " + lead.state }, lead);
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
    var lines = [
      "Cash offer request — Prime Acre Capital",
      "Property: " + lead.address + ", " + lead.city + ", " + lead.state + " " + lead.zip,
      "Type: " + lead.propertyType + " · " + lead.beds + " bed / " + lead.baths + " bath",
      "Condition: " + lead.condition + " · Occupancy: " + lead.occupancy,
      "Timeline: " + lead.timeline + (lead.reason ? " · Reason: " + lead.reason : ""),
      lead.askingPrice ? "Asking: " + lead.askingPrice : "",
      "Name: " + lead.name,
      "Phone: " + lead.phone + (lead.email ? " · Email: " + lead.email : ""),
      lead.notes ? "Notes: " + lead.notes : ""
    ];
    return lines.filter(Boolean).join("\n");
  }

  /* ---------- multi-step form ---------- */
  function initForm() {
    var form = $("#lead-form");
    if (!form) return;
    var steps = $$(".form-step", form);
    var bars = $$(".progress li", form);
    var errorBox = $("[data-form-error]", form);
    var current = 0;

    function show(i) {
      current = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      bars.forEach(function (b, k) { b.classList.toggle("done", k < i); b.classList.toggle("current", k === i); });
      if (i === 1) personalize();
      if (errorBox) errorBox.hidden = true;
      var h = $("h3", steps[i]);
      if (h) h.setAttribute("tabindex", "-1");
      if (i > 0) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        if (h) h.focus({ preventScroll: true });
      }
    }

    function personalize() {
      var line = $("[data-personal]", form);
      if (!line) return;
      var city = form.elements.city ? form.elements.city.value.trim() : "";
      var st = form.elements.state ? form.elements.state.value : "";
      var market = MARKETS[st] ? MARKETS[st].name : "";
      var where = city && market ? city + ", " + market : (market || city);
      var text = where
        ? "We buy houses in " + where + ". Two quick steps and your offer is on its way."
        : "We buy nationwide. Two quick steps and your offer is on its way.";
      $("span", line).textContent = text;
      line.hidden = false;
    }

    function fieldWrap(el) { return el.closest(".field"); }

    function validate(stepEl) {
      var ok = true;
      $$("input, select, textarea", stepEl).forEach(function (el) {
        var wrap = fieldWrap(el);
        var bad = false;
        var v = el.value.trim();
        if (el.required && !v) bad = true;
        if (el.name === "zip" && v && !/^\d{5}(-\d{4})?$/.test(v)) bad = true;
        if (el.name === "phone" && v && v.replace(/\D/g, "").length < 10) bad = true;
        if (el.name === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad = true;
        if (el.type === "checkbox" && el.required && !el.checked) bad = true;
        if (wrap) wrap.classList.toggle("invalid", bad);
        if (bad && ok) { ok = false; el.focus({ preventScroll: true }); }
      });
      if (!ok && errorBox) {
        errorBox.textContent = "Please check the highlighted fields.";
        errorBox.hidden = false;
      }
      return ok;
    }

    form.addEventListener("click", function (e) {
      var t = e.target.closest("[data-next], [data-back]");
      if (!t) return;
      e.preventDefault();
      if (t.hasAttribute("data-back")) { show(Math.max(0, current - 1)); return; }
      if (validate(steps[current])) show(Math.min(steps.length - 1, current + 1));
    });

    form.addEventListener("input", function (e) {
      var wrap = fieldWrap(e.target);
      if (wrap) wrap.classList.remove("invalid");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate(steps[current])) return;
      if (form.elements.company && form.elements.company.value) return; // honeypot
      var btn = $("button[type=submit]", form);
      var fd = new FormData(form);
      var lead = {};
      fd.forEach(function (v, k) { if (k !== "company") lead[k] = String(v).trim(); });
      lead.smsConsent = form.elements.smsConsent ? !!form.elements.smsConsent.checked : false;
      lead.submittedAt = new Date().toISOString();
      lead.page = window.location.pathname;
      lead.source = "primeacrecapital-site";
      lead.market = MARKETS[lead.state] ? MARKETS[lead.state].name : "Nationwide";

      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      submitLead(lead).then(function (result) {
        if (btn) { btn.disabled = false; btn.textContent = "Get my cash offer"; }
        steps.forEach(function (s) { s.hidden = true; });
        var progress = $(".progress", form);
        if (progress) progress.hidden = true;
        var panel = $(result.ok ? "[data-result=success]" : "[data-result=fallback]", form);
        if (!panel) return;
        var sum = $(".summary", panel);
        if (sum) sum.textContent = leadSummary(lead);
        var copy = $("[data-copy]", panel);
        if (copy) copy.addEventListener("click", function () {
          var text = leadSummary(lead);
          var done = function () { copy.textContent = "Copied"; };
          var fail = function () {
            if (sum) { var r = document.createRange(); r.selectNodeContents(sum); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
            copy.textContent = "Select and copy";
          };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
          else fail();
        });
        var mail = $("[data-mail]", panel);
        if (mail) {
          var email = String(cfg.email || "").trim();
          if (email) {
            mail.hidden = false;
            mail.setAttribute("href", "mailto:" + email + "?subject=" + encodeURIComponent("Cash offer request: " + lead.address) + "&body=" + encodeURIComponent(leadSummary(lead)));
          } else { mail.hidden = true; }
        }
        panel.hidden = false;
        try { window.localStorage.setItem("pac:lastLead", JSON.stringify(lead)); } catch (err) { /* storage unavailable */ }
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    show(0);
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

  /* ---------- cost-of-waiting calculator ---------- */
  function initCalculator() {
    var root = $("#calc");
    if (!root) return;
    var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    var num = function (id) {
      var el = $("#" + id, root);
      var v = parseFloat(String(el ? el.value : "").replace(/[^0-9.]/g, ""));
      return isFinite(v) && v >= 0 ? v : 0;
    };
    var out = function (key, value) {
      $$("[data-out=" + key + "]", root).forEach(function (el) { el.textContent = fmt.format(Math.round(value)); });
    };
    function update() {
      var months = num("c-months") || 1;
      var monthly = num("c-mortgage") + num("c-taxes") + num("c-upkeep");
      var price = num("c-price");
      var carry = monthly * months;
      var commission = price * 0.055;
      var closing = price * 0.015;
      var repairs = num("c-repairs");
      var total = carry + commission + closing + repairs;
      var us = monthly * (7 / 30);
      out("carry", carry); out("commission", commission); out("closing", closing); out("repairs", repairs);
      out("total", total); out("total2", total); out("us", us);
      var mo = $("#c-months-out", root);
      if (mo) mo.textContent = months + (months === 1 ? " month" : " months");
    }
    $$("[data-calc]", root).forEach(function (el) {
      el.addEventListener("input", update);
      if (el.type !== "range") el.addEventListener("blur", function () {
        var v = num(el.id);
        el.value = v ? new Intl.NumberFormat("en-US").format(v) : "";
        update();
      });
    });
    update();
  }

  function initYear() {
    $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function init() {
    applyContact();
    initNav();
    initSearch();
    initForm();
    initStickyCta();
    initCalculator();
    initYear();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
