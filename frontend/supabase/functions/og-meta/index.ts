import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  
  // Extract post ID from path: /og-meta/shared/post/:id or ?id=...
  let postId = url.searchParams.get("id");
  
  // Also support path-based: /og-meta/shared/post/UUID
  const pathMatch = url.pathname.match(/\/shared\/post\/([a-f0-9-]+)/i);
  if (pathMatch) postId = pathMatch[1];
  
  if (!postId) {
    return new Response("Missing post ID", { status: 400 });
  }

  const API_BASE = Deno.env.get("NURU_API_BASE_URL");
  if (!API_BASE) {
    return new Response("API base URL not configured", { status: 500 });
  }

  // Fetch post data from external API
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
  const siteUrl = "https://nuru.tz";
  const postUrl = `${siteUrl}/shared/post/${postId}`;
  
  const title = post?.content?.slice(0, 60) || "Shared on Nuru";
  const description = post?.content?.slice(0, 160) || "Check out this moment on Nuru – your all-in-one event planning platform.";
  const image = post?.images?.[0] || `${siteUrl}/logo.png`;
  const authorName = post?.author?.name || "Nuru User";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - ${siteName}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(postUrl)}" />
  <meta property="og:site_name" content="${siteName}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <!-- Redirect browsers (non-crawlers) to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(postUrl)}" />
  <link rel="canonical" href="${escapeHtml(postUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(postUrl)}">${escapeHtml(title)}</a>...</p>
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
