/* /api/lead - diagnostic funnel intake -> GHL contact + note.
   Env: GHL_TOKEN (private integration token), GHL_LOCATION (location id).
   Handled failures return JSON with status 200: Cloudflare Pages replaces
   raw 5xx Function responses with its generic error page, so the client
   would never see the body. The client treats ok:false as failure. */

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

const ENUMS = {
  service: ["licensing", "contract", "royalty", "deduction", "notsure"],
  scale: ["u25", "s100", "s250", "s500", "p500", "unsure"],
  recency: ["year", "three", "never", "unsure"],
  timeline: ["month", "quarter", "gathering"],
  exposure: ["", "u250", "m1", "m5", "m5p", "skip", "u100", "m500", "m2", "m2p", "unknown"],
};

const SITUATION_LABELS = {
  sit_light: "Royalty checks look lighter than they should",
  sit_late: "Statements show up late or not at all",
  sit_surprise: "A renewal or deadline caught us off guard",
  sit_inherit: "Acquiring; agreements piling up (inherited portfolio)",
  sit_pile: "Contracts piling up faster than they can track",
  sit_slip: "Renewals keep slipping past",
  sit_clm: "Priced CLM software and balked",
  sit_trust: "Takes licensees' math on trust",
  sit_stopped: "A licensee went quiet on reporting",
  sit_audit: "Weighing a formal royalty audit",
  sit_deduct: "Retailers taking money off invoices",
  sit_otif: "OTIF fines and chargebacks stacking up",
  sit_sizing: "Trying to size annual deduction loss",
  sit_compliance: "Licensing compliance needs to get under control",
  sit_ahead: "Just getting ahead of it / browsing",
};

const SYMPTOM_LABELS = {
  lic_facevalue: "Takes licensees' numbers at face value",
  lic_minimums: "Minimum guarantees nobody is checking",
  lic_spreadsheet: "Renewals and deadlines live in a spreadsheet",
  lic_memory: "Compliance lives in one person's memory",
  lic_stopped: "At least one licensee has gone quiet",
  con_renewals: "Renewal dates slip past before anyone notices",
  con_inbox: "Obligations live in inboxes and memory",
  con_visibility: "Nobody can say what is due this month",
  con_memory: "Tracking lives in one person's head",
  con_volume: "Volume outgrew the person watching it",
  roy_late: "Statements arrive late or incomplete",
  roy_facevalue: "Takes the licensee's math at face value",
  roy_suspicion: "Short payments are a suspicion, not a number",
  roy_audit: "A formal audit feels too heavy to start",
  ded_pace: "Deductions hit faster than they can review",
  ded_fines: "OTIF fines and vendor chargebacks pile up",
  ded_postaudit: "Post-audit claims land months after the sale",
  ded_writeoff: "Disputes a few, writes off the rest",
  ded_unknown: "Nobody knows the true annual total",
  gen_spreadsheet: "Tracking lives in spreadsheets and memory",
  gen_leak: "Money leaking, nobody has quantified it",
  gen_facevalue: "Takes reported numbers at face value",
  gen_secondjob: "It has become somebody's second job",
};

const FINDING_LABELS = {
  f_flow_gap: "Reconciliation gap sized against their flow (15-25% study)",
  f_reconcile_gap: "Reconciliation gap (15-25% study)",
  f_facevalue: "Licensee math taken at face value (study)",
  f_stopped: "Licensee gone quiet = loudest signal",
  f_minimums: "Unchecked minimum guarantees",
  f_memory: "Single-person-memory structural risk",
  f_inherit: "Inherited portfolio, no central record ($27.6M pattern)",
  f_clm: "CLM software still needs people",
  f_spreadsheet: "Deadline tracking rides on memory",
  f_con_renewals: "Renewal slippage",
  f_con_inbox: "Obligations in inboxes and memory",
  f_con_visibility: "No monthly obligations visibility",
  f_con_volume: "Volume past manual tracking",
  f_roy_suspicion: "Unquantified shortfall",
  f_roy_audit: "Audit-aversion stalls recovery",
  f_ded_exposure: "Deduction exposure sized against their number",
  f_ded_unknown: "True annual deduction total unknown",
  f_ded_postaudit: "Post-audit claims on a cold trail",
  f_ded_pace: "Deduction pace beats review capacity",
  f_ded_writeoff: "Write-off has become the default",
  f_ded_uncontested: "Uncontested deductions = permanent loss",
  f_gen_leak: "Unquantified leak",
  f_scale: "Scale past the point manual diligence holds",
  f_small: "Second-job tracking on a smaller portfolio",
  f_default: "Run on effort and memory",
};

