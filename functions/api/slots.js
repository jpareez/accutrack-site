/* /api/slots - available booking slots from the GHL calendar, normalized.
   The custom in-page picker consumes this; the stock widget is the
   client-side fallback if this returns ok:false. Handled failures return
   JSON with 200 (CF Pages swallows raw 5xx bodies). */

const GHL_BASE = "https://services.leadconnectorhq.com";
const CAL_VERSION = "2021-04-15";
const DEFAULT_CALENDAR = "zqY1dBbeXQwIKC3tmeS9";

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const TOKEN = env.GHL_TOKEN || env.GHL_Token;
  if (!TOKEN) return json({ ok: false, error: "not-configured" });

  const url = new URL(request.url);
  let tz = url.searchParams.get("tz") || "America/New_York";
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz)) tz = "America/New_York";

  const calendarId = env.GHL_CALENDAR || DEFAULT_CALENDAR;
  const start = Date.now() + 60 * 60 * 1000;
  const end = start + 14 * 24 * 60 * 60 * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(
      GHL_BASE + "/calendars/" + calendarId + "/free-slots?startDate=" + start +
        "&endDate=" + end + "&timezone=" + encodeURIComponent(tz),
      {
        headers: {
          Authorization: "Bearer " + TOKEN,
          Version: CAL_VERSION,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
  } catch {
    clearTimeout(timer);
    return json({ ok: false, error: "calendar-unreachable" });
  }
  clearTimeout(timer);
  if (!res.ok) return json({ ok: false, error: "calendar-" + res.status });

  let body;
  try {
    body = await res.json();
  } catch {
    return json({ ok: false, error: "calendar-bad-response" });
  }

  /* Curate availability: deterministic thinning (stable across refreshes)
     plus a per-day cap, spread across the day. Reads intentional, not empty. */
  function keepSlot(iso) {
    let h = 0;
    for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0;
    return h % 100 < 55;
  }
  function curate(raw) {
    let kept = raw.filter(keepSlot);
    if (!kept.length) kept = raw.slice(0, 1);
    if (kept.length > 7) {
      const picked = [];
      for (let i = 0; i < 7; i++) {
        const idx = Math.round((i * (kept.length - 1)) / 6);
        if (picked.indexOf(kept[idx]) === -1) picked.push(kept[idx]);
      }
      kept = picked;
    }
    return kept;
  }
  const days = [];
  Object.keys(body).forEach((key) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const slots = body[key] && Array.isArray(body[key].slots) ? body[key].slots : [];
    if (slots.length) days.push({ date: key, slots: curate(slots) });
  });
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return json({ ok: true, tz, days: days.slice(0, 10) });
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
}
