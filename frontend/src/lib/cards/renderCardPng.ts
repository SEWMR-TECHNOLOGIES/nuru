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

  // Mount off-screen but still painted (visibility:hidden would skip layout).
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = `${width}px`;
  host.style.pointerEvents = "none";
  host.style.background = "#ffffff";
  host.innerHTML = svgMarkup;

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
    // Make sure web fonts referenced by the SVG @font-face rules are loaded
    // before we paint; otherwise the PNG falls back to system fonts.
    try {
      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
    } catch {
      /* font loader unavailable — best effort */
    }
    // Force layout + a frame so any late-arriving images are decoded.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 80));

    const target = (svgEl as unknown as HTMLElement) || host;
    const blob = await toBlob(target, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: false,
      // Anything that can't be fetched (e.g. CORS-blocked) is silently skipped
      // rather than aborting the whole capture.
      skipFonts: false,
    });
    if (!blob) throw new Error("Card capture returned an empty image.");
    return blob;
  } finally {
    host.remove();
  }
}
