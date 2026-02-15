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

      // Meta sends a specific structure
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) {
        // Likely a status update, acknowledge it
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const from = message.from; // sender phone number
      const text = message.text?.body?.trim().toUpperCase() || "";
      const contactName = value?.contacts?.[0]?.profile?.name || "Guest";

      console.log(`Message from ${from} (${contactName}): ${text}`);

      let replyText = "";

      // ── Keyword routing ───────────────────────────
      if (text === "YES" || text === "CONFIRM") {
        replyText = await handleRSVP(from, "confirmed", contactName, API_BASE);
      } else if (text === "NO" || text === "DECLINE") {
        replyText = await handleRSVP(from, "declined", contactName, API_BASE);
      } else if (text === "DETAILS" || text === "INFO") {
        replyText = await handleDetails(from, API_BASE);
      } else if (text === "HELP") {
        replyText =
          `👋 Hi ${contactName}! Here's how to use Nuru:\n\n` +
          `✅ *YES* or *CONFIRM* — Accept an invitation\n` +
          `❌ *NO* or *DECLINE* — Decline an invitation\n` +
          `ℹ️ *DETAILS* — Get event details\n` +
          `❓ *HELP* — Show this menu`;
      } else {
        replyText =
          `Hi ${contactName}! I didn't understand that.\n\n` +
          `Reply *HELP* to see available commands.`;
      }

      // ── Send reply ────────────────────────────────
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

// ── RSVP handler ──────────────────────────────────────
async function handleRSVP(
  phone: string,
  status: "confirmed" | "declined",
  name: string,
  apiBase: string | undefined
): Promise<string> {
  if (!apiBase) return "Sorry, the service is temporarily unavailable.";

  try {
    // Look up invitation by phone number
    const lookupRes = await fetch(`${apiBase}/rsvp/lookup?phone=${encodeURIComponent(phone)}`);
    const lookupJson = await lookupRes.json();

    if (!lookupJson.success || !lookupJson.data?.code) {
      return `Sorry ${name}, I couldn't find an invitation linked to your number. Please check with your event organizer.`;
    }

    const code = lookupJson.data.code;
    // Use the guest name from the invitation, not the WhatsApp profile name
    const guestName = lookupJson.data.guest_name || name;

    // Submit RSVP
    const rsvpRes = await fetch(`${apiBase}/rsvp/${code}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: status }),
    });
    const rsvpJson = await rsvpRes.json();

    if (rsvpJson.success) {
      return status === "confirmed"
        ? `🎉 Great news ${guestName}! Your attendance has been confirmed. We look forward to seeing you!`
        : `Thank you ${guestName}. Your response has been recorded. We're sorry you won't be able to make it.`;
    }

    return rsvpJson.message || "Something went wrong processing your RSVP. Please try again.";
  } catch (e) {
    console.error("RSVP error:", e);
    return "Sorry, something went wrong. Please try again later.";
  }
}

// ── Details handler ───────────────────────────────────
async function handleDetails(phone: string, apiBase: string | undefined): Promise<string> {
  if (!apiBase) return "Sorry, the service is temporarily unavailable.";

  try {
    const lookupRes = await fetch(`${apiBase}/rsvp/lookup?phone=${encodeURIComponent(phone)}`);
    const lookupJson = await lookupRes.json();

    if (!lookupJson.success || !lookupJson.data?.code) {
      return "I couldn't find an invitation linked to your number.";
    }

    const code = lookupJson.data.code;
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
