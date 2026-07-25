/* /api/lead - diagnostic funnel intake -> GHL contact + note.
   Env: GHL_TOKEN (private integration token), GHL_LOCATION (location id).
   Handled failures return JSON with status 200: Cloudflare Pages replaces
   raw 5xx Function responses with its generic error page, so the client
   would never see the body. The client treats ok:false as failure. */

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

const ENUMS = {
  service: ["licensing", "contract", "royalty", "deduction", "notsure"],
  scale: ["u50", "s200", "s500", "p500", "unsure"],
  recency: ["year", "three", "never", "unsure"],
  timeline: ["month", "quarter", "gathering"],
};

const SYMPTOM_LABELS = {
  lic_late: "Royalty reports show up late or not at all",
  lic_mismatch: "The numbers never quite match the agreement",
  lic_spreadsheet: "Renewals and deadlines live in a spreadsheet",
  lic_capacity: "Nobody has time to check any of it",
  con_renewals: "Renewal dates slip past before anyone notices",
  con_inbox: "Obligations live in inboxes and memory",
  con_visibility: "Nobody can say what is due this month",
  con_volume: "The volume outgrew the person watching it",
  roy_late: "Reports arrive late or incomplete",
  roy_facevalue: "We take the licensee's math at face value",
  roy_suspicion: "Short payments are a suspicion, not a number",
  roy_audit: "A formal audit feels too heavy to start",
  ded_pace: "Deductions hit faster than we can review them",
  ded_fines: "Shortage fines and chargebacks pile up",
  ded_writeoff: "We dispute a few and write off the rest",
  ded_unknown: "Nobody knows the true annual total",
  gen_spreadsheet: "Tracking lives in spreadsheets and memory",
  gen_leak: "Money is leaking somewhere nobody has quantified",
  gen_facevalue: "We take reported numbers at face value",
  gen_secondjob: "It has become somebody's second job",
};

const FINDING_LABELS = {
  f_reconcile_gap: "Reconciliation gap (15-25% study)",
  f_lic_late: "Reports late/missing = unowned process",
  f_lic_spreadsheet: "Deadline tracking rides on memory",
  f_lic_capacity: "Portfolio outgrew available hours",
  f_lic_mismatch: "Structural reporting mismatch",
  f_con_renewals: "Renewal slippage",
  f_con_inbox: "Obligations in inboxes and memory",
  f_con_visibility: "No monthly obligations visibility",
  f_con_volume: "Volume past manual tracking",
  f_roy_facevalue: "Licensee math taken at face value",
  f_roy_suspicion: "Unquantified shortfall",
  f_roy_audit: "Audit-aversion stalls recovery",
  f_ded_uncontested: "Uncontested deductions = permanent loss",
  f_ded_pace: "Deduction pace beats review capacity",
  f_ded_writeoff: "Write-off has become the default",
  f_ded_unknown: "True annual deduction total unknown",
  f_scale: "Scale past the point manual diligence holds",
  f_small: "Second-job tracking on a smaller portfolio",
  f_default: "Run on effort and memory",
};

const LANE_LABELS = {
  licensing: "Licensing compliance",
  contract: "Contract management",
  royalty: "Royalty reporting",
  deduction: "Deduction recovery",
  notsure: "Not sure yet",
};

const SCALE_LABELS = {
  u50: "Under 50",
  s200: "50 to 200",
  s500: "201 to 500",
  p500: "More than 500",
  unsure: "Not sure",
};

const RECENCY_LABELS = {
  year: "Within the last year",
  three: "One to three years ago",
  never: "Never",
  unsure: "Not sure",
};

const TIMELINE_LABELS = {
  month: "This month",
  quarter: "This quarter",
  gathering: "Just gathering information",
};

