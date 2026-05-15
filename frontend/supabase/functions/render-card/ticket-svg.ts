// Premium ticket — 1:1 mirror of Flutter `your_ticket_screen.dart`.
// Same TicketShapeClipper as the invitation card: rounded top, side notches
// at hero bottom, scalloped bottom. 1080 px wide canvas.

const W = 1080;
const S = 2.77;                       // dp -> px scale (matches invitation-svg)
const HERO_H = Math.round(170 * S);   // 471
const NOTCH_R = Math.round(12 * S);
const SCALLOP_R = Math.round(7 * S);
const CORNER_R = 24;
const SIDE_PAD = Math.round(20 * S);

const PAGE_BG = '#F7F7F8';
const PAPER = '#FFFFFF';
const INK = '#111827';
const SUB = '#6B7280';
const TERTIARY = '#9CA3AF';
const DASH = '#E5E7EB';
const ACCENT = '#D4AF37';

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
  return '#C2410C';
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

function buildTicketPath(width: number, height: number): string {
  const r = CORNER_R;
  const ny = HERO_H;
  const scallops = Math.max(8, Math.floor(width / (SCALLOP_R * 2)));
  const sw = width / scallops;
  let p = '';
  p += `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} `;
  p += `V ${ny - NOTCH_R} `;
  p += `A ${NOTCH_R} ${NOTCH_R} 0 0 0 ${width} ${ny + NOTCH_R} `;
  p += `V ${height - SCALLOP_R} `;
  for (let i = 0; i < scallops; i++) {
    const sx = width - (i + 1) * sw;
    p += `A ${SCALLOP_R} ${SCALLOP_R} 0 0 1 ${sx} ${height - SCALLOP_R} `;
  }
  p += `V ${ny + NOTCH_R} `;
  p += `A ${NOTCH_R} ${NOTCH_R} 0 0 0 0 ${ny - NOTCH_R} `;
  p += `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  return p;
}

interface BuildArgs {
  eventName: string;
  ticketCode: string;
  ticketClass: string;
  status: string;
  location: string;
  coverImageDataUrl: string | null;
  date?: string | null;
  time?: string | null;
  quantity: number;
  currency: string;
  totalAmount?: number | null;
  organizerName: string;
  qrPngDataUrl: string;
}

export function buildTicketSvg(a: BuildArgs): string {
  const cls = a.ticketClass || 'General';
  const cc = classColor(a.ticketClass);
  const dateStr = fmtDate(a.date);
  const timeStr = fmtTime(a.time);
  const dateLine = dateStr || timeStr
    ? `${dateStr}${dateStr && timeStr ? '  •  ' : ''}${timeStr}`
    : '';

  const isConfirmed = ['confirmed','approved','paid'].includes(a.status);
  const statusLabel = a.status ? a.status[0].toUpperCase() + a.status.slice(1) : 'Pending';
  const statusColor = isConfirmed ? '#15803D' : '#B45309';
  const statusSub = isConfirmed ? 'This ticket is valid for entry.' : 'Awaiting confirmation.';

  // Vertical layout — mirrors Flutter Column gaps
  let y = HERO_H + Math.round(24 * S); // 24dp gap after hero

  // QR card (180dp = 499px) with 14dp inner padding
  const qrSize = Math.round(180 * S);
  const qrPad = Math.round(14 * S);
  const qrBoxSize = qrSize + qrPad * 2;
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = y;
  y = qrBoxY + qrBoxSize + Math.round(14 * S);

  // Ticket code (Space Mono)
  const hasCode = (a.ticketCode || '').trim().length > 0;
  let codeY = 0;
  if (hasCode) {
    codeY = y + 26;
    y = codeY + Math.round(16 * S);
  }

  // Status row
  const statusY = y + 22;
  const statusSubY = statusY + 26;
  y = statusSubY + Math.round(18 * S);

  // Dashed divider 1
  const dash1Y = y;
  y = dash1Y + Math.round(18 * S * 2);

  // Info row: TICKET FOR / ENTRY TYPE / AMOUNT PAID
  const infoLabelY = y;
  const infoValY = infoLabelY + 36;
  y = infoValY + Math.round(18 * S);

  // Dashed divider 2
  const dash2Y = y + Math.round(18 * S);
  y = dash2Y + Math.round(18 * S);

  // VENUE block (with location icon)
  let venueLabelY = 0, venueValY = 0;
  if (a.location) {
    venueLabelY = y;
    venueValY = venueLabelY + 32;
    y = venueValY + Math.round(14 * S);
  }

  // IMPORTANT block
  const impLabelY = y;
  const impValY = impLabelY + 32;
  const impVal2Y = impValY + 30;

  const HEIGHT = impVal2Y + Math.round(28 * S);
  const path = buildTicketPath(W, HEIGHT);

  const cover = a.coverImageDataUrl
    ? `<image x="0" y="0" width="${W}" height="${HERO_H}" href="${a.coverImageDataUrl}" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  // Hero pieces
  const eventTitleY = HERO_H - Math.round(18 * S) - Math.round(12.5 * S * 0.6);
  const dateLineY = HERO_H - Math.round(18 * S);

  const logoX = Math.round(18 * S);
  const logoTopY = Math.round(16 * S);
  const logoBaselineY = logoTopY + Math.round(22 * S * 0.7);

  const clsPillH = Math.round(22 * S);
  const clsPillW = Math.max(180, cls.length * 14 + 70);
  const clsPillX = W - Math.round(18 * S) - clsPillW;
  const clsPillY = Math.round(16 * S);

  // 3 info columns
  const colW = (W - SIDE_PAD * 2) / 3;
  const col0 = SIDE_PAD;
  const col1 = SIDE_PAD + colW;
  const col2 = SIDE_PAD + colW * 2;

  const qty = `${a.quantity} ${a.quantity > 1 ? 'People' : 'Person'}`;
  const total = a.totalAmount != null ? `${a.currency} ${fmtAmount(a.totalAmount)}` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEIGHT}" viewBox="0 0 ${W} ${HEIGHT}" font-family="Inter, sans-serif">
  <defs>
    <clipPath id="ticket"><path d="${path}"/></clipPath>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.40"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
    <linearGradient id="heroFallback" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1F1F2E"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <pattern id="dashes" x="0" y="0" width="14" height="2" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="8" height="2" fill="${DASH}"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${HEIGHT}" fill="${PAGE_BG}"/>

  <g clip-path="url(#ticket)">
    <rect width="${W}" height="${HEIGHT}" fill="${PAPER}"/>

    <!-- HERO -->
    ${a.coverImageDataUrl ? '' : `<rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#heroFallback)"/>`}
    ${cover}
    <rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#heroGrad)"/>

    <!-- nuru wordmark + sun -->
    <text x="${logoX}" y="${logoBaselineY}" fill="#FFFFFF" font-size="${Math.round(22 * S * 0.85)}" font-weight="700" letter-spacing="-1">nuru</text>
    <circle cx="${logoX + 130}" cy="${logoBaselineY - 18}" r="9" fill="${ACCENT}"/>

    <!-- Class pill -->
    ${cls ? `
    <rect x="${clsPillX}" y="${clsPillY}" width="${clsPillW}" height="${clsPillH}" rx="10" fill="${cc}"/>
    <text x="${clsPillX + clsPillW / 2}" y="${clsPillY + clsPillH / 2 + 10}" text-anchor="middle"
          fill="#FFFFFF" font-size="26" font-weight="700" letter-spacing="4">${escapeXml(cls.toUpperCase())}</text>
    ` : ''}

    <!-- Event name + date line -->
    <text x="${SIDE_PAD}" y="${eventTitleY}" fill="#FFFFFF" font-size="${Math.round(19 * S)}" font-weight="700">${escapeXml((a.eventName || '').slice(0, 32))}</text>
    ${dateLine ? `<text x="${SIDE_PAD}" y="${dateLineY}" fill="#FFFFFF" fill-opacity="0.85" font-size="${Math.round(12.5 * S)}" font-weight="500">${escapeXml(dateLine)}</text>` : ''}

    <!-- QR card -->
    <rect x="${qrBoxX}" y="${qrBoxY}" width="${qrBoxSize}" height="${qrBoxSize}" rx="${Math.round(14 * S)}"
          fill="#FFFFFF" stroke="#EDEDF2" stroke-width="2"/>
    <image x="${qrBoxX + qrPad}" y="${qrBoxY + qrPad}" width="${qrSize}" height="${qrSize}" href="${a.qrPngDataUrl}"/>

    ${hasCode ? `
    <text x="${W / 2}" y="${codeY}" text-anchor="middle" fill="${SUB}"
          font-family="Space Mono, monospace" font-size="${Math.round(13 * S)}" font-weight="700" letter-spacing="4.4">${escapeXml(a.ticketCode)}</text>
    ` : ''}

    <!-- Status row -->
    <circle cx="${W / 2 - 90}" cy="${statusY - 6}" r="${isConfirmed ? 11 : 10}" fill="none" stroke="${statusColor}" stroke-width="3"/>
    ${isConfirmed
      ? `<path d="M ${W/2 - 96} ${statusY - 6} l 5 6 l 9 -10" fill="none" stroke="${statusColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<line x1="${W/2 - 90}" y1="${statusY - 12}" x2="${W/2 - 90}" y2="${statusY - 6}" stroke="${statusColor}" stroke-width="3" stroke-linecap="round"/><line x1="${W/2 - 90}" y1="${statusY - 6}" x2="${W/2 - 84}" y2="${statusY - 6}" stroke="${statusColor}" stroke-width="3" stroke-linecap="round"/>`}
    <text x="${W / 2 - 70}" y="${statusY}" fill="${statusColor}" font-size="28" font-weight="700">${escapeXml(statusLabel)}</text>
    <text x="${W / 2}" y="${statusSubY}" text-anchor="middle" fill="${TERTIARY}" font-size="22">${escapeXml(statusSub)}</text>

    <!-- Dashed divider 1 -->
    <rect x="${SIDE_PAD}" y="${dash1Y}" width="${W - SIDE_PAD * 2}" height="2" fill="url(#dashes)"/>

    <!-- Info row -->
    <text x="${col0}" y="${infoLabelY + 26}" fill="${TERTIARY}" font-size="20" font-weight="700" letter-spacing="3.4">TICKET FOR</text>
    <text x="${col0}" y="${infoValY + 12}" fill="${INK}" font-size="28" font-weight="700">${escapeXml(qty)}</text>

    ${cls ? `
    <text x="${col1}" y="${infoLabelY + 26}" fill="${TERTIARY}" font-size="20" font-weight="700" letter-spacing="3.4">ENTRY TYPE</text>
    <text x="${col1}" y="${infoValY + 12}" fill="${INK}" font-size="28" font-weight="700">${escapeXml(cls)}</text>
    ` : ''}

    ${total ? `
    <text x="${col2}" y="${infoLabelY + 26}" fill="${TERTIARY}" font-size="20" font-weight="700" letter-spacing="3.4">AMOUNT PAID</text>
    <text x="${col2}" y="${infoValY + 12}" fill="${INK}" font-size="28" font-weight="700">${escapeXml(total)}</text>
    ` : ''}

    <!-- Dashed divider 2 -->
    <rect x="${SIDE_PAD}" y="${dash2Y}" width="${W - SIDE_PAD * 2}" height="2" fill="url(#dashes)"/>

    ${a.location ? `
    <!-- Venue (with custom location pin) -->
    <g transform="translate(${SIDE_PAD}, ${venueLabelY})">
      <path d="M 14 4 C 8 4 4 8.5 4 14 c 0 7 10 18 10 18 s 10 -11 10 -18 c 0 -5.5 -4 -10 -10 -10 z M 14 18 a 4 4 0 1 1 0 -8 a 4 4 0 0 1 0 8 z" fill="${TERTIARY}"/>
      <g transform="translate(48, 0)">
        <text x="0" y="22" fill="${TERTIARY}" font-size="20" font-weight="700" letter-spacing="3.4">VENUE</text>
        <text x="0" y="${22 + 32}" fill="${INK}" font-size="${Math.round(13.5 * S)}" font-weight="600">${escapeXml(a.location.slice(0, 50))}</text>
      </g>
    </g>
    ` : ''}

    <!-- IMPORTANT block -->
    <g transform="translate(${SIDE_PAD}, ${impLabelY})">
      <circle cx="14" cy="14" r="11" fill="none" stroke="${TERTIARY}" stroke-width="2"/>
      <line x1="14" y1="9" x2="14" y2="9" stroke="${TERTIARY}" stroke-width="3" stroke-linecap="round"/>
      <line x1="14" y1="13" x2="14" y2="20" stroke="${TERTIARY}" stroke-width="3" stroke-linecap="round"/>
      <g transform="translate(48, 0)">
        <text x="0" y="22" fill="${TERTIARY}" font-size="20" font-weight="700" letter-spacing="3.4">IMPORTANT</text>
        <text x="0" y="${22 + 32}" fill="#374151" font-size="${Math.round(13 * S)}" font-weight="500">Please arrive early and present this ticket at the</text>
        <text x="0" y="${22 + 32 + 30}" fill="#374151" font-size="${Math.round(13 * S)}" font-weight="500">entrance. Non-transferable.</text>
      </g>
    </g>
  </g>

  <!-- Soft outline -->
  <path d="${path}" fill="none" stroke="#E5E7EB" stroke-width="2"/>
</svg>`;
}
