// Single, unified invitation card design for WhatsApp delivery.
// Mirrors the editorial Nuru aesthetic used on mobile: Playfair-style serif
// headings, soft cream surface, dark accent band, QR + RSVP code block.
// 1080 x 1620 (2:3 invitation portrait).

const W = 1080;
const H = 1620;

function escapeXml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const WK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

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

export interface InvitationArgs {
  guestName: string;
  eventName: string;
  hostLine?: string | null;
  date?: string | null;       // ISO
  time?: string | null;       // HH:MM
  venue?: string | null;
  address?: string | null;
  dressCode?: string | null;
  rsvpCode: string;
  coverImageDataUrl?: string | null;
  qrPngDataUrl: string;
}

export function buildInvitationSvg(a: InvitationArgs): string {
  const dateStr = fmtDate(a.date);
  const timeStr = fmtTime(a.time);
  const dateTime = [dateStr, timeStr].filter(Boolean).join(' · ');

  // Optional cover sits behind the dark hero band at top.
  const cover = a.coverImageDataUrl
    ? `<image x="0" y="0" width="${W}" height="380" href="${a.coverImageDataUrl}" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Georgia, 'Times New Roman', serif">
  <defs>
    <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F0F12" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#0F0F12" stop-opacity="0.95"/>
    </linearGradient>
    <pattern id="dash" x="0" y="0" width="14" height="2" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="8" height="2" fill="#D6CFC2"/>
    </pattern>
  </defs>

  <!-- Cream page -->
  <rect width="${W}" height="${H}" fill="#F6EFE2"/>

  <!-- Inner card with soft border -->
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="28" fill="#FFFFFF" stroke="#E8DFCC" stroke-width="2"/>

  <!-- Hero band -->
  <g>
    <clipPath id="heroClip"><rect x="48" y="48" width="${W - 96}" height="380" rx="28"/></clipPath>
    <g clip-path="url(#heroClip)">
      <rect x="48" y="48" width="${W - 96}" height="380" fill="#0F0F12"/>
      ${cover}
      <rect x="48" y="48" width="${W - 96}" height="380" fill="url(#heroFade)"/>
    </g>
    <text x="${W / 2}" y="180" text-anchor="middle" fill="#F6EFE2" font-size="24" letter-spacing="8" font-family="Inter, sans-serif">YOU ARE INVITED</text>
    <text x="${W / 2}" y="290" text-anchor="middle" fill="#FFFFFF" font-size="64" font-weight="400" font-style="italic">${escapeXml(a.eventName).slice(0, 32)}</text>
    ${a.hostLine ? `<text x="${W / 2}" y="360" text-anchor="middle" fill="#E8DFCC" font-size="26" font-family="Inter, sans-serif">${escapeXml(a.hostLine).slice(0, 64)}</text>` : ''}
  </g>

  <!-- Guest greeting -->
  <text x="${W / 2}" y="510" text-anchor="middle" fill="#6B5B3A" font-size="22" letter-spacing="4" font-family="Inter, sans-serif">DEAR GUEST</text>
  <text x="${W / 2}" y="580" text-anchor="middle" fill="#1A1208" font-size="56" font-weight="400">${escapeXml(a.guestName).slice(0, 28)}</text>

  <!-- Dashed divider -->
  <rect x="180" y="630" width="${W - 360}" height="2" fill="url(#dash)"/>

  <!-- Date / Time -->
  <text x="${W / 2}" y="700" text-anchor="middle" fill="#6B5B3A" font-size="20" letter-spacing="3" font-family="Inter, sans-serif">WHEN</text>
  <text x="${W / 2}" y="750" text-anchor="middle" fill="#1A1208" font-size="32" font-weight="600" font-family="Inter, sans-serif">${escapeXml(dateTime || 'TBD')}</text>

  <!-- Venue -->
  ${a.venue ? `
  <text x="${W / 2}" y="830" text-anchor="middle" fill="#6B5B3A" font-size="20" letter-spacing="3" font-family="Inter, sans-serif">WHERE</text>
  <text x="${W / 2}" y="880" text-anchor="middle" fill="#1A1208" font-size="30" font-weight="600" font-family="Inter, sans-serif">${escapeXml(a.venue).slice(0, 48)}</text>
  ${a.address ? `<text x="${W / 2}" y="918" text-anchor="middle" fill="#6B5B3A" font-size="22" font-family="Inter, sans-serif">${escapeXml(a.address).slice(0, 64)}</text>` : ''}
  ` : ''}

  ${a.dressCode ? `
  <text x="${W / 2}" y="990" text-anchor="middle" fill="#6B5B3A" font-size="20" letter-spacing="3" font-family="Inter, sans-serif">DRESS CODE</text>
  <text x="${W / 2}" y="1030" text-anchor="middle" fill="#1A1208" font-size="26" font-family="Inter, sans-serif">${escapeXml(a.dressCode).slice(0, 48)}</text>
  ` : ''}

  <!-- Dashed divider -->
  <rect x="180" y="1090" width="${W - 360}" height="2" fill="url(#dash)"/>

  <!-- QR + RSVP code -->
  <rect x="${W / 2 - 170}" y="1130" width="340" height="340" rx="20" fill="#FFFFFF" stroke="#E8DFCC" stroke-width="2"/>
  <image x="${W / 2 - 150}" y="1150" width="300" height="300" href="${a.qrPngDataUrl}"/>

  <text x="${W / 2}" y="1510" text-anchor="middle" fill="#6B5B3A" font-size="18" letter-spacing="4" font-family="Inter, sans-serif">RSVP CODE</text>
  <text x="${W / 2}" y="1548" text-anchor="middle" fill="#1A1208" font-size="26" font-weight="700" letter-spacing="6" font-family="Inter, sans-serif">${escapeXml(a.rsvpCode)}</text>

  <!-- Footer brand -->
  <text x="${W / 2}" y="${H - 70}" text-anchor="middle" fill="#9C8B6B" font-size="18" letter-spacing="6" font-family="Inter, sans-serif">POWERED BY NURU</text>
</svg>`;
}
