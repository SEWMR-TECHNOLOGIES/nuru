import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BOT_UA_REGEX = /bot|crawler|spider|crawling|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Googlebot|Bingbot|Baiduspider|DuckDuckBot|Embedly|Quora|outbrain|pinterest|vkShare|Tumblr|Swiftbot|Flipboard|W3C_Validator|redditbot|Applebot|YandexBot|ia_archiver|Sogou/i;

serve(async (req) => {
  const url = new URL(req.url);
  
  // Extract post ID from query param or path
  let postId = url.searchParams.get("id");
  const pathMatch = url.pathname.match(/\/shared\/post\/([a-f0-9-]+)/i);
  if (pathMatch) postId = pathMatch[1];
  
  if (!postId) {
    return new Response("Missing post ID", { status: 400 });
  }

  const siteUrl = "https://nuru.tz";
  const postUrl = `${siteUrl}/shared/post/${postId}`;

  // For real browsers (non-bots), just redirect to the SPA with ?r=1 to bypass rewrite
  const userAgent = req.headers.get("user-agent") || "";
  if (!BOT_UA_REGEX.test(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `${postUrl}?r=1`,
        "Cache-Control": "no-cache",
      },
    });
  }

  const API_BASE = Deno.env.get("NURU_API_BASE_URL");
  if (!API_BASE) {
    return new Response("API base URL not configured", { status: 500 });
  }

  // Fetch post data from external API (only for crawlers)
  let post: any = null;
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/public`);
    const json = await res.json();
    if (json.success && json.data) {
      post = json.data;
    }
  } catch (e) {
    console.error("Failed to fetch post:", e);
  }

  const siteName = "Nuru";
  const title = post?.content?.slice(0, 60) || "Shared on Nuru";
  const description = post?.content?.slice(0, 160) || "Check out this moment on Nuru – your all-in-one event planning platform.";
  const image = post?.images?.[0] || `${siteUrl}/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - ${siteName}</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(postUrl)}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <link rel="canonical" href="${escapeHtml(postUrl)}" />
</head>
<body>
  <p>${escapeHtml(title)}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
