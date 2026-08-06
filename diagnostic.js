/* Accu-Track free-assessment conversation, v3.
   Grounded in the persona simulation (Clients/accu-track vault): question one
   is the prospect's situation, symptoms use the account's real vocabulary,
   an exposure range makes the findings computable, and the booking widget
   lands in-chat after the reveal. Diagnosis is rule-mapped from vetted copy;
   proof lines are lane-locked ($27.6M never on the deduction lane).
   Runs on assessment.html (#vx-chat) + thank-you.html recap (#vx-reveal). */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------ Data ---------------------------------- */

  /* Situations: [key, chip label, lane it implies, ack]. */
  var SITS = {
    sit_light: ["Royalty checks look lighter than they should", "royalty",
      "That's usually the first visible tell. The cause sits a few layers down."],
    sit_late: ["Statements or payments show up late or not at all", "licensing",
      "Late statements are rarely a mail problem. Late payments even less so."],
    sit_surprise: ["A renewal or deadline caught us off guard", "licensing",
      "Once is a fluke. What's behind it usually isn't."],
    sit_inherit: ["We're acquiring, and agreements keep piling up", "contract",
      "The deal team leaves. The agreements stay. That pile is where the biggest recoveries start."],
    sit_pile: ["Contracts are piling up faster than we can track them", "contract",
      "Past a certain count it stops being a diligence problem and becomes a structure problem."],
    sit_slip: ["Renewals keep slipping past us", "contract",
      "The miss never announces itself. It shows up on an invoice later."],
    sit_clm: ["We priced contract software and it didn't add up", "contract",
      "The platform is the visible cost. The people to run it are the real one."],
    sit_trust: ["We take the licensees' math on trust", "royalty",
      "Trust is how these agreements are designed to run. It's also where they leak."],
    sit_stopped: ["A licensee has gone quiet on reporting", "royalty",
      "Silence is expensive. It usually reads as nothing owed, and the agreement says otherwise."],
    sit_audit: ["Weighing a formal royalty audit", "royalty",
      "There's a lighter first step than lawyers. More on that in a minute."],
    sit_deduct: ["Retailers keep taking money off our invoices", "deduction",
      "And contesting them is a full-time job nobody was hired for."],
    sit_otif: ["OTIF fines and chargebacks are stacking up", "deduction",
      "They land faster than a team can review them. That pace gap is the whole game."],
    sit_sizing: ["Trying to size what we lose to deductions a year", "deduction",
      "Good instinct. The estimate is almost always smaller than the number."],
    sit_compliance: ["Licensing compliance needs to get under control", "licensing",
      "Good timing matters here. The gap grows a little every quarter."],
    sit_ahead: ["Just getting ahead of it", "",
      "Smart. This is cheaper than the other way."],
  };

  var LANE_SITS = {
    licensing: ["sit_light", "sit_late", "sit_surprise", "sit_inherit", "sit_ahead"],
    contract: ["sit_pile", "sit_slip", "sit_clm", "sit_inherit", "sit_ahead"],
    royalty: ["sit_light", "sit_stopped", "sit_trust", "sit_audit", "sit_ahead"],
    deduction: ["sit_deduct", "sit_otif", "sit_sizing", "sit_ahead"],
    cross: ["sit_light", "sit_pile", "sit_deduct", "sit_compliance", "sit_inherit", "sit_ahead"],
  };

  var LANE_LABELS = {
    licensing: "Licensing compliance",
    contract: "Contract management",
    royalty: "Royalty reporting",
    deduction: "Deduction recovery",
    notsure: "General",
  };

  var SYMPTOMS = {
    licensing: [
      ["lic_facevalue", "We take the licensees' numbers at face value"],
      ["lic_minimums", "Minimum guarantees nobody is actually checking"],
      ["lic_spreadsheet", "Renewals and deadlines live in a spreadsheet"],
      ["lic_memory", "Compliance lives in one person's memory"],
      ["lic_stopped", "At least one licensee has gone quiet"],
    ],
    contract: [
      ["con_renewals", "Renewal dates slip past before anyone notices"],
      ["con_inbox", "Obligations live in inboxes and memory"],
      ["con_visibility", "Nobody can say what is due this month"],
      ["con_memory", "The tracking lives in one person's head"],
      ["con_volume", "The volume outgrew the person watching it"],
    ],
    royalty: [
      ["roy_late", "Statements or payments arrive late or not at all"],
      ["roy_facevalue", "We take the licensee's math at face value"],
      ["roy_suspicion", "Short payments are a suspicion, not a number"],
      ["roy_audit", "A formal audit feels too heavy to start"],
    ],
    deduction: [
      ["ded_pace", "Deductions hit faster than we can review them"],
      ["ded_fines", "OTIF fines and vendor chargebacks pile up"],
      ["ded_postaudit", "Post-audit claims land months after the sale"],
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

  /* Exposure ranges. type "flow" = annual value through the agreements;
     type "ded" = annual deductions taken. */
  var EXPOSURE = {
    flow: [
      ["u250", "Under $250K"],
      ["m1", "$250K to $1M"],
      ["m5", "$1M to $5M"],
      ["m5p", "More than $5M"],
      ["skip", "Rather not say", true],
    ],
    ded: [
      ["u100", "Under $100K"],
      ["m500", "$100K to $500K"],
      ["m2", "$500K to $2M"],
      ["m2p", "More than $2M"],
      ["unknown", "Nobody knows exactly", true],
    ],
  };

  /* Floored, hedged math for the reveal. Low end of the Invotex 15-25% range
     applied to the low end of the band; conservative on purpose. */
  var FLOW_MATH = {
    m1: "on your flow that's roughly $35K to $250K a year sitting unverified",
    m5: "on your flow that's roughly $150K to $1M a year sitting unverified",
    m5p: "on your flow that's several hundred thousand a year at the conservative end",
  };
  var DED_MATH = {
    m500: "even a tenth of that contested successfully is $10K to $50K back",
    m2: "even a tenth of that contested successfully is $50K to $200K back",
    m2p: "even a tenth of that contested successfully is $200K or more back",
  };

  /* Findings: functions of the answers so the money math can personalize.
     "group" prevents two findings citing the same study from stacking. */
  var FINDINGS = {
    f_flow_gap: {
      group: "study",
      make: function (a) {
        return {
          text: "Licensees self-report and nobody on your side is reconciling the numbers against the agreements. A 20-year study of licensee audits found gaps of 15 to 25 percent where that check is missing.",
          cost: "If that range holds, " + (FLOW_MATH[a.exposure] || "the unverified slice of your flow is real money") + ".",
        };
      },
    },
    f_reconcile_gap: {
      group: "study",
      make: function () {
        return {
          text: "Nothing here says anyone is checking what licensees report against what the agreements say.",
          cost: "A 20-year study of licensee audits found gaps of 15 to 25 percent on portfolios where that check is missing.",
        };
      },
    },
    f_facevalue: {
      group: "study",
      make: function () {
        return {
          text: "Licensees calculate their own royalties, and those numbers are being taken at face value.",
          cost: "A 20-year study of licensee audits puts the gap at 15 to 25 percent where reporting breaks.",
        };
      },
    },
    f_stopped: {
      make: function () {
        return {
          text: "A licensee gone quiet on reporting is the loudest signal in this whole intake. Silence usually gets read as nothing owed.",
          cost: "The agreement says otherwise, and the gap compounds every quarter it runs.",
        };
      },
    },
    f_minimums: {
      make: function () {
        return {
          text: "Minimum guarantees are contracted revenue, and nobody is checking whether they're being met.",
          cost: "An unchecked minimum quietly becomes optional for the licensee. A missed one is pure revenue left on the table.",
        };
      },
    },
    f_memory: {
      make: function () {
        return {
          text: "The compliance picture lives in one person's memory, and it holds exactly as long as that person stays.",
          cost: "Every departure risk is also a portfolio risk. That is a structural exposure, not a people problem.",
        };
      },
    },
    f_inherit: {
      make: function () {
        return {
          text: "An inherited portfolio with no central record is where the biggest recoveries start. Nobody knows who is compliant, so nobody collects.",
          cost: "Our reconciliation work on one inherited portfolio surfaced $27.6M in four months. The pattern scales down.",
        };
      },
    },
    f_clm: {
      make: function () {
        return {
          text: "You already did the math on contract software: the platform still needs people to run it.",
          cost: "That staffing line is the cost everyone discovers after the subscription starts. A team skips the platform entirely.",
        };
      },
    },
    f_spreadsheet: {
      make: function () {
        return {
          text: "Your deadlines depend on a person remembering to open a spreadsheet at the right time.",
          cost: "The miss never announces itself. It surfaces months later, already expensive.",
        };
      },
    },
    f_con_renewals: {
      make: function () {
        return {
          text: "Renewal dates that slip past unnoticed are the most expensive habit in contract admin.",
          cost: "An unwanted auto-renewal costs money. A lapsed agreement costs more.",
        };
      },
    },
    f_con_inbox: {
      make: function () {
        return {
          text: "Your obligations live in inboxes and individual memory.",
          cost: "That holds until the one person who remembers is away the week it matters.",
        };
      },
    },
    f_con_visibility: {
      make: function () {
        return {
          text: "If nobody can say what is due this month, some of it is already being missed.",
          cost: "Those misses stay invisible until one of them lands on an invoice.",
        };
      },
    },
    f_con_volume: {
      make: function () {
        return {
          text: "The agreement count has passed what one person can track by hand.",
          cost: "Past that point a miss stops being a question of if.",
        };
      },
    },
    f_roy_suspicion: {
      make: function () {
        return {
          text: "A shortfall you suspect but have never quantified tends to grow until someone runs the numbers.",
          cost: "Reconciliation turns the suspicion into a figure you can collect on.",
        };
      },
    },
    f_roy_audit: {
      make: function () {
        return {
          text: "A formal audit feels heavy, so the checking never starts.",
          cost: "Reconciliation is the lighter first step. It finds short payments without turning anything into a legal event.",
        };
      },
    },
    f_ded_exposure: {
      make: function (a) {
        return {
          text: "Industry data on CPG deductions says a large share of what retailers take is invalid, duplicate, or unauthorized, and most of it goes uncontested.",
          cost: "On your number, " + (DED_MATH[a.exposure] || "a meaningful slice is typically contestable") + ". The window to contest is finite.",
        };
      },
    },
    f_ded_unknown: {
      make: function () {
        return {
          text: "Nobody has the true annual deduction total, which means the loss is running bigger than the estimate.",
          cost: "Estimates only count the deductions someone happened to see.",
        };
      },
    },
    f_ded_postaudit: {
      make: function () {
        return {
          text: "Post-audit claims land months after the sale, when the paperwork trail has gone cold.",
          cost: "Cold trails are exactly what the retailers' systems count on.",
        };
      },
    },
    f_ded_pace: {
      make: function () {
        return {
          text: "Fines and chargebacks are landing faster than your team can review them.",
          cost: "That pace difference is where the margin goes.",
        };
      },
    },
    f_ded_writeoff: {
      make: function () {
        return {
          text: "Disputing a few and writing off the rest has quietly made the write-off your default.",
          cost: "The retailers' systems are built to let that stand.",
        };
      },
    },
    f_ded_uncontested: {
      make: function () {
        return {
          text: "Deductions that go uncontested become permanent margin loss.",
          cost: "The recovery window is finite, and it favors whoever documents first.",
        };
      },
    },
    f_gen_leak: {
      make: function () {
        return {
          text: "Money is leaking somewhere and nobody has put a number on it yet.",
          cost: "Unquantified leaks read as small by default. They rarely are once someone reconciles.",
        };
      },
    },
    f_scale: {
      make: function () {
        return {
          text: "At this agreement count, manual tracking is past the point where diligence can save it.",
          cost: "The failure is structural. More effort from the same people does not fix structure.",
        };
      },
    },
    f_small: {
      make: function () {
        return {
          text: "The portfolio is small enough that tracking it became somebody's second job.",
          cost: "Second jobs lose to first jobs every week, and the misses land the same as they do at scale.",
        };
      },
    },
    f_default: {
      make: function () {
        return {
          text: "The operation runs on effort and memory.",
          cost: "That holds right up until it does not, and the first miss is rarely a small one.",
        };
      },
    },
  };

  function candidates(a) {
    var never = a.recency === "never" || a.recency === "unsure";
    var flowKnown = a.exposure === "m1" || a.exposure === "m5" || a.exposure === "m5p";
    var has = function (k) { return a.symptoms.indexOf(k) !== -1; };
    var big = a.scale === "s500" || a.scale === "p500";
    var small = a.scale === "u25";
    var sit = function (k) { return a.situation === k; };
    var lists = {
      licensing: [
        ["f_stopped", has("lic_stopped") || sit("sit_stopped")],
        ["f_flow_gap", (has("lic_facevalue") || never) && flowKnown],
        ["f_inherit", sit("sit_inherit")],
        ["f_reconcile_gap", never],
        ["f_minimums", has("lic_minimums")],
        ["f_facevalue", has("lic_facevalue")],
        ["f_memory", has("lic_memory")],
        ["f_spreadsheet", has("lic_spreadsheet") || sit("sit_surprise")],
        ["f_scale", big],
        ["f_small", small],
        ["f_default", true],
      ],
      contract: [
        ["f_inherit", sit("sit_inherit")],
        ["f_clm", sit("sit_clm")],
        ["f_con_renewals", has("con_renewals") || sit("sit_slip")],
        ["f_con_visibility", has("con_visibility")],
        ["f_memory", has("con_memory")],
        ["f_con_inbox", has("con_inbox")],
        ["f_con_volume", has("con_volume") || sit("sit_pile")],
        ["f_scale", big],
        ["f_small", small],
        ["f_default", true],
      ],
      royalty: [
        ["f_stopped", sit("sit_stopped")],
        ["f_flow_gap", (has("roy_facevalue") || sit("sit_trust") || never) && flowKnown],
        ["f_facevalue", has("roy_facevalue") || sit("sit_trust")],
        ["f_reconcile_gap", never],
        ["f_roy_suspicion", has("roy_suspicion") || sit("sit_light")],
        ["f_roy_audit", has("roy_audit") || sit("sit_audit")],
        ["f_spreadsheet", has("roy_late")],
        ["f_scale", big],
        ["f_default", true],
      ],
      deduction: [
        ["f_ded_exposure", a.exposure === "m500" || a.exposure === "m2" || a.exposure === "m2p"],
        ["f_ded_unknown", has("ded_unknown") || a.exposure === "unknown" || sit("sit_sizing")],
        ["f_ded_postaudit", has("ded_postaudit")],
        ["f_ded_pace", has("ded_pace") || has("ded_fines") || sit("sit_otif")],
        ["f_ded_writeoff", has("ded_writeoff")],
        ["f_ded_uncontested", true],
        ["f_scale", big],
      ],
      notsure: [
        ["f_inherit", sit("sit_inherit")],
        ["f_reconcile_gap", never],
        ["f_gen_leak", has("gen_leak")],
        ["f_facevalue", has("gen_facevalue")],
        ["f_spreadsheet", has("gen_spreadsheet")],
        ["f_small", has("gen_secondjob") || small],
        ["f_scale", big],
        ["f_default", true],
      ],
    };
    return lists[a.service] || lists.notsure;
  }

  function pickFindings(a) {
    var shown = [];
    var held = [];
    var groups = {};
    var list = candidates(a);
    for (var i = 0; i < list.length; i++) {
      var key = list[i][0];
      if (!list[i][1]) continue;
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

  function findingText(key, a) {
    var f = FINDINGS[key];
    if (!f) return null;
    var r = f.make(a || {});
    return r.text + " " + r.cost;
  }

  /* --------------------------- Small helpers ----------------------------- */

  function track(name, lane) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, diagnosticLane: lane });
    } catch (e) {}
  }

  function fireLeadConversion() {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "conversion", {
          send_to: "AW-18059564741/l1JjCM3xk90cEMWtvKND",
          value: 1.0,
          currency: "USD",
        });
      }
    } catch (e) {}
  }

  /* Fires when the in-page picker confirms a slot. Stock-widget bookings
     (fast lane / fallback iframe) cannot fire this; they count later via
     the offline-upload action. */
  function fireBookingConversion() {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "conversion", {
          send_to: "AW-18059564741/voTtCLKvpt0cEMWtvKND",
          value: 1.0,
          currency: "USD",
        });
      }
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
      service: "", situation: "", scale: "", symptoms: [], recency: "",
      timeline: "", exposure: "",
      name: "", first: "", email: "", phone: "", company: "",
      picks: null, started: false, crmOk: false,
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

    function begin(lane) {
      if (!state.started) { state.started = true; track("diagnostic_start", lane || "unset"); }
    }

    /* ------------------------------ Steps -------------------------------- */

    var Q1 = "What got you looking today?";

    function situationChips(keys) {
      return keys.map(function (key) {
        var s = SITS[key];
        return [s[0], function () {
          pickSituation(key);
        }, key === "sit_ahead"];
      });
    }

    function pickSituation(key) {
      var s = SITS[key];
      begin(s[1] || state.service);
      state.situation = key;
      if (!state.service) state.service = s[1] || "notsure";
      addUser(s[0]);
      clearControls();
      addBot(s[2], askScale);
    }

    function open() {
      var lane = param("s");
      if (!LANE_SITS[lane]) lane = "";
      var seedSit = param("t");
      if (!SITS[seedSit]) seedSit = "";
      state.service = lane || "";

      if (seedSit && param("go") === "1") {
        seedBot(Q1);
        var s = SITS[seedSit];
        state.situation = seedSit;
        if (!state.service) state.service = s[1] || "notsure";
        state.started = true;
        track("diagnostic_start", state.service);
        addUser(s[0]);
        addBot(s[2], askScale);
      } else {
        var keys = lane ? LANE_SITS[lane] : LANE_SITS.cross;
        addBot("Hey, glad you're here. Quick read on your setup: a few questions, about a minute, and I'll show you what stands out before anyone calls you.", function () {
          addBot("First one's easy. " + Q1, function () {
            var items = situationChips(keys);
            if (lane) {
              items.push(["It's something else", function () {
                addUser("It's something else");
                clearControls();
                state.service = "";
                addBot("No problem. Which of these is closest?", function () {
                  setChips(situationChips(LANE_SITS.cross));
                });
              }, true]);
            }
            items.push(["I just want to book a call", jumpToBooking, true]);
            setChips(items);
          });
        });
      }
    }

    /* Fast lane: straight to the stock booking widget, no questions. The
       widget captures its own contact info; form_embed.js is already on the
       page for exactly this. Intake-less bookings are the accepted trade. */
    function jumpToBooking() {
      if (document.getElementById("vx-booking-widget")) return;
      begin(state.service || "direct");
      track("booking_fastlane", state.service || "direct");
      addUser("I just want to book a call");
      clearControls();
      addBot("Even better. Grab a time below and it's locked in. The specialist does the whole read live on the call.", function () {
        var wrap = document.createElement("div");
        wrap.className = "vx-cal vx-cal--fastlane";
        wrap.innerHTML = '<div class="vx-cal__widget"><iframe src="https://api.leadconnectorhq.com/widget/booking/zqY1dBbeXQwIKC3tmeS9" style="width:100%; min-height:760px; border:none; overflow:hidden; display:block; border-radius:8px;" scrolling="no" id="vx-booking-widget" title="Book your free assessment"></iframe></div>';
        log.appendChild(wrap);
        scrollDown();
      });
    }

    function askScale() {
      var q = {
        licensing: "How many licensing agreements are live right now, roughly?",
        royalty: "How many royalty-bearing agreements are we talking about, roughly?",
        deduction: "How many retail accounts are taking deductions, roughly?",
      }[state.service] || "How many contracts or agreements are in play, roughly?";
      addBot(q, function () {
        setChips([
          ["A couple dozen or fewer", pickScale("u25")],
          ["25 to 100", pickScale("s100")],
          ["100 to 250", pickScale("s250")],
          ["250 to 500", pickScale("s500")],
          ["More than 500", pickScale("p500")],
          ["Honestly not sure", pickScale("unsure"), true],
        ]);
      });
    }

    function pickScale(val) {
      var labels = { u25: "A couple dozen or fewer", s100: "25 to 100", s250: "100 to 250", s500: "250 to 500", p500: "More than 500", unsure: "Honestly not sure" };
      return function () {
        state.scale = val;
        addUser(labels[val]);
        clearControls();
        var ack = "";
        if (val === "p500" || val === "s500") ack = "That's well past what one person tracks by hand.";
        else if (val === "u25") ack = "Small enough to feel manageable. That is usually the trap.";
        else if (val === "unsure") ack = "Fair. Not knowing the count is a data point on its own.";
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
          else if (chosen.length >= 2) ack = "Those show up together for a reason. Noted.";
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
        : "When did anyone last reconcile what gets reported against the agreements themselves?";
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
        if (ack) addBot(ack, askExposure);
        else askExposure();
      };
    }

    function askExposure() {
      var isDed = state.service === "deduction";
      var q = isDed
        ? "Rough number so the math means something: what did retailers take off your invoices last year, deductions and fines together?"
        : "Rough number so the math means something: what flows through these agreements a year?";
      var set = isDed ? EXPOSURE.ded : EXPOSURE.flow;
      addBot(q, function () {
        setChips(set.map(function (o) {
          return [o[1], function () {
            state.exposure = o[0];
            addUser(o[1]);
            clearControls();
            if (o[0] === "unknown") addBot("That answer is a finding in itself. Hold that thought.", askTimeline);
            else askTimeline();
          }, !!o[2]];
        }));
      });
    }

    function askTimeline() {
      addBot("Last one. How soon do you want eyes on this?", function () {
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
      addBot("I have enough to run your read. Who do I make it out to?", function () {
        setTextInput({
          label: "Full name", placeholder: "Full name", auto: "name",
          validate: function (v) { return v ? "" : "I need a name to put on the read."; },
          onSubmit: function (v) {
            state.name = v;
            state.first = v.split(" ")[0];
            addUser(v);
            askCompany();
          },
        });
      });
    }

    function askCompany() {
      addBot("Thanks, " + state.first + ". And the company name?", function () {
        setTextInput({
          label: "Company", placeholder: "Company", auto: "organization",
          validate: function (v) { return v ? "" : "I need the company name for the read."; },
          onSubmit: function (v) { state.company = v; addUser(v); askPhone(); },
        });
      });
    }

    function askPhone() {
      addBot("Best direct number? A specialist calls within one business hour. No sequence, no spam.", function () {
        setTextInput({
          label: "Direct phone", type: "tel", placeholder: "(555) 555-0100", auto: "tel",
          validate: function (v) {
            return v.replace(/\D/g, "").length >= 10 ? "" : "I need a number with area code so the call actually lands.";
          },
          onSubmit: function (v) { state.phone = v; addUser(v); askEmail(); },
        });
      });
    }

    function askEmail() {
      addBot("Last one: work email, in case the line's busy?", function () {
        setTextInput({
          label: "Work email", type: "email", placeholder: "name@company.com", auto: "email",
          validate: function (v) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "That email looks short a piece. One more time?";
          },
          onSubmit: function (v) { state.email = v; addUser(v); submitLead(); },
        });
      });
    }

    /* ---------------- Results takeover (post-capture) ------------------ */

    var HERO_STAT = {
      m1: ["$35K to $250K", "estimated unverified flow, per year", "If the 15 to 25 percent audit-study range holds on your reported flow."],
      m5: ["$150K to $1M", "estimated unverified flow, per year", "If the 15 to 25 percent audit-study range holds on your reported flow."],
      m5p: ["$750K+", "estimated unverified flow at the conservative end, per year", "If the 15 to 25 percent audit-study range holds on your reported flow."],
      m500: ["$10K to $50K", "recoverable at even a one-in-ten contest rate", "Industry data on CPG deductions; the math shown is one contested dollar in ten."],
      m2: ["$50K to $200K", "recoverable at even a one-in-ten contest rate", "Industry data on CPG deductions; the math shown is one contested dollar in ten."],
      m2p: ["$200K+", "recoverable at even a one-in-ten contest rate", "Industry data on CPG deductions; the math shown is one contested dollar in ten."],
    };

    function clientScore() {
      var s2 = 2;
      s2 += { u25: 0, s100: 1, s250: 2, s500: 2, p500: 3, unsure: 1 }[state.scale] || 0;
      s2 += Math.min(state.symptoms.length, 2);
      s2 += { year: 0, three: 1, never: 2, unsure: 1 }[state.recency] || 0;
      s2 += { month: 2, quarter: 1, gathering: 0 }[state.timeline] || 0;
      s2 += { m5: 1, m5p: 1, m2: 1, m2p: 1, unknown: 1 }[state.exposure] || 0;
      return Math.max(1, Math.min(10, s2));
    }

    function severity() {
      var sc = clientScore();
      if (sc >= 8) return ["high", "High exposure", "The pattern in your answers is the one that usually means money is already leaking."];
      if (sc >= 5) return ["elevated", "Elevated exposure", "More than one leak signal showed up in your answers."];
      return ["low", "Worth a proper look", "A few things worth confirming before they grow."];
    }

    function proofLine() {
      if (state.service === "deduction") {
        return "Recovery is the original work here. Accu-Track started in 1990 getting back money retailers were quietly holding off CPG invoices.";
      }
      return "Our reconciliation work surfaced $27.6M for one client in four months, on an inherited licensing portfolio.";
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }

    function submitLead() {
      clearControls();
      state.picks = pickFindings(state);
      var payload = {
        service: state.service, situation: state.situation, scale: state.scale,
        symptoms: state.symptoms, recency: state.recency, timeline: state.timeline,
        exposure: state.exposure,
        shown: state.picks.shown, held: state.picks.held,
        name: state.name, email: state.email, phone: state.phone, company: state.company,
        website: "",
        page: window.location.pathname + window.location.search,
        referrer: document.referrer || "",
        firstTouch: firstTouch(),
        gclid: currentGclid(),
      };
      state.apiDone = false;
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          state.crmOk = !!(r && r.ok);
          state.contactId = (r && r.contactId) || "";
        })
        .catch(function () { state.crmOk = false; })
        .then(function () {
          if (state.crmOk) {
            fireLeadConversion();
            track("diagnostic_submit", state.service);
          }
          try {
            window.sessionStorage.setItem("vxDiag", JSON.stringify({ n: state.first, shown: state.picks.shown, a: state }));
          } catch (e) {}
          state.apiDone = true;
        });
      addBot("That's everything I need, " + state.first + ". Running your read now.", startTakeover);
    }

    function startTakeover() {
      var overlay = el("div", "vx-results");
      overlay.id = "vx-results";
      var stage = el("div", "vx-analyzing");
      var log2 = el("div", "vx-ledger");
      var bar = el("div", "vx-analyzing__bar");
      var fill = el("i");
      bar.appendChild(fill);
      stage.appendChild(el("p", "vx-analyzing__brand", "Accu-Track · Free Assessment"));
      stage.appendChild(log2);
      stage.appendChild(bar);
      overlay.appendChild(stage);
      document.body.appendChild(overlay);
      document.body.classList.add("vx-locked");

      var scaleLabels = { u25: "a couple dozen or fewer", s100: "25 to 100", s250: "100 to 250", s500: "250 to 500", p500: "more than 500", unsure: "count unconfirmed" };
      var recLabels = { year: "within the last year", three: "one to three years ago", never: "never", unsure: "unknown" };
      var expLabels = { u250: "under $250K", m1: "$250K to $1M", m5: "$1M to $5M", m5p: "more than $5M", u100: "under $100K", m500: "$100K to $500K", m2: "$500K to $2M", m2p: "more than $2M", unknown: "total unknown" };
      var tlLabels = { month: "this month", quarter: "this quarter", gathering: "gathering information" };

      var lines = [
        ["PORTFOLIO", scaleLabels[state.scale] || "on record"],
        ["FLAGS", state.symptoms.length ? state.symptoms.length + " selected" : "none selected"],
        ["LAST RECONCILED", recLabels[state.recency] || "unknown"],
      ];
      if (state.exposure && state.exposure !== "skip" && expLabels[state.exposure]) {
        lines.push([state.service === "deduction" ? "ANNUAL DEDUCTIONS" : "ANNUAL FLOW", expLabels[state.exposure]]);
      }
      lines.push(["TIMELINE", tlLabels[state.timeline] || ""]);
      var phases = ["MATCHING PORTFOLIO PATTERNS", "SIZING THE EXPOSURE", "PREVIEW READY"];

      var stepMs = reduce ? 45 : 430;
      var total = lines.length + phases.length;
      var i = 0;
      function step() {
        fill.style.width = ((Math.min(i + 1, total) / total) * 100) + "%";
        if (i < lines.length) {
          var row = el("div", "vx-ledger__row");
          row.appendChild(el("span", "vx-ledger__term", lines[i][0]));
          row.appendChild(el("span", "vx-ledger__dots"));
          row.appendChild(el("span", "vx-ledger__val", lines[i][1]));
          log2.appendChild(row);
          i += 1;
          window.setTimeout(step, stepMs);
        } else if (i < total) {
          var ph = el("div", "vx-ledger__phase" + (i === total - 1 ? " vx-ledger__phase--done" : ""), phases[i - lines.length]);
          log2.appendChild(ph);
          i += 1;
          window.setTimeout(step, reduce ? 45 : 950);
        } else {
          waitForApi(0);
        }
      }
      function waitForApi(waited) {
        if (state.apiDone || waited > 7000) buildReport(overlay);
        else window.setTimeout(function () { waitForApi(waited + 250); }, 250);
      }
      step();
    }

    function urgencyLine() {
      var t = {
        month: "You said this month. A specialist calls within one business hour, and the first open slot below makes it certain.",
        quarter: "You said this quarter. The read takes thirty minutes. The drift it stops takes a lot longer.",
        gathering: "Still gathering information. That is exactly what the full read gives you, and it costs half an hour.",
      }[state.timeline] || "";
      var never = state.recency === "never" || state.recency === "unsure";
      var hasMoney = state.picks.shown.indexOf("f_flow_gap") !== -1 || state.picks.shown.indexOf("f_ded_exposure") !== -1;
      if (never && hasMoney) t += " Every quarter this runs unchecked, the number above grows.";
      return t;
    }

    function buildReport(overlay) {
      overlay.innerHTML = "";
      var sev = severity();

      /* Verdict band (dark) */
      var band = el("header", "vx-verdict vx-verdict--" + sev[0]);
      var bandIn = el("div", "vx-verdict__in");
      bandIn.appendChild(el("p", "vx-verdict__eyebrow", "Free assessment · Preview for " + state.first));
      bandIn.appendChild(el("h1", "vx-verdict__word", sev[1]));
      bandIn.appendChild(el("p", "vx-verdict__line", sev[2]));

      var HERO_FLOW = {
        u250: ["Under $250K", "a year moving on self-reported numbers", "The full read verifies it line by line."],
        m1: ["$250K to $1M", "a year moving on self-reported numbers", "The full read verifies it line by line."],
        m5: ["$1M to $5M", "a year moving on self-reported numbers", "The full read verifies it line by line."],
        m5p: ["$5M+", "a year moving on self-reported numbers", "The full read verifies it line by line."],
        u100: ["Under $100K", "a year going out in deductions and fines", "The full read shows how much of it was contestable."],
        m500: ["$100K to $500K", "a year going out in deductions and fines", "The full read shows how much of it was contestable."],
        m2: ["$500K to $2M", "a year going out in deductions and fines", "The full read shows how much of it was contestable."],
        m2p: ["$2M+", "a year going out in deductions and fines", "The full read shows how much of it was contestable."],
      };
      var hs = null;
      if ((state.picks.shown.indexOf("f_flow_gap") !== -1 || state.picks.shown.indexOf("f_ded_exposure") !== -1) && HERO_STAT[state.exposure]) {
        hs = HERO_STAT[state.exposure];
      } else if (state.exposure === "unknown") {
        hs = ["Unknown", "your annual deduction total", "That is finding one. The full read puts a number on it."];
      } else if (HERO_FLOW[state.exposure]) {
        hs = HERO_FLOW[state.exposure];
      }
      if (hs) {
        var money = el("div", "vx-money");
        money.appendChild(el("div", "vx-money__num", hs[0]));
        money.appendChild(el("div", "vx-money__label", hs[1]));
        money.appendChild(el("div", "vx-money__attr", hs[2]));
        bandIn.appendChild(money);
      }
      var today = new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
      bandIn.appendChild(el("p", "vx-verdict__meta", "Prepared " + today + " · From your answers · Unverified until reconciled"));
      band.appendChild(bandIn);
      overlay.appendChild(band);

      var inner = el("div", "vx-results__inner");

      /* Findings: editorial entries, hairline-separated */
      inner.appendChild(el("p", "vx-sechead", "What your answers already show"));
      for (var i = 0; i < state.picks.shown.length; i++) {
        var full = findingText(state.picks.shown[i], state);
        var dot = full.indexOf(". ");
        var lead = dot === -1 ? full : full.slice(0, dot + 1);
        var rest = dot === -1 ? "" : full.slice(dot + 2);
        var item = el("div", "vx-fitem");
        item.appendChild(el("span", "vx-fitem__n", "0" + (i + 1)));
        var body = el("div", "vx-fitem__body");
        body.appendChild(el("p", "vx-fitem__lead", lead));
        if (rest) body.appendChild(el("p", "vx-fitem__rest", rest));
        item.appendChild(body);
        inner.appendChild(item);
      }

      /* Held findings: redacted statement rows */
      inner.appendChild(el("p", "vx-sechead", "Held for the call"));
      var lockWrap = el("div", "vx-lockrows");
      var heldN = Math.max(state.picks.held.length, 2);
      for (var j = 0; j < heldN; j++) {
        var row = el("div", "vx-lockrow");
        row.appendChild(el("span", "vx-lockrow__n", "0" + (state.picks.shown.length + j + 1)));
        row.appendChild(el("span", "vx-lockrow__bar"));
        row.appendChild(el("span", "vx-lockrow__tag", "On the call"));
        lockWrap.appendChild(row);
      }
      inner.appendChild(lockWrap);

      /* Mechanism of solution: why booking closes the leak */
      inner.appendChild(el("p", "vx-sechead", "How this gets fixed"));
      inner.appendChild(el("p", "vx-mech__wedge", "Software gives you a platform. We give you a team."));
      var step3 = {
        contract: ["The team takes it over.", "Renewals, obligations, and the daily contract admin run for you. Nothing to install, nobody new to hire, operational in 2 to 4 weeks."],
        deduction: ["The team goes and gets it back.", "Deductions get contested with documentation first, and recovery follows. Nothing to install, nobody new to hire, operational in 2 to 4 weeks."],
      }[state.service] || ["The team takes it over.", "Every statement gets reconciled against the agreement terms, and someone acts on what turns up. Nothing to install, nobody new to hire, operational in 2 to 4 weeks."];
      var steps = [
        ["The full read.", "Thirty minutes on the phone with a specialist. Plain words, no pitch. You leave knowing where it leaks and what closing it takes."],
        ["A plan you approve first.", "Scope and price on paper before any work starts. You keep every decision."],
        step3,
      ];
      var mech = el("div", "vx-mech");
      for (var st = 0; st < steps.length; st++) {
        if (st > 0) mech.appendChild(el("span", "vx-mech__arrow"));
        var node = el("div", "vx-mech__node");
        node.appendChild(el("span", "vx-mech__disc", "" + (st + 1)));
        node.appendChild(el("p", "vx-mech__head", steps[st][0]));
        node.appendChild(el("p", "vx-mech__sub", steps[st][1]));
        mech.appendChild(node);
      }
      inner.appendChild(mech);
      inner.appendChild(el("p", "vx-mech__anchor", "It typically costs less than one full-time contract administrator."));

      /* Proof strip */
      var proof = el("div", "vx-proofstrip");
      if (state.service === "deduction") {
        proof.appendChild(el("span", "vx-proofstrip__num", "Since 1990"));
        proof.appendChild(el("span", "vx-proofstrip__txt", "Recovery is the original work. Accu-Track started out getting back money retailers were quietly holding off CPG invoices."));
      } else {
        proof.appendChild(el("span", "vx-proofstrip__num", "$27.6M"));
        proof.appendChild(el("span", "vx-proofstrip__txt", "recovered for one client in four months, on an inherited licensing portfolio. Hundreds of agreements brought to order."));
      }
      inner.appendChild(proof);

      /* Booking */
      var cta = el("div", "vx-book");
      cta.id = "vx-book";
      cta.appendChild(el("h2", "vx-book__h", "Book the full read"));
      cta.appendChild(el("p", "vx-book__urgency", urgencyLine()));
      if (!state.crmOk) {
        cta.appendChild(el("p", "vx-book__alt", "Pick a time below and it's locked. Or call us direct at (860) 236-8002."));
      }
      var cal = el("div", "vx-cal");
      cal.id = "vx-cal";
      cta.appendChild(cal);
      var phone = el("p", "vx-phone-note");
      phone.innerHTML = 'Rather talk now? <a href="tel:+18602368002">(860) 236-8002</a>';
      cta.appendChild(phone);
      inner.appendChild(cta);

      overlay.appendChild(inner);

      /* Sticky mobile CTA */
      var bar = el("div", "vx-stickycta");
      var barBtn = el("button", "vx-stickycta__btn", "Book the full read");
      barBtn.type = "button";
      barBtn.addEventListener("click", function () {
        var t = document.getElementById("vx-book");
        if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
      bar.appendChild(barBtn);
      overlay.appendChild(bar);
      state.stickyBar = bar;

      overlay.scrollTop = 0;
      initCalendar(cal);
    }

    /* ------------------------- Calendar picker -------------------------- */

    function widgetFallback(mount, note) {
      mount.innerHTML = "";
      if (note) mount.appendChild(el("p", "vx-cal__note", note));
      var wrap = el("div", "vx-cal__widget");
      wrap.innerHTML = '<iframe src="https://api.leadconnectorhq.com/widget/booking/zqY1dBbeXQwIKC3tmeS9" style="width:100%; min-height:760px; border:none; overflow:hidden; display:block; border-radius:8px;" scrolling="no" id="vx-booking-widget" title="Book your free assessment"></iframe>';
      mount.appendChild(wrap);
    }

    function initCalendar(mount) {
      if (!state.crmOk || !state.contactId) {
        widgetFallback(mount);
        return;
      }
      mount.appendChild(el("p", "vx-cal__note", "Loading times..."));
      var tz = "America/New_York";
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) {}
      fetch("/api/slots?tz=" + encodeURIComponent(tz))
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (!r || !r.ok || !r.days || !r.days.length) throw new Error("slots");
          renderPicker(mount, r.days);
        })
        .catch(function () { widgetFallback(mount); });
    }

    function renderPicker(mount, days) {
      mount.innerHTML = "";
      var avail = {};
      days.forEach(function (d) { avail[d.date] = d.slots; });
      var months = [];
      days.forEach(function (d) {
        var m = d.date.slice(0, 7);
        if (months.indexOf(m) === -1) months.push(m);
      });
      var cal = { month: 0, date: days[0].date, slot: "" };

      mount.appendChild(el("p", "vx-cal__label", "Pick a day, then a time"));
      var wrap = el("div", "vx-calwrap");
      var calPane = el("div", "vx-calpane");
      var timePane = el("div", "vx-timepane");
      wrap.appendChild(calPane);
      wrap.appendChild(timePane);
      var confirmWrap = el("div", "vx-cal__confirm");
      mount.appendChild(wrap);
      mount.appendChild(confirmWrap);

      function fmtDay(dateStr) {
        var d = new Date(dateStr + "T12:00:00");
        return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      }
      function fmtTime(iso) {
        return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      function pad2(n) { return n < 10 ? "0" + n : "" + n; }

      function renderCal() {
        calPane.innerHTML = "";
        var mkey = months[cal.month];
        var y = +mkey.slice(0, 4);
        var mo = +mkey.slice(5, 7);
        var head = el("div", "vx-calhead");
        var label = el("span", "vx-calhead__label",
          new Date(y, mo - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" }));
        var nav = el("span", "vx-calhead__nav");
        var prev = el("button", "vx-calnav", "‹");
        prev.type = "button";
        prev.disabled = cal.month === 0;
        prev.setAttribute("aria-label", "Previous month");
        prev.addEventListener("click", function () { cal.month -= 1; renderCal(); });
        var next = el("button", "vx-calnav", "›");
        next.type = "button";
        next.disabled = cal.month >= months.length - 1;
        next.setAttribute("aria-label", "Next month");
        next.addEventListener("click", function () { cal.month += 1; renderCal(); });
        nav.appendChild(prev);
        nav.appendChild(next);
        head.appendChild(label);
        head.appendChild(nav);
        calPane.appendChild(head);

        var grid = el("div", "vx-calgrid");
        ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) {
          grid.appendChild(el("span", "vx-caldow", d));
        });
        var startDow = new Date(y, mo - 1, 1).getDay();
        var dim = new Date(y, mo, 0).getDate();
        var i;
        for (i = 0; i < startDow; i++) grid.appendChild(el("span", "vx-calcell vx-calcell--void"));
        for (i = 1; i <= dim; i++) {
          var ds = mkey + "-" + pad2(i);
          if (avail[ds]) {
            var b = el("button", "vx-calcell" + (ds === cal.date ? " is-sel" : ""), "" + i);
            b.type = "button";
            (function (dsel) {
              b.addEventListener("click", function () {
                cal.date = dsel;
                cal.slot = "";
                confirmWrap.innerHTML = "";
                renderCal();
                renderTimes();
              });
            })(ds);
            grid.appendChild(b);
          } else {
            grid.appendChild(el("span", "vx-calcell vx-calcell--off", "" + i));
          }
        }
        calPane.appendChild(grid);
      }

      function bookSlot(iso, btn) {
        btn.disabled = true;
        btn.textContent = "Booking...";
        fetch("/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: state.contactId, startTime: iso }),
        })
          .then(function (r) { return r.json(); })
          .then(function (r) {
            if (!r || !r.ok) throw new Error("book");
            mount.innerHTML = "";
            var done = el("div", "vx-booked");
            done.appendChild(el("p", "vx-booked__head", "Booked. " + fmtDay(cal.date) + " at " + fmtTime(iso) + "."));
            done.appendChild(el("p", "vx-booked__sub", "A confirmation is on its way to " + state.email + ". Talk soon, " + state.first + "."));
            mount.appendChild(done);
            if (state.stickyBar) state.stickyBar.remove();
            track("diagnostic_booked", state.service);
            fireBookingConversion();
          })
          .catch(function () {
            widgetFallback(mount, "That time didn't lock. Grab one below instead:");
          });
      }

      function renderTimes() {
        timePane.innerHTML = "";
        timePane.classList.remove("is-in");
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { timePane.classList.add("is-in"); });
        });
        if (window.innerWidth < 680) {
          window.setTimeout(function () {
            timePane.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
          }, 60);
        }
        timePane.appendChild(el("p", "vx-cal__label", fmtDay(cal.date)));
        var list = el("div", "vx-tlist");
        (avail[cal.date] || []).forEach(function (iso) {
          var row = el("div", "vx-trow");
          var timeBtn = el("button", "vx-time", fmtTime(iso));
          timeBtn.type = "button";
          timeBtn.addEventListener("click", function () {
            Array.prototype.forEach.call(list.children, function (r) {
              r.classList.remove("is-split");
              var c = r.querySelector(".vx-confirm");
              if (c) c.remove();
            });
            row.classList.add("is-split");
            var confirm = el("button", "vx-confirm", "Confirm");
            confirm.type = "button";
            confirm.addEventListener("click", function () { bookSlot(iso, confirm); });
            row.appendChild(confirm);
            cal.slot = iso;
          });
          row.appendChild(timeBtn);
          list.appendChild(row);
        });
        timePane.appendChild(list);
      }

      renderCal();
      renderTimes();
    }

    var bookNow = document.getElementById("vx-book-now");
    if (bookNow) bookNow.addEventListener("click", jumpToBooking);
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
      var text = findingText(data.shown[i], data.a || {});
      if (!text) continue;
      var item = el("div", "vx-finding");
      var n = el("span", "vx-finding__n", "0" + (i + 1));
      var p = el("p");
      p.appendChild(n);
      p.appendChild(document.createTextNode(text));
      item.appendChild(p);
      box.appendChild(item);
    }

    box.appendChild(el("p", "vx-reveal__more", "The full read goes deeper than these. Your specialist walks through the rest on the call."));
    mount.appendChild(box);
    mount.hidden = false;
  }

  /* ------------------------------- Boot ---------------------------------- */

  firstTouch();
  if (document.getElementById("vx-chat")) buildChat();
  var revealMount = document.getElementById("vx-reveal");
  if (revealMount) buildReveal(revealMount);
})();
