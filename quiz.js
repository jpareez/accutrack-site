/* Site quiz card: the same 3-question form the /start ad landers run, mounted on the
   main site wherever a <div class="qz" data-lane="..."> sits. data-lane picks the
   situation list (licensing | contract | royalty | deduction); empty = cross list.
   Posts to /api/lead with the /start payload shape, then /thank-you (source "site").
   Copy below mirrors start.html; change both together. */
(function () {
  "use strict";

  var SITS = {
    sit_light:      ["Royalty checks look lighter than they should", "royalty"],
    sit_late:       ["Statements or payments show up late or not at all", "licensing"],
    sit_surprise:   ["A renewal or deadline caught us off guard", "licensing"],
    sit_inherit:    ["We're acquiring, and agreements keep piling up", "contract"],
    sit_pile:       ["Contracts are piling up faster than we can track them", "contract"],
    sit_slip:       ["Renewals keep slipping past us", "contract"],
    sit_clm:        ["We priced contract software and it didn't add up", "contract"],
    sit_trust:      ["We take the licensees' math on trust", "royalty"],
    sit_stopped:    ["A licensee has gone quiet on reporting", "royalty"],
    sit_audit:      ["Weighing a formal royalty audit", "royalty"],
    sit_deduct:     ["Retailers keep taking money off our invoices", "deduction"],
    sit_otif:       ["OTIF fines and chargebacks are stacking up", "deduction"],
    sit_sizing:     ["Trying to size what we lose to deductions a year", "deduction"],
    sit_compliance: ["Licensing compliance needs to get under control", "licensing"],
    sit_ahead:      ["Just getting ahead of it", ""]
  };
  var LANE_SITS = {
    licensing: ["sit_light", "sit_late", "sit_surprise", "sit_inherit", "sit_ahead"],
    contract:  ["sit_pile", "sit_slip", "sit_clm", "sit_inherit", "sit_ahead"],
    royalty:   ["sit_light", "sit_stopped", "sit_trust", "sit_audit", "sit_ahead"],
    deduction: ["sit_deduct", "sit_otif", "sit_sizing", "sit_ahead"],
    cross:     ["sit_light", "sit_pile", "sit_deduct", "sit_compliance", "sit_inherit", "sit_ahead"]
  };
  var SCALES = [["A couple dozen or fewer","u25"],["25 to 100","s100"],["100 to 250","s250"],["250 to 500","s500"],["More than 500","p500"]];
  var TIMES  = [["This month","month"],["This quarter","quarter"],["Just gathering info","gathering"]];
  var STEP_NAMES = { 1: "situation", 2: "scale", 3: "timeline", 4: "contact_form" };
  var PHONE = "(860) 236-8002", TEL = "tel:+18602368002";

  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };

  function param(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }
  function firstTouch() {
    var qs = window.location.search.slice(1);
    if (!qs) return "";
    var keep = [];
    qs.split("&").forEach(function (p) { if (/^(utm_|gclid|gbraid|wbraid|s=)/.test(p)) keep.push(p); });
    return keep.join("&").slice(0, 400);
  }
  /* Same event names as /start plus funnel_surface "site", so the two read apart in GA4/Clarity. */
  function track(name, lane, extra) {
    try {
      var ev = { event: name, diagnosticLane: lane || "", funnel_step: "", step_name: "", answer: "", funnel_surface: "site" };
      if (extra) for (var k in extra) ev[k] = extra[k];
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(ev);
      window.clarity("event", "site_" + (ev.funnel_step ? name + "_" + ev.funnel_step : name));
      if (lane) window.clarity("set", "funnel_lane", lane);
    } catch (e) {}
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function mount(root) {
    var lane = root.getAttribute("data-lane") || "";
    if (!LANE_SITS[lane] || lane === "cross") lane = "";
    var state = { lane: lane, situation: "", scale: "", timeline: "", started: false, step: 1 };

    root.innerHTML =
      '<div class="qz__top"><p class="qz__kicker">Free Assessment</p><p class="qz__count">Step 1 of 4</p></div>' +
      '<div class="qz__bar" aria-hidden="true"><div class="qz__fill"></div></div>' +
      '<div class="qz__step" aria-live="polite"></div>' +
      '<p class="qz__err"></p>' +
      '<div class="qz__foot"><button type="button" class="qz__back">Back</button>' +
      '<p class="qz__call">Rather talk it through? <a href="' + TEL + '">' + PHONE + '</a></p></div>';

    var stepEl = root.querySelector(".qz__step"), backEl = root.querySelector(".qz__back");
    var errEl = root.querySelector(".qz__err"), barEl = root.querySelector(".qz__fill");
    var cntEl = root.querySelector(".qz__count");

    function setStep(n) {
      state.step = n;
      track("funnel_step_view", state.lane, { funnel_step: n, step_name: STEP_NAMES[n] });
      barEl.style.transform = "scaleX(" + (n * 0.25) + ")";
      cntEl.textContent = "Step " + n + " of 4";
      backEl.style.display = n > 1 ? "inline" : "none";
      errEl.style.display = "none";
    }
    function chips(list, onPick) {
      var wrap = el("div", "qz__chips");
      list.forEach(function (item) {
        var b = el("button", "qz__chip", item[0]);
        b.type = "button";
        b.addEventListener("click", function () {
          if (!state.started) { state.started = true; track("funnel_start", state.lane); }
          track("funnel_answer", state.lane, { funnel_step: state.step, step_name: STEP_NAMES[state.step], answer: item[1] });
          onPick(item);
        });
        wrap.appendChild(b);
      });
      return wrap;
    }
    function render(title, node) {
      stepEl.innerHTML = "";
      stepEl.appendChild(el("p", "qz__q", title));
      stepEl.appendChild(node);
    }
    /* After the first answer, keep the card in view: the page may have scrolled. */
    function keepInView() {
      var r = root.getBoundingClientRect();
      if (r.top < 0 && root.scrollIntoView) root.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    function step1() {
      setStep(1);
      var keys = LANE_SITS[state.lane] || LANE_SITS.cross;
      render("What is going on?", chips(keys.map(function (k) { return [SITS[k][0], k]; }), function (item) {
        state.situation = item[1];
        if (!state.lane) state.lane = SITS[item[1]][1] || "notsure";
        step2();
      }));
    }
    function step2() {
      setStep(2);
      render("How many agreements are in play?", chips(SCALES, function (item) { state.scale = item[1]; step3(); }));
      keepInView();
    }
    function step3() {
      setStep(3);
      render("When do you want this handled?", chips(TIMES, function (item) { state.timeline = item[1]; step4(); }));
      keepInView();
    }
    function step4() {
      setStep(4);
      var id = "qz" + Math.random().toString(36).slice(2, 7);
      var form = document.createElement("form");
      form.noValidate = true;
      form.innerHTML =
        '<div class="qz__field"><label for="' + id + 'n">Name</label>' +
        '<input id="' + id + 'n" name="name" autocomplete="name" placeholder="Full name" /></div>' +
        '<div class="qz__field"><label for="' + id + 'e">Work email</label>' +
        '<input id="' + id + 'e" name="email" type="email" autocomplete="email" placeholder="name@company.com" /></div>' +
        '<div class="qz__field"><label for="' + id + 'p">Direct phone</label>' +
        '<input id="' + id + 'p" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 555-0100" /></div>' +
        '<div class="qz__hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>' +
        '<button type="submit" class="btn btn--primary btn--lg btn--block">Get my read <span class="arrow" aria-hidden="true">&rarr;</span></button>' +
        '<p class="qz__privacy">We reply within one business hour. Your information stays confidential.</p>';
      form.addEventListener("submit", function (e) { e.preventDefault(); submitLead(form); });
      var typed = false;
      form.addEventListener("input", function () {
        if (typed) return;
        typed = true;
        track("funnel_form_start", state.lane, { funnel_step: 4, step_name: STEP_NAMES[4] });
      });
      render("Where should we send what we find?", form);
      keepInView();
      var first = form.querySelector('input[name="name"]');
      if (first) first.focus({ preventScroll: true });
    }

    function fail(msg, why) {
      track("funnel_error", state.lane, { funnel_step: state.step, step_name: STEP_NAMES[state.step], answer: why || "network" });
      errEl.textContent = msg || "That didn't go through. Try again, or call " + PHONE + " and we'll take it from there.";
      errEl.style.display = "block";
      if (errEl.scrollIntoView) errEl.scrollIntoView({ block: "nearest" });
    }

    function submitLead(form) {
      var get = function (n) { return (form.querySelector('input[name="' + n + '"]').value || "").trim(); };
      var name = get("name"), email = get("email"), phone = get("phone"), hp = get("website");
      if (!name) return fail("Add your name and we're good to go.", "no_name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn't look complete.", "bad_email");
      if (phone.replace(/\D/g, "").length < 10) return fail("Add a direct number with area code so the call actually lands.", "bad_phone");

      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Sending...";
      var reset = function () { btn.disabled = false; btn.textContent = "Get my read"; fail(); };

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: state.lane || "notsure", situation: state.situation, scale: state.scale,
          symptoms: [], recency: "", timeline: state.timeline, exposure: "",
          name: name, email: email, phone: phone, company: "", website: hp,
          page: window.location.pathname + window.location.search,
          referrer: document.referrer || "", firstTouch: firstTouch(), gclid: param("gclid")
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r && r.ok) {
            track("funnel_submit", state.lane, { funnel_step: 4, step_name: "submitted" });
            /* /thank-you pushes lead_submitted with this source and fires the Website Lead Form conversion. */
            try { window.sessionStorage.setItem("vxLeadSource", "site"); } catch (e) {}
            window.location.href = "/thank-you";
          } else reset();
        })
        .catch(reset);
    }

    backEl.addEventListener("click", function () {
      track("funnel_back", state.lane, { funnel_step: state.step, step_name: STEP_NAMES[state.step] });
      if (state.step === 2) step1(); else if (state.step === 3) step2(); else if (state.step === 4) step3();
    });

    track("funnel_landing", state.lane);
    step1();
  }

  var roots = document.querySelectorAll(".qz");
  for (var i = 0; i < roots.length; i++) mount(roots[i]);
})();