const LANE_LABELS = {
  licensing: "Licensing compliance",
  contract: "Contract management",
  royalty: "Royalty reporting",
  deduction: "Deduction recovery",
  notsure: "General / not sure",
};

const SCALE_LABELS = {
  u25: "A couple dozen or fewer",
  s100: "25 to 100",
  s250: "100 to 250",
  s500: "250 to 500",
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

const EXPOSURE_LABELS = {
  u250: "Under $250K/yr through the agreements",
  m1: "$250K to $1M/yr through the agreements",
  m5: "$1M to $5M/yr through the agreements",
  m5p: "More than $5M/yr through the agreements",
  skip: "Declined to say",
  u100: "Under $100K/yr in deductions",
  m500: "$100K to $500K/yr in deductions",
  m2: "$500K to $2M/yr in deductions",
  m2p: "More than $2M/yr in deductions",
  unknown: "Nobody knows the annual deduction total",
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
  s += { u25: 0, s100: 1, s250: 2, s500: 2, p500: 3, unsure: 1 }[a.scale] || 0;
  s += Math.min(a.symptoms.length, 2);
  s += { year: 0, three: 1, never: 2, unsure: 1 }[a.recency] || 0;
  s += { month: 2, quarter: 1, gathering: 0 }[a.timeline] || 0;
  s += { m5: 1, m5p: 1, m2: 1, m2p: 1, unknown: 1 }[a.exposure] || 0;
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
  const TOKEN = env.GHL_TOKEN || env.GHL_Token;
  const LOCATION = env.GHL_LOCATION || env.GHL_Location;

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
    situation: SITUATION_LABELS[data.situation] ? data.situation : "",
    scale: ENUMS.scale.includes(data.scale) ? data.scale : "unsure",
    recency: ENUMS.recency.includes(data.recency) ? data.recency : "unsure",
    timeline: ENUMS.timeline.includes(data.timeline) ? data.timeline : "gathering",
    exposure: ENUMS.exposure.includes(data.exposure) ? data.exposure : "",
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

  if (!TOKEN || !LOCATION) {
    return json({ ok: false, error: "not-configured" });
  }

  const nameParts = name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const score = scoreLead(answers);

  const upsertBody = {
    locationId: LOCATION,
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
    const res = await ghlFetch("/contacts/upsert", TOKEN, upsertBody);
    if (!res.ok) return json({ ok: false, error: "crm-upsert-" + res.status });
    const body = await res.json();
    contactId = body && body.contact && body.contact.id;
    if (!contactId) return json({ ok: false, error: "crm-no-id" });
  } catch {
    return json({ ok: false, error: "crm-unreachable" });
  }

  const lines = [
    "DIAGNOSTIC INTAKE (website conversation)",
    "Priority score: " + score + "/10",
    "Lane: " + LANE_LABELS[answers.service],
    answers.situation ? "Trigger: " + SITUATION_LABELS[answers.situation] : "",
    "Agreements in play: " + SCALE_LABELS[answers.scale],
    "Symptoms: " +
      (answers.symptoms.length
        ? answers.symptoms.map((k) => SYMPTOM_LABELS[k]).join(" | ")
        : "none selected"),
    "Last reconciled: " + RECENCY_LABELS[answers.recency],
    answers.exposure && answers.exposure !== "skip"
      ? "Exposure: " + EXPOSURE_LABELS[answers.exposure]
      : "Exposure: not shared",
    "Timeline: " + TIMELINE_LABELS[answers.timeline],
    "",
    "Shown in the chat preview: " +
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
    await ghlFetch("/contacts/" + contactId + "/notes", TOKEN, {
      body: lines.join("\n"),
    });
  } catch {
    // Contact exists; a lost note must not lose the lead. Continue.
  }

  return json({ ok: true, contactId: contactId });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
