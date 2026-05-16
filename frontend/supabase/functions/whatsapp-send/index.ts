// WhatsApp Send Edge Function — uses built-in Deno.serve

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
      case "meeting_invitation":
        console.log(`[WhatsApp] Meeting invitation params:`, JSON.stringify(params));
        result = await sendTemplate(phone, "meeting_invitation", buildMeetingInvitationComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, "en_US");
        console.log(`[WhatsApp] Meeting invitation result:`, JSON.stringify(result));
        break;
      case "text":
        result = await sendTextMessage(phone, params?.message || "", WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
        break;
      case "fundraise_attend": {
        const lang = (params?.lang || "en").toLowerCase() === "sw" ? "sw" : "en";
        const tplName = lang === "sw" ? "nuru_fundraise_notice_sw" : "nuru_fundraise_notice_en";
        result = await sendTemplate(phone, tplName, buildFundraiseAttendComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, lang);
        break;
      }
      case "pledge_remind": {
        const lang = (params?.lang || "en").toLowerCase() === "sw" ? "sw" : "en";
        const tplName = lang === "sw" ? "nuru_pledge_remind_sw" : "nuru_pledge_remind_en";
        result = await sendTemplate(phone, tplName, buildPledgeRemindComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, lang);
        break;
      }
      case "guest_remind": {
        const lang = (params?.lang || "en").toLowerCase() === "sw" ? "sw" : "en";
        const tplName = lang === "sw" ? "nuru_guest_remind_sw" : "nuru_guest_remind_en";
        result = await sendTemplate(phone, tplName, buildGuestRemindComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, lang);
        break;
      }
      case "send_invitation_text":
        result = await sendTemplate(
          phone,
          "event_invitation_text",
          buildInvitationTextComponents(params),
          WHATSAPP_ACCESS_TOKEN,
          WHATSAPP_PHONE_NUMBER_ID,
        );
        break;
      case "send_invitation_card":
        console.log(`[WhatsApp] Invitation card params:`, JSON.stringify({
          guest_name: params?.guest_name,
          event_name: params?.event_name,
          event_date: params?.event_date,
          organizer_name: params?.organizer_name,
          rsvp_code: params?.rsvp_code,
          has_image_url: Boolean(params?.image_url),
          image_url: params?.image_url,
        }));
        result = await sendTemplate(
          phone,
          "event_invitation_card",
          buildInvitationCardComponents(params),
          WHATSAPP_ACCESS_TOKEN,
          WHATSAPP_PHONE_NUMBER_ID,
        );
        break;
      case "send_ticket":
        result = await sendTemplate(
          phone,
          "event_ticket_delivery",
          buildTicketDeliveryComponents(params),
          WHATSAPP_ACCESS_TOKEN,
          WHATSAPP_PHONE_NUMBER_ID,
        );
        break;
      case "vendor_payment_otp":
        result = await sendTemplate(
          phone,
          "vendor_payment_otp",
          buildVendorPaymentOtpComponents(params),
          WHATSAPP_ACCESS_TOKEN,
          WHATSAPP_PHONE_NUMBER_ID,
        );
        break;
      case "vendor_payment_confirmed":
        result = await sendTemplate(
          phone,
          "vendor_payment_confirmed",
          buildVendorPaymentConfirmedComponents(params),
          WHATSAPP_ACCESS_TOKEN,
          WHATSAPP_PHONE_NUMBER_ID,
        );
        break;
      case "image":
        // Freeform image (only delivers within the 24h customer service window;
        // safe fallback for organisers chatting with confirmed contacts)
        result = await sendImageMessage(phone, params?.image_url || "", params?.caption || "", WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
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

// ── Meeting invitation template ──
// Template body: "You've been invited to a meeting for *{{1}}*.\n\n📋 *Meeting:* {{2}}\n🕐 *When:* {{3}}\n\nJoin using the link below:\n🔗 {{4}}"
// Button [0]: URL button "Join Meeting" → {{5}}
function buildMeetingInvitationComponents(params: {
  event_name?: string; meeting_title?: string; scheduled_time?: string; meeting_link?: string;
}) {
  const link = params.meeting_link || "https://nuru.tz";
  // Extract the path suffix for the dynamic URL button
  // Meta template base URL is configured as https://nuru.tz/meet/
  // so we only need the room_id part for {{1}} in the button
  let buttonSuffix = link;
  try {
    const urlObj = new URL(link);
    // Get just the path after /meet/ e.g. "nuru-abc12345-def67890"
    const meetPath = urlObj.pathname.replace(/^\/meet\//, "");
    if (meetPath && meetPath !== urlObj.pathname) {
      buttonSuffix = meetPath;
    }
  } catch {
    // If URL parsing fails, use the full link
  }

  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.event_name || "an event" },
        { type: "text", text: params.meeting_title || "Meeting" },
        { type: "text", text: params.scheduled_time || "TBA" },
        { type: "text", text: link },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: buttonSuffix },
      ],
    },
  ];
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
  phoneNumberId: string,
  langOverride?: string
) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const languageCode = langOverride || "en";

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

