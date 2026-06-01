/**
 * Browser-side card renderer for pledge thank-you cards.
 *
 * Two public APIs:
 *
 *  1. `renderSvgMarkupToPng(svgMarkup, opts)` — legacy one-shot renderer
 *     kept for callers that render a single card.
 *
 *  2. `createCardRenderJob(templateSvg, opts)` — preferred for bulk sends.
 *     Performs the expensive work once (font inlining, `document.fonts.ready`,
 *     mounting a persistent off-screen host) and then accepts per-recipient
 *     `render({ token, value })` calls that only swap dynamic text and
 *     capture the host. After the batch finishes, call `.dispose()` to
 *     release the DOM node.
 *
 * Why this exists: the Illustrator-exported pledge card SVG is ~12 MB with
 * dozens of embedded base64 images. Rendering it through `cairosvg` on the
 * VPS or `resvg-wasm` in a Supabase Edge Function blows past memory/CPU
 * limits and the WhatsApp template ends up with a broken image header. The
 * browser already paints the exact preview the organiser approved, so we
 * capture that DOM and upload the bytes.
 */
import { toBlob } from "html-to-image";

export interface RenderOutputOpts {
  /** Final CSS width fed to html-to-image. Default 1080. */
  width?: number;
  /** Device-pixel-ratio multiplier. Default 1 (1080px output). */
  pixelRatio?: number;
  /** Output mime — "image/jpeg" is ~3-5× smaller than PNG. */
  mimeType?: "image/png" | "image/jpeg";
  /** JPEG/WEBP quality 0..1. Default 0.9. */
  quality?: number;
}

export interface RenderJobOpts extends RenderOutputOpts {
  /** Hard cap per render. Default 10 000 ms. */
  timeoutMs?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Legacy single-shot renderer — still used by some callers.                 */
/* ────────────────────────────────────────────────────────────────────────── */

export async function renderSvgMarkupToPng(
  svgMarkup: string,
  opts: RenderOutputOpts = {},
): Promise<Blob> {
  const job = await createCardRenderJob(svgMarkup, opts);
  try {
    return await job.captureCurrent();
  } finally {
    job.dispose();
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Reusable render job — preferred for bulk sends.                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CardRenderJob {
  /**
   * Replace every occurrence of `token` in the prepared SVG with `value`,
   * mount it into the persistent host, and capture a blob. Subsequent
   * calls reuse the inlined-font template — only the token swap happens.
   */
  render(swap: { token: string; value: string }): Promise<Blob>;
  /** Capture whatever is currently mounted (used by the legacy API). */
  captureCurrent(): Promise<Blob>;
  /** Release the DOM host. Safe to call multiple times. */
  dispose(): void;
}

export async function createCardRenderJob(
  templateSvg: string,
  opts: RenderJobOpts = {},
): Promise<CardRenderJob> {
  const width = opts.width ?? 1080;
  const pixelRatio = opts.pixelRatio ?? 1;
  const mimeType = opts.mimeType ?? "image/jpeg";
  const quality = opts.quality ?? 0.9;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  // ── One-time heavy work ────────────────────────────────────────────
  // Inline @font-face URLs to data URIs so the html-to-image image
  // context renders the right glyphs (Firefox/Safari otherwise fall
  // back to system fonts because their canvas raster path doesn't
  // share document.fonts).
  const preparedSvg = await inlineSvgFontUrls(templateSvg);

  // Persistent off-screen host — reused across every render() call so
  // we don't re-mount/remove a heavy SVG per recipient.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = `${width}px`;
  host.style.pointerEvents = "none";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  // Register fonts on document.fonts once so layout uses correct metrics.
  await preloadSvgFonts(preparedSvg);
  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
  } catch {
    /* font loader unavailable — best effort */
  }

  let disposed = false;
  let lastMarkup = "";

  const mount = (svg: string) => {
    host.innerHTML = svg;
    const svgEl = host.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("width", String(width));
      svgEl.removeAttribute("height");
      (svgEl as unknown as HTMLElement).style.display = "block";
      (svgEl as unknown as HTMLElement).style.width = `${width}px`;
      (svgEl as unknown as HTMLElement).style.height = "auto";
    }
    lastMarkup = svg;
  };

  // Mount the prepared template once so the first render() call is fast.
  mount(preparedSvg);

  const capture = async (): Promise<Blob> => {
    if (disposed) throw new Error("Render job already disposed");
    const target =
      (host.querySelector("svg") as unknown as HTMLElement) || host;

    // Yield one frame so any late-decoded images / fonts settle.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const blobPromise = toBlob(target, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: false,
      skipFonts: false,
      type: mimeType,
      quality,
    } as Parameters<typeof toBlob>[1]);

    const blob = await withTimeout(blobPromise, timeoutMs, "Card render timed out");
    if (!blob) throw new Error("Card capture returned an empty image.");
    return blob;
  };

  return {
    async render({ token, value }) {
      if (!token) {
        // No swap requested — capture current mount.
        return capture();
      }
      const escaped = escapeXml(value);
      const swapped = lastMarkup === preparedSvg
        ? preparedSvg.split(token).join(escaped)
        : preparedSvg.split(token).join(escaped);
      mount(swapped);
      return capture();
    },
    captureCurrent: capture,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        host.innerHTML = "";
        host.remove();
      } catch {
        /* ignore */
      }
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Fetch every http(s)/relative font URL referenced by @font-face inside
 *  the SVG and rewrite each `url(...)` to a base64 data URI. */
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
      // Accept data: URIs too, since inlineSvgFontUrls just rewrote remote
      // URLs into base64. Without this, the preload pass silently skips
      // every face after inlining and document.fonts never registers them.
      const acceptable = url.startsWith("data:") || /^https?:\/\//i.test(url) || url.startsWith("/");
      if (!acceptable) continue;
      const key = `${family}|${style}|${weight}|${url.slice(0, 64)}`;
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
