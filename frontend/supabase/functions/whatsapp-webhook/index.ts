// WhatsApp Webhook Edge Function
// ==============================
// Receives ALL inbound events from Meta's WhatsApp Cloud API:
//   • GET  → webhook verification handshake (hub.challenge)
//   • POST → message + status callbacks (interactive button replies,
//            free-text messages, delivery statuses)
//
// Quick-reply payloads sent by whatsapp-send/index.ts use the shape
//   rsvp_confirm_{rsvpCode}
//   rsvp_maybe_{rsvpCode}
//   rsvp_decline_{rsvpCode}
// We parse them here and POST to the FastAPI backend's existing
// public RSVP responder: {NURU_API_BASE_URL}/rsvp/{code}/respond
// — the same endpoint /rsvp/:code uses successfully.
//
// Meta REQUIRES a 200 response within ~15s or it retries. We therefore
// ack immediately and do best-effort downstream work; downstream errors
// are logged but never propagate to Meta.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
// Normalize the base URL: strip trailing slash AND ensure it ends with /api/v1
// (the NURU_API_BASE_URL secret is set without the version prefix, which caused
// /rsvp/{code}/respond to 404 — the real endpoint lives under /api/v1).
const RAW_API_BASE = (Deno.env.get("NURU_API_BASE_URL") || "https://nuruapi.nuru.tz")
  .replace(/\/$/, "")
  .replace(/\/(api\/v\d+|v\d+\/api|api|v\d+)$/i, "");
const NURU_API_BASE_URL = `${RAW_API_BASE}/api/v1`;

// Map a Meta quick-reply payload to (rsvp_status, rsvp_code).
// Returns null when the payload isn't an RSVP button.
function parseRsvpPayload(payload: string): { status: string; code: string } | null {
  if (!payload) return null;
  const m = payload.match(/^rsvp_(confirm|maybe|decline)_(.+)$/i);
  if (!m) return null;
  const action = m[1].toLowerCase();
  const code = m[2].trim();
  if (!code) return null;
  const status =
    action === "confirm" ? "confirmed" : action === "decline" ? "declined" : "maybe";
  return { status, code };
}

async function postRsvp(code: string, status: string, from?: string) {
  const url = `${NURU_API_BASE_URL}/rsvp/${encodeURIComponent(code)}/respond`;
  console.log(`[whatsapp-webhook] POST ${url} (RAW_API_BASE=${RAW_API_BASE})`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rsvp_status: status,
        source: "whatsapp_button",
        whatsapp_from: from || null,
      }),
    });
    const text = await res.text();
    console.log(
      `[whatsapp-webhook] RSVP ${status} code=${code} from=${from || "?"} -> ${res.status} ${text.slice(0, 300)}`,
    );
    return res.ok;
  } catch (err) {
    console.error(`[whatsapp-webhook] RSVP post failed code=${code}:`, err);
    return false;
  }
}

async function postBackend(path: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${NURU_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[whatsapp-webhook] backend ${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[whatsapp-webhook] backend ${path} failed:`, err);
  }
}

async function handlePost(req: Request): Promise<Response> {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    console.warn("[whatsapp-webhook] non-JSON POST body ignored");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Meta envelope: { object, entry: [{ changes: [{ value: { messages?, statuses? } }] }] }
  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};

      // 1) Inbound messages (button taps + free text)
      const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const from = msg?.from;
        try {
          // Interactive button reply (template quick_reply buttons)
          if (msg?.type === "interactive" && msg?.interactive?.type === "button_reply") {
            const payload = msg.interactive.button_reply?.id || "";
            const rsvp = parseRsvpPayload(payload);
            if (rsvp) {
              await postRsvp(rsvp.code, rsvp.status, from);
              continue;
            }
            console.log(`[whatsapp-webhook] unhandled button_reply payload=${payload} from=${from}`);
            continue;
          }

          // Legacy "button" message type (some template flows surface here)
          if (msg?.type === "button") {
            const payload = msg.button?.payload || msg.button?.text || "";
            const rsvp = parseRsvpPayload(payload);
            if (rsvp) {
              await postRsvp(rsvp.code, rsvp.status, from);
              continue;
            }
            console.log(`[whatsapp-webhook] unhandled button payload=${payload} from=${from}`);
            continue;
          }

          // Free-text reply — currently just logged; admin chat / keyword
          // handling lives on the FastAPI backend.
          if (msg?.type === "text") {
            await postBackend("/whatsapp/incoming", {
              phone: from,
              content: msg.text?.body || "",
              wa_message_id: msg?.id || null,
              contact_name: value?.contacts?.[0]?.profile?.name || "",
            });
            console.log(
              `[whatsapp-webhook] text from=${from} body=${(msg.text?.body || "").slice(0, 200)}`,
            );
            continue;
          }

          console.log(`[whatsapp-webhook] unhandled message type=${msg?.type} from=${from}`);
        } catch (err) {
          console.error("[whatsapp-webhook] message handler error:", err);
        }
      }

      // 2) Delivery statuses (sent/delivered/read/failed) — log only.
      const statuses: any[] = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        await postBackend("/whatsapp/status-update", {
          wa_message_id: st?.id || null,
          status: st?.status || null,
          recipient_phone: st?.recipient_id || null,
          errors: st?.errors || null,
        });
        console.log(
          `[whatsapp-webhook] status id=${st?.id} status=${st?.status} recipient=${st?.recipient_id} err=${JSON.stringify(st?.errors || null)}`,
        );
      }
    }
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
}

function handleVerify(url: URL): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log("[whatsapp-webhook] verification OK");
    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
  console.warn(
    `[whatsapp-webhook] verification FAILED mode=${mode} token_match=${token === VERIFY_TOKEN}`,
  );
  return new Response("forbidden", { status: 403, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = new URL(req.url);
  if (req.method === "GET") return handleVerify(url);
  if (req.method === "POST") return handlePost(req);
  return new Response("method not allowed", { status: 405, headers: corsHeaders });
});
