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
        result = await sendTemplate(phone, "event_invitation_v2", buildInviteTemplateWithButtons(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "event_update":
        result = await sendTemplate(phone, "event_update", buildEventUpdateComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "reminder":
        result = await sendTemplate(phone, "event_reminder", buildReminderComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "expense_recorded":
        result = await sendTemplate(phone, "expense_recorded", buildExpenseComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "otp_verification":
        result = await sendTemplate(phone, "otp_verification", buildOtpComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        // If the send returned not_on_whatsapp, pass it through without success=true
        if (result?.not_on_whatsapp) {
          return new Response(
            JSON.stringify({ success: false, not_on_whatsapp: true, error_code: result.error_code }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      case "check_whatsapp":
        result = await checkWhatsAppNumber(phone, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
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

// ── Template component builders ───────────────────────

function buildInviteComponents(params: {
  guest_name?: string; event_name?: string; event_date?: string;
  organizer_name?: string; rsvp_code?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.guest_name || "Guest" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.event_date || "TBA" },
      { type: "text", text: params.organizer_name || "the organizer" },
      { type: "text", text: params.rsvp_code ? `https://nuru.tz/rsvp/${params.rsvp_code}` : "https://nuru.tz" },
    ],
  }];
}

// Template with quick-reply buttons for invitations (used outside 24h window)
function buildInviteTemplateWithButtons(params: {
  guest_name?: string; event_name?: string; event_date?: string;
  organizer_name?: string; rsvp_code?: string;
}) {
  const rsvpCode = params.rsvp_code || "";
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.guest_name || "Guest" },
        { type: "text", text: params.event_name || "an event" },
        { type: "text", text: params.event_date || "TBA" },
        { type: "text", text: params.organizer_name || "the organizer" },
      ],
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [{ type: "payload", payload: `rsvp_confirm_${rsvpCode}` }],
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "1",
      parameters: [{ type: "payload", payload: `rsvp_decline_${rsvpCode}` }],
    },
  ];
}

function buildEventUpdateComponents(params: {
  guest_name?: string; event_name?: string; changes?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.guest_name || "Guest" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.changes || "Details updated" },
    ],
  }];
}

function buildReminderComponents(params: {
  guest_name?: string; event_name?: string; event_date?: string;
  event_time?: string; location?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.guest_name || "Guest" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.event_date || "TBA" },
      { type: "text", text: params.event_time || "TBA" },
      { type: "text", text: params.location || "TBA" },
    ],
  }];
}

function buildExpenseComponents(params: {
  recipient_name?: string; recorder_name?: string; amount?: string;
  category?: string; event_name?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.recipient_name || "Member" },
      { type: "text", text: params.recorder_name || "A member" },
      { type: "text", text: params.amount || "an amount" },
      { type: "text", text: params.category || "General" },
      { type: "text", text: params.event_name || "an event" },
    ],
  }];
}

// ── OTP verification template ─────────────────────────
// Template body: "Your Nuru verification code is {{1}}. This code expires in 10 minutes. Do not share it with anyone."
function buildOtpComponents(params: { otp_code?: string }) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.otp_code || "000000" },
    ],
  }];
}

// ── Send approved template ────────────────────────────
async function sendTemplate(
  phone: string,
  templateName: string,
  components: Array<Record<string, unknown>>,
  accessToken: string,
  phoneNumberId: string
) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorCode = data?.error?.code;
    const errorSubCode = data?.error?.error_subcode;
    console.error(`WhatsApp template API error [${res.status}]:`, JSON.stringify(data));
    
    // Error 131026 = "Message Undeliverable" — recipient not on WhatsApp
    // Error 131047 = "Re-engagement message" — number not on WhatsApp or hasn't messaged
    if (errorCode === 131026 || errorSubCode === 131026 || errorCode === 131047) {
      return { sent: false, not_on_whatsapp: true, error_code: errorCode };
    }
    
    throw new Error(`WhatsApp template API failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return { sent: true, message_id: data.messages?.[0]?.id };
}

// ── Send interactive invite with Confirm / Decline buttons ──
async function sendInteractiveInvite(
  phone: string,
  params: {
    guest_name?: string; event_name?: string; event_date?: string;
    organizer_name?: string; rsvp_code?: string;
  },
  accessToken: string,
  phoneNumberId: string
) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const guestName = params.guest_name || "Guest";
  const eventName = params.event_name || "an event";
  const eventDate = params.event_date || "TBA";
  const organizer = params.organizer_name || "the organizer";
  const rsvpCode = params.rsvp_code || "";

  const bodyText =
    `Hi ${guestName}! 🎉\n\n` +
    `You're invited to *${eventName}*\n` +
    `📅 ${eventDate}\n` +
    `🎩 Hosted by ${organizer}\n\n` +
    `Please confirm your attendance below:`;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: `rsvp_confirm_${rsvpCode}`, title: "Confirm" },
          },
          {
            type: "reply",
            reply: { id: `rsvp_decline_${rsvpCode}`, title: "Decline" },
          },
        ],
      },
    },
  };

  // Add footer with RSVP link if code exists
  if (rsvpCode) {
    (payload.interactive as Record<string, unknown>).footer = {
      text: `Or visit: nuru.tz/rsvp/${rsvpCode}`,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`WhatsApp interactive API error [${res.status}]:`, JSON.stringify(data));
    throw new Error(`WhatsApp interactive API failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return { message_id: data.messages?.[0]?.id };
}

// ── Send plain text (fallback) ────────────────────────
async function sendTextMessage(phone: string, text: string, token: string, phoneId: string) {
  const url = `${GRAPH_API}/${phoneId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
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

// ── Check if a phone number is registered on WhatsApp ──
// The Cloud API does NOT have a /contacts endpoint (that was On-Premises only).
// Instead, we attempt a lightweight "contacts" validation by trying to send a
// dummy status-read. But the most reliable approach is to just try sending
// the actual template. This function now tries the Cloud API contacts endpoint
// first (it works on some WABA accounts), and if that fails, returns "unknown"
// so the caller can attempt a direct send.
async function checkWhatsAppNumber(
  phone: string,
  accessToken: string,
  phoneNumberId: string
) {
  // Method 1: Try the contacts endpoint (works for some BSP/On-Prem setups)
  try {
    const url = `${GRAPH_API}/${phoneNumberId}/contacts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blocking: "wait",
        contacts: [`+${phone}`],
        force_check: true,
      }),
    });

    const data = await res.json();

    if (res.ok && data.contacts?.length > 0) {
      const isValid = data.contacts[0]?.status === "valid";
      return { is_whatsapp: isValid, wa_id: data.contacts[0]?.wa_id || null };
    }

    // If the endpoint doesn't exist (404) or returns an error,
    // return unknown so the caller can try sending directly
    console.log(`[WhatsApp Check] Contacts endpoint returned ${res.status}, falling back to unknown. Response: ${JSON.stringify(data).slice(0, 300)}`);
  } catch (e) {
    console.log(`[WhatsApp Check] Contacts endpoint error: ${e}`);
  }

  // Return unknown - the caller should try sending directly
  return { is_whatsapp: "unknown", wa_id: null };
}
