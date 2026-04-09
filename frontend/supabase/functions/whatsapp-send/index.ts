// No imports needed — uses built-in Deno.serve

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
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
      case "contribution_recorded":
        result = await sendTemplate(phone, "contribution_recorded", buildContributionRecordedComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "contribution_target":
        result = await sendTemplate(phone, "contribution_target", buildContributionTargetComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "thank_you_contribution":
        result = await sendTemplate(phone, "thank_you_contribution", buildThankYouComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "booking_notification":
        result = await sendTemplate(phone, "booking_notification", buildBookingNotificationComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "booking_accepted":
        result = await sendTemplate(phone, "booking_accepted", buildBookingAcceptedComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "otp_verification":
        result = await sendOtpTemplate(phone, params, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        if (result?.not_on_whatsapp) {
          return new Response(
            JSON.stringify({ success: false, not_on_whatsapp: true, error_code: result.error_code }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      case "check_whatsapp":
        result = await checkWhatsAppBySending(phone, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
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

// ── NEW: Contribution recorded template ──
// Template body: "Hello {{1}}, {{2}} has recorded your contribution of {{3}} for {{4}}. Target: {{5}} | Paid: {{6}} | Balance: {{7}}"
function buildContributionRecordedComponents(params: {
  contributor_name?: string; recorder_name?: string; amount?: string;
  event_name?: string; target?: string; total_paid?: string; balance?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.contributor_name || "Contributor" },
      { type: "text", text: params.recorder_name || "The organizer" },
      { type: "text", text: params.amount || "0" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.target || "N/A" },
      { type: "text", text: params.total_paid || "0" },
      { type: "text", text: params.balance || "0" },
    ],
  }];
}

// ── NEW: Contribution target set template ──
// Template body: "Hello {{1}}, your expected contribution for {{2}} is {{3}}. Paid so far: {{4}} | Still pending: {{5}}"
function buildContributionTargetComponents(params: {
  contributor_name?: string; event_name?: string; target?: string;
  total_paid?: string; balance?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.contributor_name || "Contributor" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.target || "0" },
      { type: "text", text: params.total_paid || "0" },
      { type: "text", text: params.balance || "0" },
    ],
  }];
}

// ── NEW: Thank you contribution template ──
// Template body: "Hello {{1}}, thank you for your contribution to {{2}}. {{3}}"
function buildThankYouComponents(params: {
  contributor_name?: string; event_name?: string; custom_message?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.contributor_name || "Contributor" },
      { type: "text", text: params.event_name || "an event" },
      { type: "text", text: params.custom_message || "We appreciate your support!" },
    ],
  }];
}

// ── NEW: Booking notification template ──
// Template body: "Hello {{1}}, {{2}} has booked your service for {{3}}. Open Nuru to see the details."
function buildBookingNotificationComponents(params: {
  provider_name?: string; client_name?: string; event_name?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.provider_name || "Provider" },
      { type: "text", text: params.client_name || "A client" },
      { type: "text", text: params.event_name || "an event" },
    ],
  }];
}

// ── NEW: Booking accepted template ──
// Template body: "Hello {{1}}, {{2}} has confirmed your booking for {{3}} at {{4}}. Open Nuru to see the details."
function buildBookingAcceptedComponents(params: {
  client_name?: string; vendor_name?: string; service_name?: string; event_name?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.client_name || "Client" },
      { type: "text", text: params.vendor_name || "The vendor" },
      { type: "text", text: params.service_name || "a service" },
      { type: "text", text: params.event_name || "an event" },
    ],
  }];
}

// ── OTP verification template (authentication with Copy Code button) ──
function buildOtpComponents(params: { otp_code?: string }) {
  const code = params.otp_code || "000000";
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: code },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: code },
      ],
    },
  ];
}

// ── Send OTP template ─────────────────────────────────
async function sendOtpTemplate(
  phone: string,
  params: { otp_code?: string },
  accessToken: string,
  phoneNumberId: string,
) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const code = params.otp_code || "000000";

  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: code }],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    },
  ];

  console.log(`[WhatsApp OTP] Sending to ${phone}`);

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
        name: "otp_verification",
        language: { code: "en" },
        components,
      },
    }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log(`[WhatsApp OTP] Sent! Message ID: ${data.messages?.[0]?.id}`);
    return { sent: true, message_id: data.messages?.[0]?.id };
  }

  const errorCode = data?.error?.code;

  if (errorCode === 131026 || errorCode === 131047) {
    console.log(`[WhatsApp OTP] Number ${phone} not on WhatsApp (error ${errorCode})`);
    return { sent: false, not_on_whatsapp: true, error_code: errorCode };
  }

  console.error(`[WhatsApp OTP] Error [${res.status}]:`, JSON.stringify(data));
  throw new Error(`WhatsApp OTP API failed [${res.status}]: ${JSON.stringify(data)}`);
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
  const languageCode = "en";

  console.log(`[WhatsApp] Sending template "${templateName}" to ${phone} with language "${languageCode}"`);

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
        language: { code: languageCode },
        components,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorCode = data?.error?.code;
    const errorSubCode = data?.error?.error_subcode;
    console.error(`WhatsApp template API error [${res.status}]:`, JSON.stringify(data));
    
    if (errorCode === 131026 || errorSubCode === 131026 || errorCode === 131047) {
      return { sent: false, not_on_whatsapp: true, error_code: errorCode };
    }
    
    throw new Error(`WhatsApp template API failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return { sent: true, message_id: data.messages?.[0]?.id };
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

// ── Check WhatsApp by attempting a send ───────────────
async function checkWhatsAppBySending(
  phone: string,
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
        name: "hello_world",
        language: { code: "en_US" },
      },
    }),
  });

  const data = await res.json();

  if (res.ok) {
    return { is_whatsapp: true, wa_id: data.contacts?.[0]?.wa_id || phone };
  }

  const errorCode = data?.error?.code;
  if (errorCode === 131026 || errorCode === 131047) {
    return { is_whatsapp: false, wa_id: null };
  }

  console.log(`[WhatsApp Check] Send-check returned error ${errorCode}: ${data?.error?.message}`);
  return { is_whatsapp: "unknown", wa_id: null, error: data?.error?.message };
}
