import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const API_BASE = Deno.env.get("NURU_API_BASE_URL");

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_VERIFY_TOKEN) {
    console.error("Missing WhatsApp environment variables");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);

  // ── GET: Meta Webhook Verification ──────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Incoming messages ─────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const from = message.from;
      const text = message.text?.body?.trim().toUpperCase() || "";
      const whatsAppName = value?.contacts?.[0]?.profile?.name || "Guest";

      console.log(`Message from ${from} (${whatsAppName}): ${text}`);

      // Single lookup to resolve guest identity from DB
      const lookup = await lookupGuest(from, API_BASE);
      const guestFullName = lookup?.guest_name || whatsAppName;
      const firstName = extractFirstName(guestFullName);
      const invitationCode = lookup?.code || null;

      let replyText = "";

      if (text === "YES" || text === "CONFIRM") {
        replyText = await handleRSVP(invitationCode, "confirmed", firstName, API_BASE);
      } else if (text === "NO" || text === "DECLINE") {
        replyText = await handleRSVP(invitationCode, "declined", firstName, API_BASE);
      } else if (text === "DETAILS" || text === "INFO") {
        replyText = await handleDetails(invitationCode, firstName, API_BASE);
      } else if (text === "HELP") {
        replyText =
          `👋 Hi ${firstName}! Here's how to use Nuru:\n\n` +
          `✅ *YES* or *CONFIRM* — Accept an invitation\n` +
          `❌ *NO* or *DECLINE* — Decline an invitation\n` +
          `ℹ️ *DETAILS* — Get event details\n` +
          `❓ *HELP* — Show this menu`;
      } else {
        replyText =
          `Hi ${firstName}! I didn't understand that.\n\n` +
          `Reply *HELP* to see available commands.`;
      }

      await sendWhatsAppMessage(from, replyText, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(JSON.stringify({ error: "Processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

// ── Title-aware first name extraction ─────────────────
// Preserves honorifics/titles as part of the first name.
// e.g. "Dr. John Okelo" → "Dr. John", "Frank Mushi" → "Frank"
const TITLE_PATTERN = /^((?:(?:Dr|Prof|Eng|Mr|Mrs|Ms|Miss|Mx|Hon|Rev|Pr|Sr|Jr|Capt|Col|Gen|Sgt|Cpl|Lt|Maj|Amb|Dkt|Mheshimiwa|Mwl|Sheikh|Imam|Bishop|Pastor|Father|Fr|Sister|Br|Brother|Dame|Sir|Lady|Lord|Chief|Justice|Judge|Adv|Advocate|Barrister|Solicitor|Atty|CPA|Arch|Comm|Comdr|Admiral|Cmdr|Brig|Pvt|Cdr|Gov|Pres|PM|VP|MP|Sen|Dip|Pharm|Nurse|Nrs|Doc|Dcn|Elder|Apostle|Prophet|Evangelist|Canon|Cardinal|Msgr|Monsignor|Abbess|Abbot|Prior|Prioress|Deacon|Vicar|Curate|Chaplain|Min|Mch)\.?\s+)+)(\S+)/i;

function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Guest";

  const match = trimmed.match(TITLE_PATTERN);
  if (match) {
    const title = match[1]?.trim() || "";
    const first = match[2] || "";
    return title ? `${title} ${first}` : first;
  }
  // No title found — just take the first word
  return trimmed.split(/\s+/)[0] || "Guest";
}

// ── Single lookup: resolve guest from DB ──────────────
interface LookupResult {
  code: string;
  event_id: string;
  guest_name: string;
}

async function lookupGuest(
  phone: string,
  apiBase: string | undefined
): Promise<LookupResult | null> {
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/rsvp/lookup?phone=${encodeURIComponent(phone)}`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as LookupResult;
    }
  } catch (e) {
    console.error("Lookup error:", e);
  }
  return null;
}

// ── RSVP handler (uses pre-resolved code & name) ──────
async function handleRSVP(
  code: string | null,
  status: "confirmed" | "declined",
  name: string,
  apiBase: string | undefined
): Promise<string> {
  if (!apiBase) return "Sorry, the service is temporarily unavailable.";

  if (!code) {
    return `Sorry ${name}, I couldn't find an invitation linked to your number. Please check with your event organizer.`;
  }

  try {
    const rsvpRes = await fetch(`${apiBase}/rsvp/${code}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: status }),
    });
    const rsvpJson = await rsvpRes.json();

    if (rsvpJson.success) {
      return status === "confirmed"
        ? `🎉 Great news ${name}! Your attendance has been confirmed. We look forward to seeing you!`
        : `Thank you ${name}. Your response has been recorded. We're sorry you won't be able to make it.`;
    }

    return rsvpJson.message || "Something went wrong processing your RSVP. Please try again.";
  } catch (e) {
    console.error("RSVP error:", e);
    return "Sorry, something went wrong. Please try again later.";
  }
}

// ── Details handler (uses pre-resolved code & name) ───
async function handleDetails(
  code: string | null,
  name: string,
  apiBase: string | undefined
): Promise<string> {
  if (!apiBase) return "Sorry, the service is temporarily unavailable.";

  if (!code) {
    return `Sorry ${name}, I couldn't find an invitation linked to your number.`;
  }

  try {
    const detailRes = await fetch(`${apiBase}/rsvp/${code}`);
    const detailJson = await detailRes.json();

    if (!detailJson.success || !detailJson.data) {
      return "Couldn't retrieve event details. Please try again.";
    }

    const event = detailJson.data.event;
    const inv = detailJson.data.invitation;

    let details = `📋 *${event.name}*\n\n`;
    if (event.start_date) details += `📅 Date: ${event.start_date}`;
    if (event.start_time) details += ` at ${event.start_time}`;
    details += "\n";
    if (event.location) details += `📍 Location: ${event.location}\n`;
    if (event.dress_code) details += `👔 Dress code: ${event.dress_code}\n`;
    if (event.special_instructions) details += `📝 Note: ${event.special_instructions}\n`;
    details += `\n🔖 Your RSVP: *${inv.rsvp_status}*`;

    return details;
  } catch (e) {
    console.error("Details error:", e);
    return "Sorry, something went wrong. Please try again later.";
  }
}

// ── Send WhatsApp message via Meta Cloud API ──────────
async function sendWhatsAppMessage(
  to: string,
  text: string,
  accessToken: string,
  phoneNumberId: string
) {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to send message to ${to}:`, err);
  }
}
