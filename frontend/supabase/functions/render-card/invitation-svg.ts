// Editorial invitation card — 1:1 mirror of the Flutter
// `invitation_qr_screen.dart::_editorialCard()` + `_ticketCard()` + `_heroBlock()`.
// Same perforated TicketShapeClipper geometry as the ticket: rounded top,
// side notches at hero bottom, scalloped bottom edge.
//
// Coordinate system: Flutter renders at ~390dp wide on phone. We render at
// 1080 px and apply a 2.77x scale (1080 / 390) so every Flutter dp maps
// directly to a px constant. Heights flow vertically the same way.

const W = 1080;
const S = 2.77;                 // dp -> px scale
const HERO_H = Math.round(190 * S);   // 526
const NOTCH_R = Math.round(12 * S);   // 33
const SCALLOP_R = Math.round(7 * S);  // 19
const CORNER_R = 24;

const PAPER = '#FDFAF3';
const INK = '#14110D';
const DASH = '#E5E7EB';

function escapeXml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function inkAlpha(a: number) {
  // INK = #14110D rgb(20,17,13). Apply alpha by emitting fill-opacity instead.
  return a;
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

const WK = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${WK[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(t?: string | null): string {
  if (!t) return '';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10) || 0;
  const m = parts[1].padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

interface BuildArgs {
  guestName: string;
  eventName: string;
  eventType?: string | null;
  hostLine?: string | null;       // organizer
  date?: string | null;           // ISO
  time?: string | null;           // HH:MM
  venue?: string | null;
  address?: string | null;
  dressCode?: string | null;
  rsvpCode?: string | null;
  accent?: string | null;         // theme color, defaults to gold
  coverImageDataUrl: string | null;
  qrPngDataUrl: string;
}

export function buildInvitationSvg(a: BuildArgs): string {
  const accent = a.accent || '#D4AF37';
  const eventType = (a.eventType || '').toUpperCase();
  const date = fmtDate(a.date) || '—';
  const time = fmtTime(a.time) || '—';
  const venue = (a.venue || '—');

  // Vertical cursor through the body — mirrors the Flutter Column gaps.
  // Hero ends at HERO_H. Body starts with 22dp gap, then greeting, etc.
  let y = HERO_H + Math.round(22 * S); // 526 + 61 = 587
  const cx = W / 2;

  // ── Greeting "You're Invited" (Great Vibes 36dp ≈ 100px)
  const greetingY = y + Math.round(36 * S * 0.75); // baseline approx
  y = greetingY + 18;

  // Ornament divider (gold rule + diamond + gold rule)
  const ornY = y + 8;
  const ornW = 280;
  const ornHalf = (ornW - 28) / 2;
  y = ornY + 30;

  // "DEAR" label (only if guest)
  const hasGuest = (a.guestName || '').trim().length > 0;
  let dearY = 0, nameY = 0;
  if (hasGuest) {
    dearY = y + 22;
    nameY = dearY + Math.round(26 * S * 0.55) + 8; // 26dp Playfair name
    y = nameY + 18;
  }

  // Dashed divider 1
  const dash1Y = y + Math.round(18 * S);
  y = dash1Y + Math.round(18 * S);

  // Info row (DATE / TIME / VENUE)
  const infoY = y + 22;
  const infoValY = infoY + 28;
  y = infoValY + 28;

  // Optional dress code pill
  let dressY = 0;
  if (a.dressCode) {
    dressY = y + Math.round(14 * S);
    y = dressY + 36;
  }

  // Dashed divider 2
  const dash2Y = y + Math.round(18 * S);
  y = dash2Y + Math.round(18 * S);

  // QR block (160dp = 443px box, with 12dp padding around)
  const qrSize = Math.round(160 * S); // 443
  const qrPad = Math.round(12 * S);   // 33
  const qrBoxSize = qrSize + qrPad * 2;
  const qrBoxX = cx - qrBoxSize / 2;
  const qrBoxY = y;
  y = qrBoxY + qrBoxSize + Math.round(10 * S);

  // SCAN TO CHECK IN label
  const scanY = y + 20;
  y = scanY + 8;

  // Invitation code (Space Mono)
  const hasCode = (a.rsvpCode || '').trim().length > 0;
  let codeY = 0;
  if (hasCode) {
    codeY = y + 26;
    y = codeY + 18;
  }

  // Hosted by line
  const hasHost = (a.hostLine || '').trim().length > 0;
  let hostY = 0;
  if (hasHost) {
    hostY = y + Math.round(14 * S);
    y = hostY + 24;
  }

  const bottomPad = Math.round(28 * S);
  const HEIGHT = y + bottomPad;

  const path = buildTicketPath(W, HEIGHT);

  // Hero pieces
  const cover = a.coverImageDataUrl
    ? `<image x="0" y="0" width="${W}" height="${HERO_H}" href="${a.coverImageDataUrl}" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  // Event type pill (top of bottom-left stack)
  const titleBaselineY = HERO_H - Math.round(18 * S);                  // bottom: 18dp
  const titleFontPx = Math.round(22 * S);                              // 60
  const typePillY = titleBaselineY - Math.round(22 * S) - titleFontPx + 6; // sits above title
  const typeText = eventType;
  const typePillW = typeText ? Math.max(120, typeText.length * 14 + 40) : 0;

  // INVITATION pill in hero top-right
  const invPillW = 240;
  const invPillH = Math.round(28 * S);
  const invPillX = W - Math.round(18 * S) - invPillW;
  const invPillY = Math.round(16 * S);

  // nuru wordmark top-left (text + tiny sun)
  const logoX = Math.round(18 * S);
  const logoY = Math.round(16 * S) + Math.round(22 * S * 0.7);

  // Info column x positions (3 equal columns within 22dp horizontal padding)
  const sidePad = Math.round(22 * S);
  const colW = (W - sidePad * 2) / 3;
  const col0 = sidePad + 8;
  const col1 = sidePad + colW + 8;
  const col2 = sidePad + colW * 2 + 8;

  // Dress code pill metrics
  const dressTxt = a.dressCode ? `DRESS CODE · ${a.dressCode.toUpperCase()}` : '';
  const dressW = dressTxt.length * 11 + 60;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEIGHT}" viewBox="0 0 ${W} ${HEIGHT}" font-family="Inter, sans-serif">
  <defs>
    <clipPath id="card"><path d="${path}"/></clipPath>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
    <linearGradient id="heroFallback" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#1F1F2E"/>
    </linearGradient>
    <pattern id="dashes" x="0" y="0" width="14" height="2" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="8" height="2" fill="${DASH}"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${HEIGHT}" fill="#F5F0E8"/>

  <g clip-path="url(#card)">
    <!-- Paper -->
    <rect width="${W}" height="${HEIGHT}" fill="${PAPER}"/>

    <!-- HERO -->
    ${a.coverImageDataUrl ? '' : `<rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#heroFallback)"/>`}
    ${cover}
    <rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#heroGrad)"/>

    <!-- nuru wordmark + sun -->
    <text x="${logoX}" y="${logoY}" fill="#FFFFFF" font-size="${Math.round(22 * S * 0.85)}" font-weight="700" letter-spacing="-1">nuru</text>
    <circle cx="${logoX + 130}" cy="${logoY - 18}" r="9" fill="${accent}"/>

    <!-- INVITATION pill (top-right) -->
    <rect x="${invPillX}" y="${invPillY}" width="${invPillW}" height="${invPillH}" rx="14" fill="${accent}"/>
    <text x="${invPillX + invPillW / 2}" y="${invPillY + invPillH / 2 + 11}" text-anchor="middle"
          fill="#FFFFFF" font-size="28" font-weight="800" letter-spacing="4.4">INVITATION</text>

    <!-- Event type pill (bottom-left, above title) -->
    ${typeText ? `
    <rect x="${sidePad}" y="${typePillY}" width="${typePillW}" height="${Math.round(20 * S)}" rx="100"
          fill="#FFFFFF" fill-opacity="0.18" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="1.6"/>
    <text x="${sidePad + typePillW / 2}" y="${typePillY + Math.round(20 * S) / 2 + 9}" text-anchor="middle"
          fill="#FFFFFF" font-size="25" font-weight="700" letter-spacing="6.6">${escapeXml(typeText)}</text>
    ` : ''}

    <!-- Event title (Playfair, white) -->
    <text x="${sidePad}" y="${titleBaselineY}" fill="#FFFFFF" font-family="Playfair Display, serif"
          font-size="${titleFontPx}" font-weight="700">${escapeXml((a.eventName || '').toUpperCase().slice(0, 28))}</text>

    <!-- BODY -->
    <!-- "You're Invited" greeting (Great Vibes script) -->
    <text x="${cx}" y="${greetingY}" text-anchor="middle" fill="${INK}"
          font-family="Great Vibes, cursive" font-size="${Math.round(36 * S)}" font-weight="400">You're Invited</text>

    <!-- Ornament divider -->
    <line x1="${cx - ornW / 2}" y1="${ornY}" x2="${cx - 14}" y2="${ornY}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>
    <rect x="${cx - 6}" y="${ornY - 6}" width="12" height="12" fill="${accent}" transform="rotate(45 ${cx} ${ornY})"/>
    <line x1="${cx + 14}" y1="${ornY}" x2="${cx + ornW / 2}" y2="${ornY}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>

    ${hasGuest ? `
    <text x="${cx}" y="${dearY}" text-anchor="middle" fill="${INK}" fill-opacity="0.55"
          font-size="22" font-weight="700" letter-spacing="9.7">DEAR</text>
    <text x="${cx}" y="${nameY + Math.round(26 * S * 0.55)}" text-anchor="middle" fill="${INK}"
          font-family="Playfair Display, serif" font-size="${Math.round(26 * S)}" font-weight="700">${escapeXml(a.guestName.slice(0, 36))}</text>
    ` : ''}

    <!-- Dashed divider 1 -->
    <rect x="${sidePad}" y="${dash1Y}" width="${W - sidePad * 2}" height="2" fill="url(#dashes)"/>

    <!-- Info row: DATE / TIME / VENUE -->
    <text x="${col0}" y="${infoY}" fill="${INK}" fill-opacity="0.5" font-size="22" font-weight="800" letter-spacing="3.9">DATE</text>
    <text x="${col0}" y="${infoValY + 14}" fill="${INK}" font-size="30" font-weight="700">${escapeXml(date)}</text>

    <text x="${col1}" y="${infoY}" fill="${INK}" fill-opacity="0.5" font-size="22" font-weight="800" letter-spacing="3.9">TIME</text>
    <text x="${col1}" y="${infoValY + 14}" fill="${INK}" font-size="30" font-weight="700">${escapeXml(time)}</text>

    <text x="${col2}" y="${infoY}" fill="${INK}" fill-opacity="0.5" font-size="22" font-weight="800" letter-spacing="3.9">VENUE</text>
    <text x="${col2}" y="${infoValY + 14}" fill="${INK}" font-size="30" font-weight="700">${escapeXml(venue.slice(0, 20))}</text>

    ${a.dressCode ? `
    <rect x="${cx - dressW / 2}" y="${dressY}" width="${dressW}" height="36" rx="100"
          fill="${accent}" fill-opacity="0.10" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.2"/>
    <text x="${cx}" y="${dressY + 24}" text-anchor="middle" fill="${accent}"
          font-size="20" font-weight="800" letter-spacing="5.5">${escapeXml(dressTxt)}</text>
    ` : ''}

    <!-- Dashed divider 2 -->
    <rect x="${sidePad}" y="${dash2Y}" width="${W - sidePad * 2}" height="2" fill="url(#dashes)"/>

    <!-- QR card -->
    <rect x="${qrBoxX}" y="${qrBoxY}" width="${qrBoxSize}" height="${qrBoxSize}" rx="${Math.round(14 * S)}"
          fill="#FFFFFF" stroke="#EDEDF2" stroke-width="2"/>
    <image x="${qrBoxX + qrPad}" y="${qrBoxY + qrPad}" width="${qrSize}" height="${qrSize}" href="${a.qrPngDataUrl}"/>

    <!-- SCAN TO CHECK IN (gold) -->
    <text x="${cx}" y="${scanY + Math.round(9.5 * S * 0.4)}" text-anchor="middle" fill="${accent}"
          font-size="${Math.round(9.5 * S)}" font-weight="800" letter-spacing="8.3">SCAN TO CHECK IN</text>

    ${hasCode ? `
    <text x="${cx}" y="${codeY + Math.round(12 * S * 0.4)}" text-anchor="middle" fill="${INK}" fill-opacity="0.55"
          font-family="Space Mono, monospace" font-size="${Math.round(12 * S)}" font-weight="700" letter-spacing="4.4">${escapeXml(a.rsvpCode!)}</text>
    ` : ''}

    ${hasHost ? `
    <text x="${cx}" y="${hostY + 18}" text-anchor="middle" font-size="22">
      <tspan fill="${INK}" fill-opacity="0.55" font-weight="400">Hosted by  </tspan><tspan fill="${INK}" fill-opacity="0.85" font-weight="800">${escapeXml(a.hostLine!)}</tspan>
    </text>
    ` : ''}
  </g>

  <!-- Soft outline -->
  <path d="${path}" fill="none" stroke="${INK}" stroke-opacity="0.06" stroke-width="2"/>
</svg>`;
}
