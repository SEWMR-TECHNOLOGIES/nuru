// Builds an SVG mirroring the mobile YourTicketScreen design:
// - Single perforated card: dark hero on top, white body below
// - Side notches between hero and body, scalloped bottom edge
// - QR section, dashed dividers, info grid, venue + important info
// 1080 x ~1600 PNG (output via resvg)

const W = 1080;
const HERO_H = 360; // ~170dp scaled (170 * 2.12)
const NOTCH_R = 26;
const SCALLOP_R = 14;

function escapeXml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function classColor(cls: string): string {
  const c = (cls || '').toLowerCase();
  if (c.includes('vip')) return '#7C3AED';
  if (c.includes('premium') || c.includes('platinum')) return '#B45309';
  if (c.includes('gold')) return '#CA8A04';
  return '#C2410C'; // AppColors.primary fallback (Nuru red/orange)
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toFixed(0).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

const WK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${WK[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(t?: string | null): string {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** Build a path for the perforated ticket shape. */
function buildTicketPath(width: number, height: number): string {
  const r = 24; // outer corner radius
  const ny = HERO_H;
  // Top: rounded corners; sides: notches at HERO_H; bottom: scalloped
  const scallops = Math.floor(width / (SCALLOP_R * 2));
  const scallopWidth = width / scallops;
  let path = '';
  // Top-left corner
  path += `M ${r} 0 `;
  path += `H ${width - r} `;
  path += `A ${r} ${r} 0 0 1 ${width} ${r} `;
  // Right side down to notch
  path += `V ${ny - NOTCH_R} `;
  // Right notch (concave half-circle facing left)
  path += `A ${NOTCH_R} ${NOTCH_R} 0 0 0 ${width} ${ny + NOTCH_R} `;
  // Down to bottom-right corner area
  path += `V ${height - SCALLOP_R} `;
  // Scalloped bottom (right to left)
  for (let i = 0; i < scallops; i++) {
    const sx = width - (i + 1) * scallopWidth;
    path += `A ${SCALLOP_R} ${SCALLOP_R} 0 0 1 ${sx} ${height - SCALLOP_R} `;
  }
  // Left side up
  path += `V ${ny + NOTCH_R} `;
  // Left notch
  path += `A ${NOTCH_R} ${NOTCH_R} 0 0 0 0 ${ny - NOTCH_R} `;
  path += `V ${r} `;
  path += `A ${r} ${r} 0 0 1 ${r} 0 Z`;
  return path;
}

interface BuildArgs {
  eventName: string;
  ticketCode: string;
  ticketClass: string;
  status: string;
  location: string;
  coverImageDataUrl: string | null;
  date?: string | null;     // ISO date
  time?: string | null;     // HH:MM
  quantity: number;
  currency: string;
  totalAmount?: number | null;
  organizerName: string;
  qrPngDataUrl: string;     // generated QR for the ticket code
}

export function buildTicketSvg(a: BuildArgs): string {
  const HEIGHT = 1620;
  const path = buildTicketPath(W, HEIGHT);
  const cls = a.ticketClass || 'General';
  const cc = classColor(a.ticketClass);
  const dateStr = fmtDate(a.date) || '—';
  const timeStr = fmtTime(a.time) || '—';
  const totalStr = a.totalAmount != null ? `${a.currency} ${fmtAmount(a.totalAmount)}` : '';

  // Hero background: cover image (clipped) with dark gradient overlay
  const cover = a.coverImageDataUrl
    ? `<image x="0" y="0" width="${W}" height="${HERO_H}" href="${a.coverImageDataUrl}" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEIGHT}" viewBox="0 0 ${W} ${HEIGHT}" font-family="Inter, system-ui, sans-serif">
  <defs>
    <clipPath id="ticketShape"><path d="${path}"/></clipPath>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F172A" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#0F172A" stop-opacity="0.95"/>
    </linearGradient>
    <pattern id="dashes" x="0" y="0" width="14" height="2" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="8" height="2" fill="#D1D5DB"/>
    </pattern>
  </defs>

  <!-- Soft page background -->
  <rect width="${W}" height="${HEIGHT}" fill="#F7F7F8"/>

  <g clip-path="url(#ticketShape)">
    <!-- Card background -->
    <rect width="${W}" height="${HEIGHT}" fill="#FFFFFF"/>

    <!-- Hero -->
    <rect x="0" y="0" width="${W}" height="${HERO_H}" fill="#0F172A"/>
    ${cover}
    <rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#heroGrad)"/>

    <!-- Hero text -->
    <text x="56" y="92" fill="#F5F0E8" font-size="22" font-weight="600" letter-spacing="4">YOUR TICKET</text>
    <text x="56" y="180" fill="#FFFFFF" font-size="56" font-weight="700">${escapeXml(a.eventName).slice(0, 38)}</text>
    <g>
      <rect x="56" y="220" width="${Math.min(360, cls.length * 22 + 60)}" height="44" rx="22" fill="${cc}" fill-opacity="0.95"/>
      <text x="${56 + Math.min(360, cls.length * 22 + 60) / 2}" y="250" fill="#FFFFFF" font-size="20" font-weight="600" text-anchor="middle">${escapeXml(cls.toUpperCase())}</text>
    </g>

    <!-- QR section (centered) -->
    <text x="${W / 2}" y="${HERO_H + 80}" text-anchor="middle" fill="#6B7280" font-size="22" letter-spacing="3">SCAN AT ENTRANCE</text>
    <rect x="${W / 2 - 220}" y="${HERO_H + 110}" width="440" height="440" rx="24" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>
    <image x="${W / 2 - 200}" y="${HERO_H + 130}" width="400" height="400" href="${a.qrPngDataUrl}"/>
    <text x="${W / 2}" y="${HERO_H + 600}" text-anchor="middle" fill="#111827" font-size="32" font-weight="700" letter-spacing="6">${escapeXml(a.ticketCode)}</text>

    <!-- Dashed divider -->
    <rect x="56" y="${HERO_H + 650}" width="${W - 112}" height="2" fill="url(#dashes)"/>

    <!-- Info grid -->
    <g transform="translate(56, ${HERO_H + 700})">
      <text x="0" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">DATE</text>
      <text x="0" y="40" fill="#111827" font-size="28" font-weight="600">${escapeXml(dateStr)}</text>

      <text x="${(W - 112) / 2}" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">TIME</text>
      <text x="${(W - 112) / 2}" y="40" fill="#111827" font-size="28" font-weight="600">${escapeXml(timeStr)}</text>
    </g>

    <g transform="translate(56, ${HERO_H + 820})">
      <text x="0" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">QUANTITY</text>
      <text x="0" y="40" fill="#111827" font-size="28" font-weight="600">${a.quantity}</text>

      ${totalStr ? `
      <text x="${(W - 112) / 2}" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">TOTAL</text>
      <text x="${(W - 112) / 2}" y="40" fill="#111827" font-size="28" font-weight="600">${escapeXml(totalStr)}</text>
      ` : ''}
    </g>

    <!-- Dashed divider -->
    <rect x="56" y="${HERO_H + 940}" width="${W - 112}" height="2" fill="url(#dashes)"/>

    ${a.location ? `
    <g transform="translate(56, ${HERO_H + 990})">
      <text x="0" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">VENUE</text>
      <text x="0" y="40" fill="#111827" font-size="26" font-weight="600">${escapeXml(a.location.slice(0, 60))}</text>
    </g>
    ` : ''}

    <!-- Important info -->
    <g transform="translate(56, ${HERO_H + 1100})">
      <text x="0" y="0" fill="#9CA3AF" font-size="20" letter-spacing="2">IMPORTANT</text>
      <text x="0" y="36" fill="#374151" font-size="22">Bring this ticket and a valid ID. Doors open 30 minutes</text>
      <text x="0" y="66" fill="#374151" font-size="22">before the event start time.</text>
    </g>

    <!-- Footer brand -->
    <text x="${W / 2}" y="${HEIGHT - 60}" text-anchor="middle" fill="#9CA3AF" font-size="20" letter-spacing="4">POWERED BY NURU</text>
  </g>

  <!-- Outline -->
  <path d="${path}" fill="none" stroke="#E5E7EB" stroke-width="2"/>
</svg>`;
}
