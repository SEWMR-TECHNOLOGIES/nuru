// render-card edge function
// Renders an invitation card or a ticket as a PNG, uploads it to the
// 'invitation-media' Supabase Storage bucket and returns its public URL.
//
// Body:
//   { kind: "invitation", event_id, guest_name, guest_id?, qr_value?, second_name?, force? }
//   { kind: "ticket",     event_id, ticket_code, ticket_data?, force? }
//
// `ticket_data` is the same shape the mobile YourTicketScreen consumes.
// If omitted, the function will fetch from FastAPI (NURU_API_BASE_URL).

import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';

// Initialise the WASM module once per worker
let wasmReady: Promise<unknown> | null = null;
async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const resp = await fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
      const bytes = new Uint8Array(await resp.arrayBuffer());
      await initWasm(bytes);
    })();
  }
  return wasmReady;
}

// Cache font buffers for the worker lifetime so resvg-wasm can rasterize text.
// Without these buffers (and with loadSystemFonts:false), <text> renders blank.
const FONT_URLS = [
  // Inter (sans) — regular, semibold, bold, extrabold
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-800-normal.ttf',
  // Playfair Display (serif) — for big titles + names
  'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf',
  // Great Vibes (script) — editorial "You're Invited" greeting
  'https://cdn.jsdelivr.net/fontsource/fonts/great-vibes@latest/latin-400-normal.ttf',
  // Space Mono — invitation/ticket code
  'https://cdn.jsdelivr.net/fontsource/fonts/space-mono@latest/latin-700-normal.ttf',
];
let fontBuffersPromise: Promise<Uint8Array[]> | null = null;
async function loadFontBuffers(): Promise<Uint8Array[]> {
  if (!fontBuffersPromise) {
    fontBuffersPromise = Promise.all(
      FONT_URLS.map(async (u) => {
        try {
          const r = await fetch(u);
          if (!r.ok) throw new Error(`font ${u} -> ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        } catch (e) {
          console.error('[render-card] font load failed', u, e);
          return new Uint8Array(0);
        }
      }),
    ).then((bufs) => bufs.filter((b) => b.byteLength > 0));
  }
  return fontBuffersPromise;
}
import QRCode from 'npm:qrcode@1.5.4';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildTicketSvg } from './ticket-svg.ts';
import { buildInvitationSvg } from './invitation-svg.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NURU_API = Deno.env.get('NURU_API_BASE_URL') || '';
const BUCKET = 'invitation-media';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ────────────────────────── helpers ──────────────────────────

// (Invitation cards and tickets are now built inline by buildInvitationSvg /
// buildTicketSvg — no external template SVG fetches needed.)

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function qrPngDataUrl(value: string, size = 480, dark = '#111111', light = '#FFFFFF'): Promise<string> {
  return await QRCode.toDataURL(value, {
    width: size,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark, light },
  });
}

async function rasterize(svg: string, width = 1080): Promise<Uint8Array> {
  await ensureWasm();
  const fontBuffers = await loadFontBuffers();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'white',
    font: {
      loadSystemFonts: false,
      fontBuffers,
      defaultFontFamily: 'Inter',
      serifFamily: 'Playfair Display',
      sansSerifFamily: 'Inter',
    },
  });
  return r.render().asPng();
}

async function uploadPng(path: string, png: Uint8Array): Promise<string> {
  const { error } = await admin.storage.from(BUCKET).upload(path, png, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function fetchEvent(eventId: string): Promise<any | null> {
  if (!NURU_API) return null;
  try {
    const r = await fetch(`${NURU_API.replace(/\/$/, '')}/api/events/${eventId}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data ?? j;
  } catch { return null; }
}

async function fetchTicket(ticketCode: string): Promise<any | null> {
  if (!NURU_API) return null;
  try {
    const r = await fetch(`${NURU_API.replace(/\/$/, '')}/api/tickets/by-code/${ticketCode}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data ?? j;
  } catch { return null; }
}

// ────────────────────────── handlers ──────────────────────────

// Cache the Nuru logo as a data URL across invocations.
const NURU_LOGO_URL = 'https://nuru.lovable.app/nuru-logo.png';
let logoPromise: Promise<string | null> | null = null;
async function nuruLogoDataUrl(): Promise<string | null> {
  if (!logoPromise) logoPromise = fetchAsDataUrl(NURU_LOGO_URL);
  return logoPromise;
}

async function renderInvitation(body: any): Promise<Response> {
  const { event_id, guest_name, guest_id, qr_value } = body;
  if (!event_id || !guest_name) {
    return json({ error: 'event_id and guest_name are required' }, 400);
  }

  const event = await fetchEvent(event_id);
  const content = event?.invitation_content || {};
  const eventTitle = event?.name || event?.title || body.event_name || 'Our Event';
  const eventType = typeof event?.event_type === 'string' ? event.event_type : event?.event_type?.name;
  const organizerName = event?.organizer_name || event?.organizer?.name || body.host_line || null;

  const coverUrl = event?.cover_image || event?.cover_image_url || body.cover_image || '';
  const [cover, logo] = await Promise.all([
    coverUrl ? fetchAsDataUrl(coverUrl) : Promise.resolve(null),
    nuruLogoDataUrl(),
  ]);

  const qrVal = qr_value || guest_id || `${event_id}:${guest_name}`;
  const qrPng = await qrPngDataUrl(qrVal, 512, '#111111', '#FFFFFF');

  const svg = buildInvitationSvg({
    guestName: guest_name,
    eventName: eventTitle,
    eventType: eventType || body.event_type || null,
    hostLine: content.host_line || organizerName,
    date: body.date || event?.start_date || null,
    time: body.time || event?.start_time || null,
    venue: body.venue || event?.venue || event?.location || null,
    address: body.address || event?.venue_address || event?.address || null,
    dressCode: content.dress_code || event?.dress_code || body.dress_code || null,
    rsvpCode: ((body.invitation_code || guest_id || qrVal) || '').toString().slice(0, 12).toUpperCase(),
    accent: event?.theme_color || body.accent || '#D4AF37',
    coverImageDataUrl: cover,
    qrPngDataUrl: qrPng,
    logoDataUrl: logo,
  });

  const png = await rasterize(svg, 1080);
  const objectPath = `cards/${event_id}/${guest_id || guest_name.replace(/\s+/g, '_')}.png`;
  const url = await uploadPng(objectPath, png);
  return json({ url, path: objectPath, kind: 'invitation' });
}

async function renderTicket(body: any): Promise<Response> {
  const { event_id, ticket_code, ticket_data, force } = body;
  if (!event_id || !ticket_code) {
    return json({ error: 'event_id and ticket_code are required' }, 400);
  }

  const data = ticket_data || (await fetchTicket(ticket_code)) || {};
  const event = data.event || (await fetchEvent(event_id)) || {};
  const eventTitle = event.name || event.title || data.event_name || data.event_title || data.ticket_class_name || 'Event';

  const coverUrl = event.cover_image || event.cover_image_url || event.event_cover || data.cover_image || data.event_cover || '';
  const cover = coverUrl ? await fetchAsDataUrl(coverUrl) : null;

  const qrPng = await qrPngDataUrl(ticket_code, 480, '#111111', '#FFFFFF');

  const svg = buildTicketSvg({
    eventName: eventTitle,
    ticketCode: ticket_code,
    ticketClass: data.ticket_class_name || data.ticket_class || 'General',
    status: data.status || 'pending',
    location: event.location || event.event_location || data.event_location || '',
    coverImageDataUrl: cover,
    date: event.start_date || data.event_date || null,
    time: event.start_time || data.event_time || null,
    quantity: typeof data.quantity === 'number' ? data.quantity : 1,
    currency: data.currency || 'TZS',
    totalAmount: data.total_amount != null ? Number(data.total_amount) : null,
    organizerName: event.organizer_name || '',
    qrPngDataUrl: qrPng,
  });

  const png = await rasterize(svg, 1080);
  const objectPath = `tickets/${event_id}/${ticket_code}.png`;
  const url = await uploadPng(objectPath, png);
  return json({ url, path: objectPath, kind: 'ticket' });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const kind = body?.kind;
    if (kind === 'invitation') return await renderInvitation(body);
    if (kind === 'ticket') return await renderTicket(body);
    return json({ error: 'kind must be "invitation" or "ticket"' }, 400);
  } catch (e) {
    console.error('[render-card]', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
