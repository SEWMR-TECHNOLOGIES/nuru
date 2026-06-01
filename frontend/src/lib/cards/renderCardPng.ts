/**
 * Browser-side card-to-PNG renderer for pledge thank-you cards.
 *
 * Why this exists: the Illustrator-exported pledge card SVG is ~12 MB with
 * dozens of embedded base64 images. Rendering it through `cairosvg` on the
 * VPS or `resvg-wasm` in a Supabase Edge Function blows past memory/CPU
 * limits and the WhatsApp template ends up with a broken image header.
 *
 * The browser already paints the exact preview the organiser approved, so
 * we capture *that* DOM as a PNG using `html-to-image`, upload the bytes
 * to backend storage, and hand the final URL to WhatsApp.
 */
import { toBlob } from "html-to-image";

/**
 * Render an SVG markup string to a PNG blob at the given pixel ratio.
 * Uses a temporarily mounted off-screen DOM node so html-to-image can
 * embed fonts and resolve relative URLs.
 */
export async function renderSvgMarkupToPng(
  svgMarkup: string,
  opts: { width?: number; pixelRatio?: number } = {},
): Promise<Blob> {
  const width = opts.width ?? 1080;
  const pixelRatio = opts.pixelRatio ?? 2;

  // Inline every @font-face url() as a base64 data URI BEFORE we mount or
  // capture. Without this, Firefox (and Safari) render the captured PNG
  // with system fallbacks because html-to-image serialises the SVG into
  // an isolated image context where document.fonts isn't shared and
  // cross-origin font URLs aren't refetched. Chrome happened to work
  // because its raster path reuses the live fonts; Firefox does not.
  const inlinedSvg = await inlineSvgFontUrls(svgMarkup);

  // Mount off-screen but still painted (visibility:hidden would skip layout).
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = `${width}px`;
  host.style.pointerEvents = "none";
  host.style.background = "#ffffff";
  host.innerHTML = inlinedSvg;

  const svgEl = host.querySelector("svg");
  if (svgEl) {
    // Lock the captured surface to a known width while preserving aspect.
    svgEl.setAttribute("width", String(width));
    svgEl.removeAttribute("height");
    svgEl.style.display = "block";
    svgEl.style.width = `${width}px`;
    svgEl.style.height = "auto";
  }
  document.body.appendChild(host);

  try {
    // Belt-and-braces: also register each face on document.fonts so the
    // off-screen DOM lays out with the right metrics before capture.
    await preloadSvgFonts(inlinedSvg);
    try {
      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
    } catch {
      /* font loader unavailable — best effort */
    }
    // Force layout + a frame so any late-arriving images are decoded.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 120));

    const target = (svgEl as unknown as HTMLElement) || host;
    const blob = await toBlob(target, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: false,
      skipFonts: false,
    });
    if (!blob) throw new Error("Card capture returned an empty image.");
    return blob;
  } finally {
    host.remove();
  }
}

/** Fetch every http(s)/relative font URL referenced by @font-face inside
 *  the SVG and rewrite each `url(...)` to a base64 data URI. The result
 *  is a fully self-contained SVG that renders identically when html-to-
 *  image serialises it into an Image for canvas rasterisation — the
 *  approach that finally makes Firefox stop falling back to system
 *  fonts for script faces like Anthony Hunter. */
async function inlineSvgFontUrls(svgMarkup: string): Promise<string> {
  const urls = new Set<string>();
  const fontFaceRe = /@font-face\s*{([^}]+)}/gi;
  const srcUrlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = fontFaceRe.exec(svgMarkup))) {
    let u: RegExpExecArray | null;
    srcUrlRe.lastIndex = 0;
    while ((u = srcUrlRe.exec(m[1]))) {
      const url = u[1];
      if (url.startsWith("data:")) continue;
      if (/^https?:\/\//i.test(url) || url.startsWith("/")) urls.add(url);
    }
  }
  if (urls.size === 0) return svgMarkup;

  const dataMap = new Map<string, string>();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const r = await fetch(url, { credentials: "omit", mode: "cors" });
        if (!r.ok) return;
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        const lower = url.toLowerCase();
        const mime = lower.endsWith(".woff2")
          ? "font/woff2"
          : lower.endsWith(".woff")
          ? "font/woff"
          : lower.endsWith(".otf")
          ? "font/otf"
          : "font/ttf";
        dataMap.set(url, `data:${mime};base64,${b64}`);
      } catch {
        /* leave the original URL — preload pass will still try */
      }
    }),
  );

  let out = svgMarkup;
  dataMap.forEach((dataUrl, url) => {
    const esc = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`url\\(\\s*['"]?${esc}['"]?\\s*\\)`, "g"),
      `url('${dataUrl}')`,
    );
  });
  return out;
}





/** Parse every @font-face rule in the SVG <style> blocks and load each
 *  font URL through the FontFace API so the family is registered on
 *  document.fonts BEFORE html-to-image clones the DOM. Without this,
 *  scripty fonts (Anthony Hunter) silently fall back to system fonts and
 *  the captured PNG has blank gaps where styled headings should be. */
async function preloadSvgFonts(svgMarkup: string): Promise<void> {
  if (!(document as any).fonts?.add) return;
  const fontFaceRe = /@font-face\s*{([^}]+)}/gi;
  const familyRe = /font-family\s*:\s*['"]?([^;'"]+)['"]?/i;
  const srcUrlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi;
  const styleRe = /font-style\s*:\s*([a-z]+)/i;
  const weightRe = /font-weight\s*:\s*([a-z0-9]+)/i;

  const jobs: Promise<unknown>[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = fontFaceRe.exec(svgMarkup))) {
    const block = m[1];
    const famMatch = block.match(familyRe);
    if (!famMatch) continue;
    const family = famMatch[1].trim();
    const style = (block.match(styleRe)?.[1] || "normal").trim();
    const weight = (block.match(weightRe)?.[1] || "400").trim();
    srcUrlRe.lastIndex = 0;
    let u: RegExpExecArray | null;
    while ((u = srcUrlRe.exec(block))) {
      const url = u[1];
      if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) continue;
      const key = `${family}|${style}|${weight}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const face = new FontFace(family, `url(${url})`, { style, weight, display: "swap" } as FontFaceDescriptors);
        jobs.push(
          face
            .load()
            .then((loaded) => { (document as any).fonts.add(loaded); })
            .catch(() => {}),
        );
      } catch {
        /* invalid descriptor — skip */
      }
    }
  }
  if (jobs.length) await Promise.all(jobs);
}

