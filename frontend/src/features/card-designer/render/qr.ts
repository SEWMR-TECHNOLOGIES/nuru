/** QR data-url cache to avoid re-encoding the same payload. */
import QRCode from "qrcode";

const cache = new Map<string, string>();

export async function qrDataUrl(
  payload: string,
  size: number,
  fg = "#000000",
  bg = "#FFFFFF",
  margin = 1,
): Promise<string> {
  const key = `${payload}|${size}|${fg}|${bg}|${margin}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const url = await QRCode.toDataURL(payload || " ", {
    errorCorrectionLevel: "M",
    width: Math.max(64, Math.round(size)),
    margin,
    color: { dark: fg, light: bg },
  });
  cache.set(key, url);
  return url;
}