// ── Invitation text template (no image) ──
// Body params (7): {{1}} guest_name, {{2}} event_name, {{3}} organizer_name,
// {{4}} event_date, {{5}} event_time, {{6}} venue, {{7}} rsvp_code
// Two URL buttons, each with a single dynamic suffix variable. The Meta
// template's button URLs are configured as https://nuru.tz/i/{{1}} and
// https://nuru.tz/rsvp/{{1}}, where the {{1}} is the per-button suffix —
// we pass the rsvp_code so the link resolves to the correct invitation.
function buildInvitationTextComponents(params: {
  guest_name?: string; event_name?: string; organizer_name?: string;
  event_date?: string; event_time?: string; venue?: string; rsvp_code?: string;
}) {
  const code = (params.rsvp_code || "").trim() || "—";
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.guest_name || "Guest" },
        { type: "text", text: params.event_name || "the event" },
        { type: "text", text: params.organizer_name || "the organizer" },
        { type: "text", text: params.event_date || "TBA" },
        { type: "text", text: params.event_time || "TBA" },
        { type: "text", text: params.venue || "TBA" },
        { type: "text", text: code },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    },
    {
      type: "button",
      sub_type: "url",
      index: "1",
      parameters: [{ type: "text", text: code }],
    },
  ];
}

