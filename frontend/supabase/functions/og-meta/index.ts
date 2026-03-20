import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BOT_UA_REGEX = /bot|crawler|spider|crawling|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Googlebot|Bingbot|Baiduspider|DuckDuckBot|Embedly|Quora|outbrain|pinterest|vkShare|Tumblr|Swiftbot|Flipboard|W3C_Validator|redditbot|Applebot|YandexBot|ia_archiver|Sogou/i;

const siteUrl = "https://nuru.tz";
const siteName = "Nuru";

function escapeHtml(str: unknown): string {
  const s = String(str ?? '');
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Decode base64url short ID back to UUID */
function decodeShortId(short: string): string {
  try {
    const base64 = short.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const hex = Array.from(binary, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    if (hex.length !== 32) return short;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return short;
  }
}

function buildHtmlPage(title: string, description: string, image: string, canonicalUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - ${siteName}</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <p>${escapeHtml(title)}</p>
</body>
</html>`;
}

// ── Post OG handler ─────────────────────────────────
async function handlePost(postId: string, apiBase: string, shortPath?: string) {
  let post: any = null;
  try {
    const res = await fetch(`${apiBase}/posts/${postId}/public`);
    const json = await res.json();
    if (json.success && json.data) post = json.data;
  } catch (e) {
    console.error("Failed to fetch post:", e);
  }

  const authorName = post?.author?.name || '';
  const title = (post?.content?.slice(0, 60) || (authorName ? `${authorName} on Nuru` : "Shared on Nuru"));
  const description = post?.content?.slice(0, 160) || `${authorName ? authorName + ' shared something on' : 'Check out this moment on'} Nuru – your all-in-one event planning platform.`;
  // images can be strings or {url, media_type} objects
  const firstImg = post?.images?.[0];
  const image = (typeof firstImg === 'string' ? firstImg : firstImg?.url) || `${siteUrl}/logo.png`;
  const canonicalUrl = shortPath ? `${siteUrl}${shortPath}` : `${siteUrl}/shared/post/${postId}`;

  return buildHtmlPage(title, description, image, canonicalUrl);
}

// ── RSVP OG handler ─────────────────────────────────
async function handleRsvp(code: string, apiBase: string) {
  let rsvpData: any = null;
  try {
    const res = await fetch(`${apiBase}/rsvp/${code}`);
    const json = await res.json();
    if (json.success && json.data) rsvpData = json.data;
  } catch (e) {
    console.error("Failed to fetch RSVP:", e);
  }

  const event = rsvpData?.event;
  const guestName = rsvpData?.invitation?.guest_name || "Guest";
  const eventName = event?.name || "Event";
  const title = `You're Invited: ${eventName}`.slice(0, 60);
  const description = event?.description?.slice(0, 160) ||
    `${guestName}, you've been invited to ${eventName} on Nuru. RSVP now!`;
  const image = event?.image_url || `${siteUrl}/logo.png`;
  const canonicalUrl = `${siteUrl}/rsvp/${code}`;

  return buildHtmlPage(title, description, image, canonicalUrl);
}

// ── Photo Library OG handler ─────────────────────────────────
async function handlePhotoLibrary(token: string, apiBase: string) {
  let library: any = null;
  try {
    const res = await fetch(`${apiBase}/photo-libraries/shared/${token}`);
    const json = await res.json();
    if (json.success && json.data) library = json.data;
  } catch (e) {
    console.error("Failed to fetch photo library:", e);
  }

  const libraryName = library?.name || "Photo Library";
  const eventName = library?.event?.name || "";
  const photoCount = library?.photo_count || 0;
  const title = (eventName ? `${libraryName}` : libraryName).slice(0, 60);
  const description = `View ${photoCount} photo${photoCount !== 1 ? "s" : ""} from ${eventName || "this event"} on Nuru – your all-in-one event planning platform.`;
  const image = library?.photos?.[0]?.url || library?.event?.cover_image_url || `${siteUrl}/logo.png`;
  const canonicalUrl = `${siteUrl}/shared/photo-library/${token}`;

  return buildHtmlPage(title, description, image, canonicalUrl);
}

// ── Main handler ────────────────────────────────────
serve(async (req) => {
  const url = new URL(req.url);
  const userAgent = req.headers.get("user-agent") || "";

  let resourceType: "post" | "rsvp" | "photo-library" | null = null;
  let resourceId: string | null = null;
  let shortPath: string | undefined;

  // Check query params
  const idParam = url.searchParams.get("id");
  const shortParam = url.searchParams.get("short");
  const typeParam = url.searchParams.get("type");

  if (shortParam) {
    // Short URL: decode base64url to UUID
    resourceType = "post";
    resourceId = decodeShortId(shortParam);
    shortPath = `/s/${shortParam}`;
  } else if (idParam) {
    if (typeParam === "rsvp") resourceType = "rsvp";
    else if (typeParam === "photo-library") resourceType = "photo-library";
    else resourceType = "post";
    resourceId = idParam;
  }

  // Check path patterns as fallback
  if (!resourceId) {
    const postMatch = url.pathname.match(/\/shared\/post\/([a-f0-9-]+)/i);
    if (postMatch) { resourceType = "post"; resourceId = postMatch[1]; }
    const shortMatch = url.pathname.match(/\/s\/([A-Za-z0-9_-]+)/i);
    if (shortMatch) { resourceType = "post"; resourceId = decodeShortId(shortMatch[1]); shortPath = `/s/${shortMatch[1]}`; }
    const rsvpMatch = url.pathname.match(/\/rsvp\/([A-Z0-9]+)/i);
    if (rsvpMatch) { resourceType = "rsvp"; resourceId = rsvpMatch[1]; }
    const photoLibraryMatch = url.pathname.match(/\/shared\/photo-library\/([A-Za-z0-9_-]+)/i);
    if (photoLibraryMatch) { resourceType = "photo-library"; resourceId = photoLibraryMatch[1]; }
  }

  if (!resourceType || !resourceId) {
    return new Response("Missing resource ID", { status: 400 });
  }

  // For real browsers, redirect to the SPA with ?r=1
  if (!BOT_UA_REGEX.test(userAgent)) {
    let redirectPath: string;
    if (resourceType === "rsvp") {
      redirectPath = `${siteUrl}/rsvp/${resourceId}?r=1`;
    } else if (resourceType === "photo-library") {
      redirectPath = `${siteUrl}/shared/photo-library/${resourceId}?r=1`;
    } else if (shortPath) {
      // Short URL for real users: redirect to the SPA short route
      redirectPath = `${siteUrl}${shortPath}?r=1`;
    } else {
      redirectPath = `${siteUrl}/shared/post/${resourceId}?r=1`;
    }
    return new Response(null, {
      status: 302,
      headers: { "Location": redirectPath, "Cache-Control": "no-cache" },
    });
  }

  const API_BASE = Deno.env.get("NURU_API_BASE_URL");
  if (!API_BASE) {
    return new Response("API base URL not configured", { status: 500 });
  }

  let html: string;
  if (resourceType === "rsvp") {
    html = await handleRsvp(resourceId, API_BASE);
  } else if (resourceType === "photo-library") {
    html = await handlePhotoLibrary(resourceId, API_BASE);
  } else {
    html = await handlePost(resourceId, API_BASE, shortPath);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
