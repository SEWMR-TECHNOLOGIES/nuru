import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(
      JSON.stringify({ error: "WhatsApp not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, phone, params } = body;

    if (!action || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing action or phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;

    switch (action) {
      case "invite":
        result = await sendInvitation(phone, params, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "event_update":
        result = await sendEventUpdate(phone, params, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "reminder":
        result = await sendReminder(phone, params, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "text":
        result = await sendTextMessage(phone, params?.message || "", WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp send error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Send RSVP Invitation ──────────────────────────────
async function sendInvitation(
  phone: string,
  params: { guest_name: string; event_name: string; event_date?: string; organizer_name?: string; rsvp_code?: string },
  token: string,
  phoneId: string
) {
  let message = `🎉 *You're Invited!*\n\nHello ${params.guest_name}, you have been invited to *${params.event_name}*`;
  if (params.event_date) message += ` on ${params.event_date}`;
  if (params.organizer_name) message += ` by ${params.organizer_name}`;
  message += ".\n\n";

  if (params.rsvp_code) {
    message += `✅ Confirm: Reply *YES*\n❌ Decline: Reply *NO*\nℹ️ Details: Reply *DETAILS*\n\n`;
    message += `Or RSVP online: https://nuru.tz/rsvp/${params.rsvp_code}`;
  } else {
    message += "Open the Nuru app for details.";
  }

  message += "\n\n— Nuru: Plan Smarter";

  return await sendWhatsApp(phone, message, token, phoneId);
}

// ── Send Event Update ─────────────────────────────────
async function sendEventUpdate(
  phone: string,
  params: { guest_name: string; event_name: string; changes: string },
  token: string,
  phoneId: string
) {
  let message = `📢 *Event Update*\n\nHello ${params.guest_name}, there's been an update to *${params.event_name}*:\n\n`;
  message += params.changes;
  message += "\n\nReply *DETAILS* for full event info.";
  message += "\n\n— Nuru: Plan Smarter";

  return await sendWhatsApp(phone, message, token, phoneId);
}

// ── Send Reminder ─────────────────────────────────────
async function sendReminder(
  phone: string,
  params: { guest_name: string; event_name: string; event_date?: string; event_time?: string; location?: string },
  token: string,
  phoneId: string
) {
  let message = `⏰ *Event Reminder*\n\nHello ${params.guest_name}, just a reminder about *${params.event_name}*`;
  if (params.event_date) message += `\n📅 ${params.event_date}`;
  if (params.event_time) message += ` at ${params.event_time}`;
  if (params.location) message += `\n📍 ${params.location}`;
  message += "\n\nWe look forward to seeing you!";
  message += "\n\n— Nuru: Plan Smarter";

  return await sendWhatsApp(phone, message, token, phoneId);
}

// ── Send plain text ───────────────────────────────────
async function sendTextMessage(phone: string, text: string, token: string, phoneId: string) {
  return await sendWhatsApp(phone, text, token, phoneId);
}

// ── Core WhatsApp sender ──────────────────────────────
async function sendWhatsApp(to: string, text: string, accessToken: string, phoneNumberId: string) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;

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

  const data = await res.json();

  if (!res.ok) {
    console.error(`WhatsApp API error [${res.status}]:`, JSON.stringify(data));
    throw new Error(`WhatsApp API failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return { message_id: data.messages?.[0]?.id };
}