// ── Invitation card / ticket media-template builders ──
//
// WhatsApp template image headers occasionally fail to render PNG images
// (especially PNGs with an alpha channel) — the message delivers but the
// image slot stays empty. We always proxy the image URL through wsrv.nl
// to force a JPEG (flat, no alpha, ≤2MB) so Meta consistently displays it.
function toWaImageLink(rawUrl: string): string {
  if (!rawUrl) return "";
  // Already converted, leave as-is.
  if (rawUrl.includes("wsrv.nl")) return rawUrl;
  const stripped = rawUrl.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(stripped)}&output=jpg&q=95&we`;
}

function buildInvitationCardComponents(params: {
  image_url?: string; guest_name?: string; event_name?: string;
  event_date?: string; organizer_name?: string; rsvp_code?: string;
}) {
  return [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: toWaImageLink(params.image_url || "") } }],
    },
    {
      type: "body",
      parameters: [
        { type: "text", text: params.guest_name || "Guest" },
        { type: "text", text: params.event_name || "the event" },
        { type: "text", text: params.event_date || "TBD" },
        { type: "text", text: params.organizer_name || "Your host" },
        { type: "text", text: params.rsvp_code || "—" },
      ],
    },
  ];
}

function buildTicketDeliveryComponents(params: {
  image_url?: string; guest_name?: string; event_name?: string;
  event_date?: string; ticket_class?: string; ticket_code?: string;
}) {
  return [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: toWaImageLink(params.image_url || "") } }],
    },
    {
      type: "body",
      parameters: [
        { type: "text", text: params.guest_name || "Friend" },
        { type: "text", text: params.event_name || "the event" },
        { type: "text", text: params.event_date || "TBD" },
        { type: "text", text: params.ticket_class || "General" },
        { type: "text", text: params.ticket_code || "—" },
      ],
    },
  ];
}

// ── Send freeform image (24h window only) ─────────────
async function sendImageMessage(phone: string, imageUrl: string, caption: string, token: string, phoneId: string) {
  const url = `${GRAPH_API}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "image",
      image: { link: imageUrl, caption: caption || undefined },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`WhatsApp image send error [${res.status}]:`, JSON.stringify(data));
    throw new Error(`WhatsApp image send failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return { sent: true, message_id: data.messages?.[0]?.id };
}

// ── Vendor offline-payment OTP ──
// Body: "NURU PAYMENT\n\nHello {{1}}, {{2}} has made a payment claim of {{3}} for your service \"{{4}}\" at {{5}}.\n\nUse this code to confirm the payment: {{6}}\n\nCode expires in 10 minutes."
function buildVendorPaymentOtpComponents(params: {
  vendor_name?: string; organiser_name?: string; amount?: string;
  service_title?: string; event_name?: string; otp?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.vendor_name || "there" },
      { type: "text", text: params.organiser_name || "An organiser" },
      { type: "text", text: params.amount || "an amount" },
      { type: "text", text: params.service_title || "your service" },
      { type: "text", text: params.event_name || "the event" },
      { type: "text", text: params.otp || "------" },
    ],
  }];
}

// ── Vendor payment confirmed ──
// Body: "NURU PAYMENT\n\nHello {{1}}, you have received a payment of {{2}} from {{3}} for {{4}}.\n\n{{5}}"
function buildVendorPaymentConfirmedComponents(params: {
  vendor_name?: string; amount?: string; organiser_name?: string;
  event_name?: string; remaining_msg?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.vendor_name || "there" },
      { type: "text", text: params.amount || "an amount" },
      { type: "text", text: params.organiser_name || "the organiser" },
      { type: "text", text: params.event_name || "the event" },
      { type: "text", text: params.remaining_msg || "Payment is fully settled." },
    ],
  }];
}

// ── Reminder automation templates ─────────────────────
// nuru_fundraise_notice_{en|sw}
//   Body: {{1}} recipient_name, {{2}} body
function buildFundraiseAttendComponents(params: {
  recipient_name?: string; body?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.recipient_name || "Friend" },
      { type: "text", text: params.body || "" },
    ],
  }];
}

// nuru_pledge_remind_{en|sw}
//   Body: {{1}} recipient_name, {{2}} event_name, {{3}} event_datetime,
//         {{4}} pledge_amount, {{5}} balance
//   URL button [0]: dynamic suffix = pay_token (the share token)
function buildPledgeRemindComponents(params: {
  recipient_name?: string; event_name?: string; event_datetime?: string;
  pledge_amount?: string; balance?: string; pay_token?: string;
}) {
  const token = (params.pay_token || "").trim() || "—";
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.recipient_name || "Friend" },
        { type: "text", text: params.event_name || "the event" },
        { type: "text", text: params.event_datetime || "TBA" },
        { type: "text", text: params.pledge_amount || "—" },
        { type: "text", text: params.balance || "—" },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: token }],
    },
  ];
}

// nuru_guest_remind_{en|sw}
//   Body: {{1}} recipient_name, {{2}} event_name, {{3}} event_datetime,
//         {{4}} event_venue
function buildGuestRemindComponents(params: {
  recipient_name?: string; event_name?: string;
  event_datetime?: string; event_venue?: string;
}) {
  return [{
    type: "body",
    parameters: [
      { type: "text", text: params.recipient_name || "Friend" },
      { type: "text", text: params.event_name || "the event" },
      { type: "text", text: params.event_datetime || "TBA" },
      { type: "text", text: params.event_venue || "TBA" },
    ],
  }];
}
