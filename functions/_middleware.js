// Host-level redirect: retire the go. staging subdomain.
// Any request to go.accutracksolutions.com is 301'd to the same path on
// www.accutracksolutions.com (path + query preserved, so Google Ads final
// URLs and gclid tracking keep working during the switch-over).
// All other hosts (www, *.pages.dev) pass straight through to static assets.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "go.accutracksolutions.com") {
    url.hostname = "www.accutracksolutions.com";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
