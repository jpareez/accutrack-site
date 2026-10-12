// Byte-range serving for the /start lane VSLs.
// Cloudflare Pages static assets answer a Range request with the whole file (200, no Accept-Ranges).
// iOS Safari will not play an MP4 without 206 partial responses, and no browser can seek.
// This function reads the static file through the ASSETS binding and answers ranges itself.
const TYPES = { mp4: "video/mp4", webp: "image/webp", jpg: "image/jpeg" };

function baseHeaders(path, size) {
  const ext = path.split(".").pop().toLowerCase();
  return {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(size),
  };
}

async function load(context) {
  const url = new URL(context.request.url);
  const res = await context.env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!res.ok) return { res };
  return { buf: await res.arrayBuffer(), path: url.pathname };
}

export async function onRequestHead(context) {
  const { res, buf, path } = await load(context);
  if (res) return new Response(null, { status: res.status });
  return new Response(null, { status: 200, headers: baseHeaders(path, buf.byteLength) });
}

export async function onRequestGet(context) {
  const { res, buf, path } = await load(context);
  if (res) return res;
  const size = buf.byteLength;
  const range = context.request.headers.get("Range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(buf, { status: 200, headers: baseHeaders(path, size) });
  }
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  }
  const h = baseHeaders(path, end - start + 1);
  h["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: h });
}
