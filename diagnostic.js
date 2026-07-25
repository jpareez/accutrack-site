/* Accu-Track free-assessment conversation.
   Runs full-screen on assessment.html (#vx-chat) and renders the findings
   recap on thank-you.html (#vx-reveal). Answers are tap-chips and short
   text turns; the diagnosis is rule-mapped from vetted copy. Pre-rendered
   noscript fallback points to contact.html; nothing else depends on JS. */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function param(name) {
    var m = window.location.search.match(new RegExp("[?&]" + name + "=([^&]+)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  /* ------------------------------ The chat ------------------------------- */

  function buildChat() {
    var log = document.getElementById("vx-log");
    var controls = document.getElementById("vx-controls");
    if (!log || !controls) return;

    var state = {
      service: "", scale: "", symptoms: [], recency: "", timeline: "",
      name: "", first: "", email: "", phone: "", company: "",
      picks: null, started: false,
    };

    function scrollDown() {
      window.requestAnimationFrame(function () {
        log.scrollTop = log.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
    }

    function bubble(cls, text) {
      var b = document.createElement("div");
      b.className = "chat-msg " + cls;
      b.textContent = text;
      log.appendChild(b);
      scrollDown();
      return b;
    }

    function addUser(text) { bubble("chat-msg--user", text); }

    /* Typing indicator, then the bot line, then cb. */
    function addBot(text, cb, extraDelay) {
      var t = document.createElement("div");
      t.className = "chat-msg chat-msg--bot chat-typing";
      t.setAttribute("aria-hidden", "true");
      t.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(t);
      scrollDown();
      var delay = reduce ? 60 : Math.min(350 + text.length * 9, 1050) + (extraDelay || 0);
      window.setTimeout(function () {
        t.className = "chat-msg chat-msg--bot";
        t.removeAttribute("aria-hidden");
        t.innerHTML = "";
        t.textContent = text;
        scrollDown();
        if (cb) cb();
      }, delay);
    }

    /* Seed an instant bot line (no typing), for pre-answered entries. */
    function seedBot(text) { bubble("chat-msg--bot", text); }

    function clearControls() { controls.innerHTML = ""; }

    function chip(label, onTap, ghost) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chat-chip" + (ghost ? " chat-chip--ghost" : "");
      b.textContent = label;
      b.addEventListener("click", onTap);
      return b;
    }

    function setChips(items) {
      clearControls();
      var row = document.createElement("div");
      row.className = "chat-chiprow";
      items.forEach(function (it) { row.appendChild(chip(it[0], it[1], it[2])); });
      controls.appendChild(row);
      scrollDown();
    }

    function setTextInput(opts) {
      clearControls();
      var form = document.createElement("form");
      form.className = "chat-inputrow";
      form.setAttribute("novalidate", "novalidate");
      var label = document.createElement("label");
      label.className = "visually-hidden";
      label.setAttribute("for", "vx-in");
      label.textContent = opts.label;
      var input = document.createElement("input");
      input.id = "vx-in";
      input.type = opts.type || "text";
      input.placeholder = opts.placeholder || "";
      input.setAttribute("autocomplete", opts.auto || "off");
      var send = document.createElement("button");
      send.type = "submit";
      send.className = "chat-send";
      send.textContent = "Send";
      form.appendChild(label);
      form.appendChild(input);
      form.appendChild(send);
      controls.appendChild(form);
      if (opts.skip) {
        var skiprow = document.createElement("div");
        skiprow.className = "chat-chiprow";
        skiprow.appendChild(chip(opts.skip, function () { opts.onSkip(); }, true));
        controls.appendChild(skiprow);
      }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.trim();
        var err = opts.validate ? opts.validate(v) : "";
        if (err) { addBot(err, function () { input.focus(); }); return; }
        opts.onSubmit(v);
      });
      input.focus();
      scrollDown();
    }

    function begin() {
      if (!state.started) { state.started = true; track("diagnostic_start", state.service || "unset"); }
    }

    /* ------------------------------ Steps -------------------------------- */

    var Q1 = "What got you looking today?";

    function laneChips() {
      return Object.keys(LANES).map(function (key) {
        return [LANES[key], function () {
          begin();
          state.service = key;
          addUser(LANES[key]);
          clearControls();
          askScale();
        }, key === "notsure"];
      });
    }

    function open() {
      var lane = param("s");
      if (!LANES[lane] || lane === "notsure") lane = "";
      var jumped = param("go") === "1";

      if (lane && jumped) {
        seedBot(Q1);
        state.service = lane;
        state.started = true;
        track("diagnostic_start", lane);
        addUser(LANES[lane]);
        askScale();
      } else if (lane) {
        addBot("Hey, glad you stopped in. This takes about a minute and ends with a straight read on your setup.", function () {
          addBot("You were just reading about " + LANES[lane].toLowerCase() + ". Is that where it hurts?", function () {
            setChips([
              ["That's the one", function () {
                begin();
                state.service = lane;
                addUser("That's the one");
                clearControls();
                askScale();
              }],
              ["It's something else", function () {
                addUser("It's something else");
                clearControls();
                addBot(Q1, function () { setChips(laneChips()); });
              }, true],
            ]);
          });
        });
      } else {
        addBot("Hey, glad you stopped in. This takes about a minute and ends with a straight read on your setup.", function () {
          addBot("First one's easy. " + Q1, function () { setChips(laneChips()); });
        });
      }
    }

    function askScale() {
      addBot("Roughly how many contracts or agreements are in play right now?", function () {
        setChips([
          ["Under 50", pickScale("u50")],
          ["50 to 200", pickScale("s200")],
          ["201 to 500", pickScale("s500")],
          ["More than 500", pickScale("p500")],
          ["Honestly not sure", pickScale("unsure"), true],
        ]);
      });
    }

    function pickScale(val) {
      var labels = { u50: "Under 50", s200: "50 to 200", s500: "201 to 500", p500: "More than 500", unsure: "Honestly not sure" };
      return function () {
        state.scale = val;
        addUser(labels[val]);
        clearControls();
        var ack = "";
        if (val === "p500" || val === "s500") ack = "That's past what one person tracks by hand.";
        else if (val === "u50") ack = "Small enough to feel manageable. That is usually the trap.";
        else if (val === "unsure") ack = "Fair. That answer says a lot on its own.";
        if (ack) addBot(ack, askSymptoms);
        else askSymptoms();
      };
    }

    function askSymptoms() {
      addBot("Which of these sound familiar? Tap everything that fits.", function () {
        clearControls();
        var row = document.createElement("div");
        row.className = "chat-chiprow";
        var opts = SYMPTOMS[state.service] || SYMPTOMS.notsure;
        opts.forEach(function (o) {
          var b = chip(o[1], function () {
            var idx = state.symptoms.indexOf(o[0]);
            if (idx === -1) state.symptoms.push(o[0]);
            else state.symptoms.splice(idx, 1);
            b.setAttribute("aria-pressed", idx === -1 ? "true" : "false");
            b.classList.toggle("chat-chip--on", idx === -1);
          });
          b.setAttribute("aria-pressed", "false");
          row.appendChild(b);
        });
        var doneRow = document.createElement("div");
        doneRow.className = "chat-chiprow chat-chiprow--done";
        doneRow.appendChild(chip("That's everything", function () {
          var chosen = (SYMPTOMS[state.service] || SYMPTOMS.notsure)
            .filter(function (o) { return state.symptoms.indexOf(o[0]) !== -1; })
            .map(function (o) { return o[1]; });
          addUser(chosen.length ? chosen.join(". ") : "None of those, honestly");
          clearControls();
          var ack = "";
          if (!chosen.length) ack = "Either it's airtight or nobody has looked. Both are worth knowing for sure.";
          else if (chosen.length >= 2) ack = "That combination shows up together for a reason.";
          if (ack) addBot(ack, askRecency);
          else askRecency();
        }));
        controls.appendChild(row);
        controls.appendChild(doneRow);
        scrollDown();
      });
    }

    function askRecency() {
      var q = state.service === "deduction"
        ? "When did anyone last go through the deductions line by line?"
        : "When did anyone last reconcile the numbers against the agreements themselves?";
      addBot(q, function () {
        setChips([
          ["Within the last year", pickRecency("year")],
          ["One to three years ago", pickRecency("three")],
          ["Never", pickRecency("never")],
          ["Not sure", pickRecency("unsure"), true],
        ]);
      });
    }

    function pickRecency(val) {
      var labels = { year: "Within the last year", three: "One to three years ago", never: "Never", unsure: "Not sure" };
      return function () {
        state.recency = val;
        addUser(labels[val]);
        clearControls();
        var ack = "";
        if (val === "never") ack = "That's usually where it hides.";
        else if (val === "unsure") ack = "Unknown usually means never. Worth knowing for sure.";
        else if (val === "three") ack = "A lot can drift in that window.";
        if (ack) addBot(ack, askTimeline);
        else askTimeline();
      };
    }

    function askTimeline() {
      addBot("Last quick one before I run this. How soon do you want eyes on it?", function () {
        setChips([
          ["This month", pickTimeline("month")],
          ["This quarter", pickTimeline("quarter")],
          ["Just gathering info", pickTimeline("gathering"), true],
        ]);
      });
    }

    function pickTimeline(val) {
      var labels = { month: "This month", quarter: "This quarter", gathering: "Just gathering info" };
      return function () {
        state.timeline = val;
        addUser(labels[val]);
        clearControls();
        if (val === "month") addBot("Good. Speed matters with this stuff.", askName);
        else askName();
      };
    }

    function askName() {
      addBot("Alright, I can run your read now. Who do I make it out to?", function () {
        setTextInput({
          label: "Full name", placeholder: "Full name", auto: "name",
          validate: function (v) { return v ? "" : "I need a name to put on the assessment."; },
          onSubmit: function (v) {
            state.name = v;
            state.first = v.split(" ")[0];
            addUser(v);
            askEmail();
          },
        });
      });
    }

    function askEmail() {
      addBot("Thanks, " + state.first + ". Work email for the summary?", function () {
        setTextInput({
          label: "Work email", type: "email", placeholder: "name@company.com", auto: "email",
          validate: function (v) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "That email looks short a piece. One more time?";
          },
          onSubmit: function (v) { state.email = v; addUser(v); askPhone(); },
        });
      });
    }

    function askPhone() {
      addBot("And the best direct number? A specialist calls within one business hour. No sequence, no spam.", function () {
        setTextInput({
          label: "Direct phone", type: "tel", placeholder: "(555) 555-0100", auto: "tel",
          validate: function (v) {
            return v.replace(/\D/g, "").length >= 10 ? "" : "I need a number with area code so the call actually lands.";
          },
          onSubmit: function (v) { state.phone = v; addUser(v); askCompany(); },
        });
      });
    }

    function askCompany() {
      addBot("Company name? Skip it if you'd rather not.", function () {
        setTextInput({
          label: "Company", placeholder: "Company", auto: "organization",
          skip: "Skip", onSkip: function () { addUser("Skip"); submitLead(); },
          onSubmit: function (v) { state.company = v; if (v) addUser(v); submitLead(); },
        });
      });
    }

    function submitLead() {
      clearControls();
      state.picks = pickFindings(state);
      var payload = {
        service: state.service, scale: state.scale, symptoms: state.symptoms,
        recency: state.recency, timeline: state.timeline,
        shown: state.picks.shown, held: state.picks.held,
        name: state.name, email: state.email, phone: state.phone, company: state.company,
        website: "",
        page: window.location.pathname + window.location.search,
        referrer: document.referrer || "",
        firstTouch: firstTouch(),
        gclid: currentGclid(),
      };
      addBot("Give me a second. Running your answers now...", function () {
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (r) { return r.json(); })
          .then(function (r) {
            if (!r || !r.ok) throw new Error("api");
            try {
              window.sessionStorage.setItem("vxDiag", JSON.stringify({ n: state.first, shown: state.picks.shown }));
            } catch (e) {}
            track("diagnostic_submit", state.service);
            reveal();
          })
          .catch(fail);
      }, reduce ? 0 : 900);
    }

    function reveal() {
      var shown = state.picks.shown;
      var lead = shown.length > 1 ? ", two things stand out:" : ", one thing stands out:";
      addBot(state.first + lead, function () {
        var i = 0;
        function nextFinding() {
          if (i < shown.length) {
            var f = FINDINGS[shown[i]];
            i += 1;
            var b = document.createElement("div");
            b.className = "chat-msg chat-msg--bot chat-msg--finding";
            var n = document.createElement("span");
            n.className = "chat-finding__n";
            n.textContent = "0" + i;
            b.appendChild(n);
            b.appendChild(document.createTextNode(f.text + " " + f.cost));
            log.appendChild(b);
            scrollDown();
            window.setTimeout(nextFinding, reduce ? 40 : 700);
          } else {
            addBot("There's more in here, and the useful half needs your agreements open next to a specialist. We call you within one business hour, or grab a time now and skip the phone tag.", function () {
              setChips([
                ["Book a time now", function () { window.location.href = "/thank-you"; }],
                ["The call works for me", function () { window.location.href = "/thank-you"; }, true],
              ]);
            });
          }
        }
        nextFinding();
      });
    }

    function fail() {
      addBot("Something on my end did not send. Call (860) 236-8002 or use the contact page and we will take it from there.", function () {
        setChips([
          ["Call (860) 236-8002", function () { window.location.href = "tel:+18602368002"; }],
          ["Open the contact page", function () { window.location.href = "contact.html"; }, true],
          ["Try again", function () { submitLead(); }, true],
        ]);
      });
    }

    open();
  }

  /* --------------------------- Thank-you recap --------------------------- */

  function buildReveal(mount) {
    var raw;
    try { raw = window.sessionStorage.getItem("vxDiag"); } catch (e) { raw = null; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.shown || !data.shown.length) return;

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }

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
  if (document.getElementById("vx-chat")) buildChat();
  var revealMount = document.getElementById("vx-reveal");
  if (revealMount) buildReveal(revealMount);
})();
