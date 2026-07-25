/* Accu-Track diagnostic step funnel.
   Renders into #vx-diagnostic on lead pages (replaces the embedded form) and
   into #vx-reveal on the thank-you page (the two findings). Pre-rendered HTML
   carries a noscript fallback to contact.html; nothing else depends on JS. */
(function () {
  "use strict";

  /* ------------------------------ Data ---------------------------------- */

  var LANES = {
    licensing: "Licensing compliance",
    contract: "Contract management",
    royalty: "Royalty reporting",
    deduction: "Deduction recovery",
    notsure: "Not sure yet",
  };

  var SYMPTOMS = {
    licensing: [
      ["lic_late", "Royalty reports show up late or not at all"],
      ["lic_mismatch", "The numbers never quite match the agreement"],
      ["lic_spreadsheet", "Renewals and deadlines live in a spreadsheet"],
      ["lic_capacity", "Nobody has time to check any of it"],
    ],
    contract: [
      ["con_renewals", "Renewal dates slip past before anyone notices"],
      ["con_inbox", "Obligations live in inboxes and memory"],
      ["con_visibility", "Nobody can say what is due this month"],
      ["con_volume", "The volume outgrew the person watching it"],
    ],
    royalty: [
      ["roy_late", "Reports arrive late or incomplete"],
      ["roy_facevalue", "We take the licensee's math at face value"],
      ["roy_suspicion", "Short payments are a suspicion, not a number"],
      ["roy_audit", "A formal audit feels too heavy to start"],
    ],
    deduction: [
      ["ded_pace", "Deductions hit faster than we can review them"],
      ["ded_fines", "Shortage fines and chargebacks pile up"],
      ["ded_writeoff", "We dispute a few and write off the rest"],
      ["ded_unknown", "Nobody knows the true annual total"],
    ],
    notsure: [
      ["gen_spreadsheet", "Tracking lives in spreadsheets and memory"],
      ["gen_leak", "Money is leaking somewhere nobody has quantified"],
      ["gen_facevalue", "We take reported numbers at face value"],
      ["gen_secondjob", "It has become somebody's second job"],
    ],
  };

  /* Findings: text + cost line. "group" prevents two findings citing the
     same source from appearing together. Every number here is attributed
     and already vetted site copy. */
  var FINDINGS = {
    f_reconcile_gap: {
      group: "study",
      text: "Nothing here says anyone is checking what licensees report against what the agreements say.",
      cost: "A 20-year study of licensee audits found gaps of 15 to 25 percent on portfolios where that check is missing.",
    },
    f_lic_late: {
      text: "Late or missing royalty reports are the first visible sign of a reporting process nobody owns.",
      cost: "The reports that do arrive get taken at face value, and that is where the money leaks.",
    },
    f_lic_mismatch: {
      text: "Reported numbers that never quite tie back to the agreement point to a structural gap in how royalties get calculated.",
      cost: "Without reconciliation the shortfall compounds quietly from one royalty period to the next.",
    },
    f_spreadsheet: {
      text: "Your deadlines depend on a person remembering to open a spreadsheet at the right time.",
      cost: "The miss never announces itself. It surfaces months later, already expensive.",
    },
    f_capacity: {
      text: "The portfolio has outgrown the hours anyone can give it, and obligations slip at exactly that point.",
      cost: "The slipping is quiet. That is what makes it expensive.",
    },
    f_con_renewals: {
      text: "Renewal dates that slip past unnoticed are the most expensive habit in contract admin.",
      cost: "An unwanted auto-renewal costs money. A lapsed agreement costs more.",
    },
    f_con_inbox: {
      text: "Your obligations live in inboxes and individual memory.",
      cost: "That holds until the one person who remembers is away the week it matters.",
    },
    f_con_visibility: {
      text: "If nobody can say what is due this month, some of it is already being missed.",
      cost: "Those misses stay invisible until one of them lands on an invoice.",
    },
    f_con_volume: {
      text: "The agreement count has passed what one person can track by hand.",
      cost: "Past that point a miss stops being a question of if.",
    },
    f_roy_facevalue: {
      group: "study",
      text: "Licensees calculate their own royalties, and right now those numbers are being taken at face value.",
      cost: "A 20-year study of licensee audits puts the gap at 15 to 25 percent where reporting breaks.",
    },
    f_roy_suspicion: {
      text: "A shortfall you suspect but have never quantified tends to grow until someone runs the numbers.",
      cost: "Reconciliation turns the suspicion into a figure you can collect on.",
    },
    f_roy_audit: {
      text: "A formal audit feels heavy, so the checking never starts.",
      cost: "Reconciliation is the lighter first step. It finds short payments without turning anything into a legal event.",
    },
    f_ded_uncontested: {
      text: "Deductions that go uncontested become permanent margin loss.",
      cost: "The recovery window is finite, and it favors whoever documents first.",
    },
    f_ded_pace: {
      text: "Fines and chargebacks are landing faster than your team can review them.",
      cost: "That pace difference is where the margin goes.",
    },
    f_ded_writeoff: {
      text: "Disputing a few and writing off the rest has quietly made the write-off your default.",
      cost: "The retailers' systems are built to let that stand.",
    },
    f_ded_unknown: {
      text: "Nobody has the true annual deduction total, which means the loss is running bigger than the estimate.",
      cost: "Estimates only count the deductions someone happened to see.",
    },
    f_gen_leak: {
      text: "Money is leaking somewhere and nobody has put a number on it yet.",
      cost: "Unquantified leaks read as small by default. They rarely are once someone reconciles.",
    },
    f_scale: {
      text: "At this agreement count, manual tracking is past the point where diligence can save it.",
      cost: "The failure is structural. More effort from the same people does not fix structure.",
    },
    f_small: {
      text: "The portfolio is small enough that tracking it became somebody's second job.",
      cost: "Second jobs lose to first jobs every week, and the misses land the same as they do at scale.",
    },
    f_default: {
      text: "The operation runs on effort and memory.",
      cost: "That holds right up until it does not, and the first miss is rarely a small one.",
    },
  };

  /* Ordered candidates per lane: [findingKey, matchFn]. First two distinct
     matches (by group) are shown; the rest of the matches ride to the CRM. */
  function candidates(lane) {
    var never = function (a) { return a.recency === "never" || a.recency === "unsure"; };
    var has = function (k) { return function (a) { return a.symptoms.indexOf(k) !== -1; }; };
    var big = function (a) { return a.scale === "s500" || a.scale === "p500"; };
    var small = function (a) { return a.scale === "u50"; };
    var always = function () { return true; };
    var map = {
      licensing: [
        ["f_reconcile_gap", never],
        ["f_lic_mismatch", has("lic_mismatch")],
        ["f_lic_late", has("lic_late")],
        ["f_spreadsheet", has("lic_spreadsheet")],
        ["f_capacity", has("lic_capacity")],
        ["f_scale", big],
        ["f_small", small],
        ["f_default", always],
      ],
      contract: [
        ["f_con_renewals", has("con_renewals")],
        ["f_con_visibility", has("con_visibility")],
        ["f_con_inbox", has("con_inbox")],
        ["f_con_volume", has("con_volume")],
        ["f_scale", big],
        ["f_small", small],
        ["f_default", always],
      ],
      royalty: [
        ["f_roy_facevalue", has("roy_facevalue")],
        ["f_reconcile_gap", never],
        ["f_roy_suspicion", has("roy_suspicion")],
        ["f_roy_audit", has("roy_audit")],
        ["f_lic_late", has("roy_late")],
        ["f_scale", big],
        ["f_default", always],
      ],
      deduction: [
        ["f_ded_unknown", has("ded_unknown")],
        ["f_ded_pace", function (a) { return a.symptoms.indexOf("ded_pace") !== -1 || a.symptoms.indexOf("ded_fines") !== -1; }],
        ["f_ded_writeoff", has("ded_writeoff")],
        ["f_ded_uncontested", always],
        ["f_scale", big],
      ],
      notsure: [
        ["f_reconcile_gap", never],
        ["f_gen_leak", has("gen_leak")],
        ["f_roy_facevalue", has("gen_facevalue")],
        ["f_spreadsheet", has("gen_spreadsheet")],
        ["f_small", function (a) { return a.symptoms.indexOf("gen_secondjob") !== -1 || a.scale === "u50"; }],
        ["f_scale", big],
        ["f_default", always],
      ],
    };
    return map[lane] || map.notsure;
  }

  function pickFindings(a) {
    var shown = [];
    var held = [];
    var groups = {};
    var list = candidates(a.service);
    for (var i = 0; i < list.length; i++) {
      var key = list[i][0];
      if (!list[i][1](a)) continue;
      if (shown.indexOf(key) !== -1 || held.indexOf(key) !== -1) continue;
      var g = FINDINGS[key].group;
      if (shown.length < 2) {
        if (g && groups[g]) { held.push(key); continue; }
        if (g) groups[g] = true;
        shown.push(key);
      } else if (held.length < 4) {
        held.push(key);
      }
    }
    if (!shown.length) shown.push("f_default");
    return { shown: shown, held: held };
  }

  /* --------------------------- Small helpers ----------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function track(name, lane) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, diagnosticLane: lane });
    } catch (e) {}
  }

  function firstTouch() {
    var qs = window.location.search.slice(1);
    var keep = [];
    if (qs) {
      var parts = qs.split("&");
      for (var i = 0; i < parts.length; i++) {
        if (/^(utm_|gclid|gbraid|wbraid|msclkid)/.test(parts[i])) keep.push(parts[i]);
      }
    }
    try {
      var stored = window.localStorage.getItem("vx_ft");
      if (!stored && keep.length) {
        window.localStorage.setItem("vx_ft", keep.join("&"));
        return keep.join("&");
      }
      return stored || keep.join("&");
    } catch (e) {
      return keep.join("&");
    }
  }

  function currentGclid() {
    var m = window.location.search.match(/[?&]gclid=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    var ft = firstTouch();
    m = ft.match(/(?:^|&)gclid=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  /* ------------------------------ The card ------------------------------- */

  function buildCard(mount) {
    var pageLane = mount.getAttribute("data-service") || "";
    var state = {
      service: "",
      scale: "",
      symptoms: [],
      recency: "",
      timeline: "",
      step: 0,
      started: false,
    };
    var TOTAL = 6;

    var card = el("div", "vx-diag");
    var meta = el("div", "vx-diag__meta");
    var metaLeft = el("span", "", "Free Assessment");
    var metaRight = el("span", "");
    meta.appendChild(metaLeft);
    meta.appendChild(metaRight);
    var bar = el("div", "vx-diag__bar");
    var barFill = el("i");
    bar.appendChild(barFill);
    var body = el("div", "vx-diag__body");
    card.appendChild(meta);
    card.appendChild(bar);
    card.appendChild(body);
    mount.appendChild(card);

    function setProgress() {
      metaRight.textContent = "Question " + (state.step + 1) + " of " + TOTAL;
      barFill.style.width = (((state.step + 1) / TOTAL) * 100) + "%";
    }

    function heading(text, sub) {
      var h = el("h3", "vx-diag__q", text);
      h.setAttribute("tabindex", "-1");
      body.appendChild(h);
      if (sub) body.appendChild(el("p", "vx-diag__sub", sub));
      return h;
    }

    function nav(showBack) {
      var row = el("div", "vx-diag__nav");
      if (showBack) {
        var back = el("button", "vx-back", "Back");
        back.type = "button";
        back.addEventListener("click", function () {
          state.step -= 1;
          render();
        });
        row.appendChild(back);
      } else {
        row.appendChild(el("span"));
      }
      body.appendChild(row);
      return row;
    }

    function option(label, selected, onPick, tag) {
      var b = el("button", "vx-opt");
      b.type = "button";
      b.appendChild(document.createTextNode(label));
      if (tag) b.appendChild(el("span", "vx-opt__tag", tag));
      if (selected) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", onPick);
      return b;
    }

    function advance() {
      state.step += 1;
      render();
    }

    function pickOnce(field, value) {
      return function () {
        state[field] = value;
        if (!state.started) {
          state.started = true;
          track("diagnostic_start", state.service || pageLane || "unset");
        }
        advance();
      };
    }

    function render() {
      body.innerHTML = "";
      setProgress();
      var lane = state.service || pageLane || "notsure";
      var h;

      if (state.step === 0) {
        h = heading("What should we look at first?", "About a minute, six quick answers. A specialist calls within one business hour.");
        Object.keys(LANES).forEach(function (key) {
          body.appendChild(option(
            LANES[key],
            state.service === key,
            pickOnce("service", key),
            key === pageLane ? "This page" : ""
          ));
        });
        nav(false);
      } else if (state.step === 1) {
        h = heading("Roughly how many contracts or agreements are in play?");
        [["u50", "Under 50"], ["s200", "50 to 200"], ["s500", "201 to 500"], ["p500", "More than 500"], ["unsure", "Not sure"]].forEach(function (o) {
          body.appendChild(option(o[1], state.scale === o[0], pickOnce("scale", o[0])));
        });
        nav(true);
      } else if (state.step === 2) {
        h = heading("Which of these sound familiar?", "Pick any that apply.");
        SYMPTOMS[lane].forEach(function (o) {
          var b = option(o[1], state.symptoms.indexOf(o[0]) !== -1, function () {
            var idx = state.symptoms.indexOf(o[0]);
            if (idx === -1) state.symptoms.push(o[0]);
            else state.symptoms.splice(idx, 1);
            b.setAttribute("aria-pressed", state.symptoms.indexOf(o[0]) !== -1 ? "true" : "false");
          });
          body.appendChild(b);
        });
        var row = nav(true);
        var cont = el("button", "btn btn--primary", "Continue");
        cont.type = "button";
        cont.addEventListener("click", advance);
        row.appendChild(cont);
      } else if (state.step === 3) {
        h = heading(lane === "deduction"
          ? "When did anyone last go through the deductions line by line?"
          : "When did anyone last reconcile the numbers against the agreements?");
        [["year", "Within the last year"], ["three", "One to three years ago"], ["never", "Never"], ["unsure", "Not sure"]].forEach(function (o) {
          body.appendChild(option(o[1], state.recency === o[0], pickOnce("recency", o[0])));
        });
        nav(true);
      } else if (state.step === 4) {
        h = heading("How soon do you want eyes on this?");
        [["month", "This month"], ["quarter", "This quarter"], ["gathering", "Just gathering information"]].forEach(function (o) {
          body.appendChild(option(o[1], state.timeline === o[0], pickOnce("timeline", o[0])));
        });
        nav(true);
      } else {
        h = heading("Last step. Who gets the results?", "A specialist reviews your answers and calls within one business hour.");
        var form = el("form", "vx-form");
        form.setAttribute("novalidate", "novalidate");

        function field(name, label, type, required, auto) {
          var wrap = el("div", "vx-field");
          var lab = el("label", "", label);
          lab.setAttribute("for", "vx-" + name);
          var input = el("input");
          input.type = type;
          input.id = "vx-" + name;
          input.name = name;
          if (required) input.required = true;
          if (auto) input.setAttribute("autocomplete", auto);
          wrap.appendChild(lab);
          wrap.appendChild(input);
          form.appendChild(wrap);
          return input;
        }

        var fName = field("name", "Full name", "text", true, "name");
        var fEmail = field("email", "Work email", "email", true, "email");
        var fPhone = field("phone", "Direct phone", "tel", true, "tel");
        var fCompany = field("company", "Company (optional)", "text", false, "organization");

        var hp = el("input", "vx-hp");
        hp.type = "text";
        hp.name = "website";
        hp.tabIndex = -1;
        hp.setAttribute("autocomplete", "off");
        hp.setAttribute("aria-hidden", "true");
        form.appendChild(hp);

        var err = el("p", "vx-err");
        err.setAttribute("aria-live", "polite");
        form.appendChild(err);

        var submit = el("button", "btn btn--primary btn--block", "Request a Free Assessment");
        submit.type = "submit";
        form.appendChild(submit);
        form.appendChild(el("p", "vx-note", "We call within one business hour. No sequence, no spam."));

        form.addEventListener("submit", function (e) {
          e.preventDefault();
          err.textContent = "";
          var name = fName.value.trim();
          var email = fEmail.value.trim();
          var phone = fPhone.value.trim();
          if (!name) { err.textContent = "Add your name so we know who to ask for."; fName.focus(); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "That email does not look complete."; fEmail.focus(); return; }
          if (phone.replace(/\D/g, "").length < 10) { err.textContent = "Add a phone number with area code so a specialist can reach you."; fPhone.focus(); return; }

          var picks = pickFindings(state);
          var payload = {
            service: state.service,
            scale: state.scale,
            symptoms: state.symptoms,
            recency: state.recency,
            timeline: state.timeline,
            shown: picks.shown,
            held: picks.held,
            name: name,
            email: email,
            phone: phone,
            company: fCompany.value.trim(),
            website: hp.value,
            page: window.location.pathname,
            referrer: document.referrer || "",
            firstTouch: firstTouch(),
            gclid: currentGclid(),
          };

          submit.disabled = true;
          submit.textContent = "Sending...";

          fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then(function (r) { return r.json(); })
            .then(function (r) {
              if (!r || !r.ok) throw new Error("api");
              try {
                window.sessionStorage.setItem("vxDiag", JSON.stringify({
                  n: name.split(" ")[0],
                  shown: picks.shown,
                }));
              } catch (e2) {}
              track("diagnostic_submit", state.service);
              window.location.href = "/thank-you";
            })
            .catch(function () {
              submit.disabled = false;
              submit.textContent = "Request a Free Assessment";
              err.textContent = "Your answers did not send. Call (860) 236-8002 or use the contact page and we will take it from there.";
            });
        });

        body.appendChild(form);
        nav(true);
      }

      if (h && state.started) h.focus({ preventScroll: true });
    }

    render();
  }

  /* --------------------------- Thank-you reveal -------------------------- */

  function buildReveal(mount) {
    var raw;
    try { raw = window.sessionStorage.getItem("vxDiag"); } catch (e) { raw = null; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.shown || !data.shown.length) return;

    var box = el("div", "vx-reveal");
    box.appendChild(el("p", "vx-reveal__eyebrow", "From your answers"));
    var lead = el("p", "vx-reveal__lead");
    lead.textContent = (data.n ? data.n + ", here" : "Here") + " is what stood out while your assessment gets a proper read:";
    box.appendChild(lead);

    for (var i = 0; i < Math.min(data.shown.length, 2); i++) {
      var f = FINDINGS[data.shown[i]];
      if (!f) continue;
      var item = el("div", "vx-finding");
      var n = el("span", "vx-finding__n", "0" + (i + 1));
      var p = el("p");
      p.appendChild(n);
      p.appendChild(document.createTextNode(f.text + " " + f.cost));
      item.appendChild(p);
      box.appendChild(item);
    }

    box.appendChild(el("p", "vx-reveal__more", "The full read goes deeper than these two. Your specialist walks through the rest on the call, with your agreements in front of them."));
    mount.appendChild(box);
    mount.hidden = false;
  }

  /* ------------------------------- Boot ---------------------------------- */

  firstTouch();
  var cardMount = document.getElementById("vx-diagnostic");
  if (cardMount) buildCard(cardMount);
  var revealMount = document.getElementById("vx-reveal");
  if (revealMount) buildReveal(revealMount);
})();
