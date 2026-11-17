/* Demo kit runtime: i18n (EN/ES), booking flow mock, form validation, toast. */
(function () {
  "use strict";

  /* ---------------- Toast ---------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  /* ---------------- i18n ---------------- */
  var DICT = {};
  if (window.I18N) DICT = window.I18N;
  var current = localStorage.getItem("demo-lang") || "en";

  function applyLang(lang) {
    current = lang;
    localStorage.setItem("demo-lang", lang);
    document.documentElement.lang = lang;
    var dict = DICT[lang] || {};
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-ph");
      if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (dict[key] !== undefined) el.setAttribute("alt", dict[key]);
    });
    document.querySelectorAll(".lang-toggle").forEach(function (btn) {
      var h = btn.querySelector(".active-lang");
      if (h) h.textContent = lang.toUpperCase();
    });
    // booking flow re-renders in the active language
    if (window.__bk) window.__bk.render();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-set-lang]");
    if (t) { applyLang(t.getAttribute("data-set-lang")); return; }
    var tog = e.target.closest(".lang-toggle");
    if (tog) applyLang(current === "en" ? "es" : "en");
  });

  /* ---------------- Mark "today" in hours table ---------------- */
  function markToday() {
    var d = new Date().getDay(); // 0 Sun … 6 Sat
    var map = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
    var row = document.querySelector('tr[data-day="' + map[d] + '"]');
    if (row) row.classList.add("today");
  }

  /* ---------------- Field validation ---------------- */
  function validateField(el) {
    var value = (el.value || "").trim();
    var valid = el.hasAttribute("required") ? value.length > 0 : true;
    if (valid && value && el.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (valid && value && el.type === "tel") valid = /^[\d\s()+\-.]{7,}$/.test(value);
    return valid;
  }

  /* ---------------- Form validation (mock submit) ---------------- */
  function initForms() {
    document.querySelectorAll("form[data-mock]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;
        form.querySelectorAll("[required]").forEach(function (input) {
          var field = input.closest(".field");
          var valid = validateField(input);
          field.classList.toggle("invalid", !valid);
          if (!valid) ok = false;
        });
        if (!ok) return;
        var ref = "REQ-" + Math.random().toString(36).slice(2, 7).toUpperCase();
        form.style.display = "none";
        var success = form.parentElement.querySelector(".form-success");
        if (success) {
          var refEl = success.querySelector(".ref");
          if (refEl) refEl.textContent = ref + " · " + new Date().toLocaleDateString(current === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" });
          success.classList.add("show");
          success.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      form.querySelectorAll("input, select, textarea").forEach(function (input) {
        input.addEventListener("input", function () {
          var f = input.closest(".field");
          if (f) f.classList.remove("invalid");
        });
      });
    });
  }

  /* ---------------- Booking flow ---------------- */
  function initBooking() {
    var root = document.getElementById("booking-root");
    if (!root) return;

    var SERVICES = window.DEMO_SERVICES || [];
    var L = window.DEMO_BOOKING_TEXT || {};
    var T = function (key) { var d = L[current] || L.en || {}; return d[key] || key; };

    var times = [];
    var closedDay = parseInt(root.getAttribute("data-closed-day"), 10);
    var isClosedToday = !isNaN(closedDay) && new Date().getDay() === closedDay;
    if (!isClosedToday) {
      for (var h = 9; h <= 18; h++) {
        times.push(h + ":00");
        if (h < 18) times.push(h + ":30");
      }
    }
    var taken = { "10:00": 1, "11:30": 1, "13:00": 1, "15:30": 1, "16:00": 1 };

    var state = { step: 0, service: null, time: null, name: "", phone: "" };

    function serviceRows() {
      return SERVICES.map(function (s, i) {
        var sel = state.service === i ? " sel" : "";
        var off = state.service !== null && state.service !== i ? " off" : "";
        return '<button type="button" class="slot' + sel + off + '" data-svc="' + i + '" style="grid-column: 1 / -1; text-align:left; padding:16px 18px;">' +
          '<span style="display:block; font-family: var(--sans); font-weight:600; font-size:15px;">' + s.name + '</span>' +
          '<span style="display:block; font-family: var(--mono); font-size:11px; opacity:.75; margin-top:4px;">' + s.duration + " · " + s.price + "</span></button>";
      }).join("");
    }

    function slotGrid() {
      return times.map(function (t) {
        var off = taken[t] ? " off" : "";
        var sel = state.time === t ? " sel" : "";
        return '<button type="button" class="slot' + off + sel + '" data-time="' + t + '"' + (taken[t] ? " disabled" : "") + ">" + t + "</button>";
      }).join("");
    }

    function summary() {
      var bits = [];
      if (state.service !== null) bits.push("<span>" + T("svc") + " <b>" + SERVICES[state.service].name + "</b></span>");
      if (state.time) bits.push("<span>" + T("time") + " <b>" + state.time + "</b></span>");
      return bits.length ? '<div class="bk-summary">' + bits.join("") + "</div>" : "";
    }

    function pane() {
      var s = state.step;
      if (s === 0) {
        return "<h3>" + T("s1t") + '</h3><p class="hint">' + T("s1h") + '</p><div class="slot-grid">' + serviceRows() + "</div>" +
          '<div class="bk-nav"><span></span><button type="button" class="btn btn-primary" data-next disabled>' + T("next") + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
      }
      if (s === 1) {
        var slots = times.length
          ? '<div class="slot-grid">' + slotGrid() + "</div>"
          : '<p class="closed-note">' + T("closedDay") + "</p>";
        return "<h3>" + T("s2t") + '</h3><p class="hint">' + T("s2h") + "</p>" + slots +
          '<div class="bk-nav"><button type="button" class="btn btn-ghost btn-sm" data-back>' + T("back") + '</button><button type="button" class="btn btn-primary" data-next disabled>' + T("next") + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
      }
      if (s === 2) {
        return "<h3>" + T("s3t") + '</h3><p class="hint">' + T("s3h") + '</p><div class="form">' +
          '<div class="field"><label for="bk-name">' + T("name") + '</label><input id="bk-name" type="text" autocomplete="name" value="' + state.name + '"><span class="err">' + T("errName") + "</span></div>" +
          '<div class="field"><label for="bk-phone">' + T("phone") + '</label><input id="bk-phone" type="tel" autocomplete="tel" value="' + state.phone + '"><span class="err">' + T("errPhone") + "</span></div></div>" +
          '<div class="bk-nav"><button type="button" class="btn btn-ghost btn-sm" data-back>' + T("back") + '</button><button type="button" class="btn btn-primary" data-confirm>' + T("confirm") + "</button></div>";
      }
      var ref = "BK-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      var svc = SERVICES[state.service];
      return '<div class="bk-confirm"><div class="big-check"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div>' +
        "<h3>" + T("doneT") + "</h3><p>" + T("doneP") + "</p>" +
        '<div class="ref">' + ref + " · " + svc.name + " · " + state.time + '</div>' +
        '<div class="bk-nav" style="justify-content:center;"><button type="button" class="btn btn-ghost btn-sm" data-reset>' + T("again") + "</button></div></div>";
    }

    function stepsBar() {
      var labels = [T("step1"), T("step2"), T("step3")];
      return labels.map(function (l, i) {
        var cls = i === state.step ? "on" : i < state.step ? "done" : "";
        return '<div class="bstep ' + cls + '">' + (i + 1) + " · " + l + "</div>";
      }).join("");
    }

    function render() {
      root.innerHTML = '<div class="booking-shell"><div class="booking-steps">' + stepsBar() + '</div>' +
        '<div class="booking-pane">' + summary() + pane() + "</div></div>";
      var next = root.querySelector("[data-next]");
      if (next) next.disabled = state.step === 0 ? state.service === null : !state.time;
    }

    root.addEventListener("click", function (e) {
      var svcBtn = e.target.closest("[data-svc]");
      if (svcBtn) { state.service = parseInt(svcBtn.getAttribute("data-svc"), 10); render(); return; }
      var timeBtn = e.target.closest("[data-time]");
      if (timeBtn && !timeBtn.disabled) { state.time = timeBtn.getAttribute("data-time"); render(); return; }
      if (e.target.closest("[data-next]")) {
        if (state.step === 0 && state.service !== null) { state.step = 1; render(); }
        else if (state.step === 1 && state.time) { state.step = 2; render(); }
        return;
      }
      if (e.target.closest("[data-back]")) { state.step = Math.max(0, state.step - 1); render(); return; }
      if (e.target.closest("[data-confirm]")) {
        var name = root.querySelector("#bk-name"), phone = root.querySelector("#bk-phone");
        var ok = true;
        if (!name.value.trim()) { name.closest(".field").classList.add("invalid"); ok = false; }
        if (!/^[\d\s()+\-.]{7,}$/.test(phone.value.trim())) { phone.closest(".field").classList.add("invalid"); ok = false; }
        if (!ok) return;
        state.name = name.value.trim(); state.phone = phone.value.trim();
        state.step = 3; render();
        root.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (e.target.closest("[data-reset]")) { state = { step: 0, service: null, time: null, name: "", phone: "" }; render(); }
    });

    root.addEventListener("input", function (e) {
      var f = e.target.closest(".field");
      if (f) f.classList.remove("invalid");
    });

    window.__bk = { render: render };
    render();
  }

  /* ---------------- Demo action buttons (toast feedback) ---------------- */
  document.addEventListener("click", function (e) {
    var d = e.target.closest("[data-demo-action]");
    if (!d) return;
    e.preventDefault();
    var key = d.getAttribute("data-demo-action");
    var lang = current === "es" ? "es" : "en";
    var msgs = {
      "order": { en: "DEMO — in production this opens your online ordering link", es: "DEMO — en producción esto abre su enlace de pedidos en línea" },
      "reserve": { en: "DEMO — in production this opens your reservation form", es: "DEMO — en producción esto abre su formulario de reservación" },
      "directions": { en: "DEMO — links to your Google Business Profile listing", es: "DEMO — enlaza a su perfil de Google Business" },
      "gallery": { en: "DEMO — your real project photos go here", es: "DEMO — aquí van las fotos reales de sus proyectos" }
    };
    toast((msgs[key] || {})[lang] || key);
  });

  /* ---------------- Mobile navigation ---------------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;

    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    links.addEventListener("click", function (e) {
      if (!e.target.closest("a")) return;
      links.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  /* ---------------- Project inquiry form ---------------- */
  function initInquiry() {
    var form = document.getElementById("inquiry-form");
    if (!form) return;

    var success = document.getElementById("inquiry-success");
    var again = document.getElementById("inquiry-again");

    function fieldOf(el) { return el.closest(".field"); }

    function validate() {
      var ok = true;
      form.querySelectorAll("input, select, textarea").forEach(function (el) {
        var field = fieldOf(el);
        if (!field) return;
        var valid = validateField(el);
        field.classList.toggle("invalid", !valid);
        if (!valid) ok = false;
      });
      return ok;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) {
        var bad = form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea");
        if (bad) bad.focus();
        return;
      }

      var record = {
        ref: "OKC-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
        name: form.querySelector("#c-name").value.trim(),
        business: form.querySelector("#c-biz").value.trim(),
        email: form.querySelector("#c-email").value.trim(),
        phone: form.querySelector("#c-phone").value.trim(),
        projectType: form.querySelector("#c-type").value,
        message: form.querySelector("#c-msg").value.trim(),
        lang: current,
        createdAt: new Date().toISOString()
      };

      try {
        var key = "okc-inquiries";
        var list = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(list)) list = [];
        list.push(record);
        list = list.slice(-10);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (err) { /* storage unavailable — success card still renders */ }

      form.style.display = "none";
      if (success) {
        var refEl = success.querySelector(".ref");
        if (refEl) {
          refEl.textContent = record.ref + " · " + new Date().toLocaleDateString(
            current === "es" ? "es-US" : "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          );
        }
        success.classList.add("show");
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.addEventListener("input", function () {
        var f = fieldOf(el);
        if (f) f.classList.remove("invalid");
      });
    });

    if (again) {
      again.addEventListener("click", function () {
        form.reset();
        form.querySelectorAll(".field").forEach(function (f) { f.classList.remove("invalid"); });
        form.style.display = "";
        if (success) success.classList.remove("show");
        var first = form.querySelector("input, select, textarea");
        if (first) first.focus();
      });
    }
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    markToday();
    initForms();
    initBooking();
    initNav();
    initInquiry();
    applyLang(current);
  });
})();
