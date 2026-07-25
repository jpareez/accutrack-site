/* /api/book - create the assessment appointment on the GHL calendar for a
   contact the funnel already created. No second form for the prospect.
   Handled failures return JSON with 200; the client falls back to the
   stock booking widget when ok:false. */

const GHL_BASE = "https://services.leadconnectorhq.com";
const CAL_VERSION = "2021-04-15";
const DEFAULT_CALENDAR = "zqY1dBbeXQwIKC3tmeS9";

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function handlePost(context) {
  const { request, env } = context;
  if (!env.GHL_TOKEN || !env.GHL_LOCATION) return json({ ok: false, error: "not-configured" });

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "bad-request" });
  }

  const contactId = typeof data.contactId === "string" ? data.contactId.trim() : "";
  const startTime = typeof data.startTime === "string" ? data.startTime.trim() : "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(contactId)) return json({ ok: false, error: "bad-contact" });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/.test(startTime)) {
    return json({ ok: false, error: "bad-slot" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(GHL_BASE + "/calendars/events/appointments", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.GHL_TOKEN,
        Version: CAL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        calendarId: env.GHL_CALENDAR || DEFAULT_CALENDAR,
        locationId: env.GHL_LOCATION,
        contactId: contactId,
        startTime: startTime,
        appointmentStatus: "confirmed",
        title: "Free Assessment (website)",
      }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return json({ ok: false, error: "calendar-unreachable" });
  }
  clearTimeout(timer);
  if (!res.ok) return json({ ok: false, error: "book-" + res.status });
  return json({ ok: true });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