function sanitize(v, max) {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function scoreLead(a) {
  let s = 2;
  s += { u50: 0, s200: 1, s500: 2, p500: 3, unsure: 1 }[a.scale] || 0;
  s += Math.min(a.symptoms.length, 2);
  s += { year: 0, three: 1, never: 2, unsure: 1 }[a.recency] || 0;
  s += { month: 2, quarter: 1, gathering: 0 }[a.timeline] || 0;
  return Math.max(1, Math.min(10, s));
}

function ghlFetch(path, token, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(GHL_BASE + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function handlePost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "bad-request" });
  }

  // Honeypot: real users never see this field. Pretend success, write nothing.
  if (sanitize(data.website, 50)) return json({ ok: true });

  const name = sanitize(data.name, 120);
  const email = sanitize(data.email, 160);
  const phone = sanitize(data.phone, 40);
  const company = sanitize(data.company, 160);
  const page = sanitize(data.page, 200);
  const referrer = sanitize(data.referrer, 300);
  const firstTouch = sanitize(data.firstTouch, 400);
  const gclid = sanitize(data.gclid, 200);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "invalid-contact" });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return json({ ok: false, error: "invalid-contact" });
  }

  const answers = {
    service: ENUMS.service.includes(data.service) ? data.service : "notsure",
    scale: ENUMS.scale.includes(data.scale) ? data.scale : "unsure",
    recency: ENUMS.recency.includes(data.recency) ? data.recency : "unsure",
    timeline: ENUMS.timeline.includes(data.timeline) ? data.timeline : "gathering",
    symptoms: Array.isArray(data.symptoms)
      ? data.symptoms.filter((k) => SYMPTOM_LABELS[k]).slice(0, 6)
      : [],
  };
  const shown = Array.isArray(data.shown)
    ? data.shown.filter((k) => FINDING_LABELS[k]).slice(0, 2)
    : [];
  const held = Array.isArray(data.held)
    ? data.held.filter((k) => FINDING_LABELS[k]).slice(0, 4)
    : [];

  if (!env.GHL_TOKEN || !env.GHL_LOCATION) {
    return json({ ok: false, error: "not-configured" });
  }

  const nameParts = name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const score = scoreLead(answers);

  const upsertBody = {
    locationId: env.GHL_LOCATION,
    firstName,
    lastName,
    email,
    phone,
    companyName: company || undefined,
    source: "Website Diagnostic Funnel",
    tags: ["free-assessment-request", "diagnostic-funnel", "lane-" + answers.service],
  };

  let contactId;
  try {
    const res = await ghlFetch("/contacts/upsert", env.GHL_TOKEN, upsertBody);
    if (!res.ok) return json({ ok: false, error: "crm-upsert-" + res.status });
    const body = await res.json();
    contactId = body && body.contact && body.contact.id;
    if (!contactId) return json({ ok: false, error: "crm-no-id" });
  } catch {
    return json({ ok: false, error: "crm-unreachable" });
  }

  const lines = [
    "DIAGNOSTIC INTAKE (website step funnel)",
    "Priority score: " + score + "/10",
    "Lane: " + LANE_LABELS[answers.service],
    "Agreements in play: " + SCALE_LABELS[answers.scale],
    "Symptoms: " +
      (answers.symptoms.length
        ? answers.symptoms.map((k) => SYMPTOM_LABELS[k]).join(" | ")
        : "none selected"),
    "Last reconciled: " + RECENCY_LABELS[answers.recency],
    "Timeline: " + TIMELINE_LABELS[answers.timeline],
    "",
    "Shown on thank-you page: " +
      (shown.length ? shown.map((k) => FINDING_LABELS[k]).join(" | ") : "none"),
    "Held for the call: " +
      (held.length ? held.map((k) => FINDING_LABELS[k]).join(" | ") : "none"),
    "",
    "Submitted from: " + (page || "unknown"),
    referrer ? "Referrer: " + referrer : "",
    firstTouch ? "First touch: " + firstTouch : "",
    gclid ? "gclid: " + gclid : "",
  ].filter(Boolean);

  try {
    await ghlFetch("/contacts/" + contactId + "/notes", env.GHL_TOKEN, {
      body: lines.join("\n"),
    });
  } catch {
    // Contact exists; a lost note must not lose the lead. Continue.
  }

  return json({ ok: true });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
