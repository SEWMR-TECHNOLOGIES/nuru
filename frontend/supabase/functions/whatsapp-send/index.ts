// WhatsApp Send Edge Function
// =============================
// Source of truth for all 48 production templates:
// backend/app/docs/whatsapp_templates_catalogue.md
//
// Every action below maps to ONE catalogue entry (lang-aware _sw / _en pair)
// with placeholder counts and button structures that match Meta exactly.
// Money values arrive pre-formatted as a single combined string (e.g.
// "TZS 10,000") under *_text keys — Meta forbids placeholder reuse.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

// ── Helpers ────────────────────────────────────────────
type Lang = "sw" | "en";
const pickLang = (raw: unknown, fallback: Lang = "sw"): Lang =>
  String(raw || fallback).toLowerCase() === "en" ? "en" : "sw";

const T = (text: unknown) => ({ type: "text", text: String(text ?? "") });

const bodyParams = (vals: unknown[]) => [{ type: "body", parameters: vals.map(T) }];

const urlButton = (suffix: string) => ({
  type: "button",
  sub_type: "url",
  index: "0",
  parameters: [{ type: "text", text: String(suffix || "").slice(0, 60) }],
});

// ── Catalogue-aligned builders ─────────────────────────
// Each function returns { name, lang, components } given (lang, params).
// Templates with dynamic URL buttons append a button component.

type Built = { name: string; lang: Lang; components: Array<Record<string, unknown>> };

const BUILDERS: Record<string, (lang: Lang, p: any) => Built> = {
  // #1/2 — guest_invitation, dynamic URL button = rsvp_code
  guest_invitation: (lang, p) => ({
    name: `nuru_guest_invitation_${lang}`,
    lang,
    components: [
      ...bodyParams([
        p.guest_name || "Guest",
        p.organizer_name || "The organizer",
        p.event_name || "an event",
        p.event_date || p.event_date_and_time || "TBA",
        p.event_venue || p.venue || "TBA",
      ]),
      urlButton(p.rsvp_code || ""),
    ],
  }),

  // #3/4 — committee_invite
  committee_invite: (lang, p) => ({
    name: `nuru_committee_invite_${lang}`,
    lang,
    components: bodyParams([
      p.member_name || "Member",
      p.organizer_name || "The organizer",
      p.role || "committee member",
      p.event_name || "an event",
      p.custom_message || (lang === "sw" ? "Karibu kwenye kamati." : "Welcome to the committee."),
    ]),
  }),

  // #5/6 — welcome_registered_by, dynamic URL button = setup_token
  welcome_registered_by: (lang, p) => ({
    name: `nuru_welcome_registered_by_${lang}`,
    lang,
    components: [
      ...bodyParams([
        p.new_user_name || p.recipient_first_name || "rafiki",
        p.registered_by_name || p.inviter_name || "Mtumiaji wa Nuru",
      ]),
      urlButton(p.setup_token || ""),
    ],
  }),

  // #7/8 — meeting_invitation, dynamic URL button = meeting_redirect_token
  meeting_invitation: (lang, p) => {
    let suffix = String(p.meeting_redirect_token || "").trim();
    if (!suffix && p.meeting_link) {
      try {
        const u = new URL(p.meeting_link);
        const m = u.pathname.match(/\/(?:m|meet)\/([^/?#]+)/);
        if (m) suffix = m[1];
      } catch { /* ignore */ }
    }
    return {
      name: `nuru_meeting_invitation_${lang}`,
      lang,
      components: [
        ...bodyParams([
          p.meeting_title || "Meeting",
          p.event_name || "an event",
          p.scheduled_time || p.scheduled_date_and_time || "TBA",
        ]),
        urlButton(suffix || "invalid"),
      ],
    };
  },

  // #9/10 — contribution_recorded_with_balance (7 params)
  contribution_recorded_with_balance: (lang, p) => ({
    name: `nuru_contribution_recorded_with_balance_${lang}`,
    lang,
    components: bodyParams([
      p.contributor_name || "Contributor",
      p.amount_text || p.amount || "TZS 0",
      p.recorder_name || "The organizer",
      p.event_name || "an event",
      p.total_paid_text || p.total_paid || "TZS 0",
      p.balance_text || p.balance || "TZS 0",
      p.organizer_phone || "Nuru",
    ]),
  }),

  // #11/12 — contribution_recorded_pledge_complete (6 params)
  contribution_recorded_pledge_complete: (lang, p) => ({
    name: `nuru_contribution_recorded_pledge_complete_${lang}`,
    lang,
    components: bodyParams([
      p.contributor_name || "Contributor",
      p.amount_text || p.amount || "TZS 0",
      p.recorder_name || "The organizer",
      p.event_name || "an event",
      p.target_text || p.target || "TZS 0",
      p.organizer_phone || "Nuru",
    ]),
  }),

  // #13/14 — contribution_target_set (5 params: contributor, event, target, payment_instructions, organizer_phone)
  contribution_target_set: (lang, p) => ({
    name: `nuru_contribution_target_set_${lang}`,
    lang,
    components: bodyParams([
      p.contributor_name || "Contributor",
      p.event_name || "an event",
      p.target_text || p.target || "TZS 0",
      p.payment_instructions || (lang === "en"
        ? "Pay your contribution to the organizer through Nuru securely."
        : "Unaweza kutoa mchango wako kupitia Nuru."),
      p.organizer_phone || "Nuru",
    ]),
  }),

  // #14a/14b — contribution_target_updated (6 params: contributor, event, increase, total, payment_instructions, organizer_phone)
  contribution_target_updated: (lang, p) => ({
    name: `nuru_contribution_target_updated_${lang}`,
    lang,
    components: bodyParams([
      p.contributor_name || "Contributor",
      p.event_name || "an event",
      p.increase_text || p.increase || "TZS 0",
      p.total_target_text || p.total_target || "TZS 0",
      p.payment_instructions || (lang === "en"
        ? "Pay your contribution to the organizer through Nuru securely."
        : "Unaweza kutoa mchango wako kupitia Nuru."),
      p.organizer_phone || "Nuru",
    ]),
  }),

  // #15/16 — contribution_thank_you (5 params)
  contribution_thank_you: (lang, p) => ({
    name: `nuru_contribution_thank_you_${lang}`,
    lang,
    components: bodyParams([
      p.contributor_name || "Contributor",
      p.amount_text || p.amount || "TZS 0",
      p.event_name || "an event",
      p.custom_message ||
        (lang === "sw" ? "Tunakushukuru kwa ukarimu wako." : "We deeply appreciate your generosity."),
      p.organizer_phone || "Nuru",
    ]),
  }),

  // Pledge thank-you card (image header + 2 body params)
  pledge_thank_you_card: (lang, p) => ({
    name: `nuru_pledge_thank_you_card_${lang}`,
    lang,
    components: [
      { type: "header", parameters: [{ type: "image", image: { link: toWaImageLink(p.image_url || "") } }] },
      ...bodyParams([
        p.contributor_name || "Friend",
        p.event_name || "the event",
      ]),
    ],
  }),

  // #17/18 — guest_contribution_invite, dynamic URL button = share_token
  guest_contribution_invite: (lang, p) => ({
    name: `nuru_guest_contribution_invite_${lang}`,
    lang,
    components: [
      ...bodyParams([
        p.contributor_name || "Friend",
        p.organiser_name || p.organizer_name || "The organiser",
        p.event_name || "an event",
        p.pledge_amount_text || p.pledge_amount || "TZS 0",
      ]),
      urlButton(p.share_token || ""),
    ],
  }),

  // #19/20 — guest_contribution_receipt, dynamic URL button = receipt_path
  guest_contribution_receipt: (lang, p) => ({
    name: `nuru_guest_contribution_receipt_${lang}`,
    lang,
    components: [
      ...bodyParams([
        p.contributor_name || "Friend",
        p.amount_text || p.amount || "TZS 0",
        p.event_name || "an event",
        p.total_paid_text || p.total_paid || "TZS 0",
        p.balance_text || p.balance || "TZS 0",
        p.transaction_code || "—",
      ]),
      urlButton(p.receipt_path || ""),
    ],
  }),

  // #21/22 — payment_received_generic (4 params)
  payment_received_generic: (lang, p) => ({
    name: `nuru_payment_received_generic_${lang}`,
    lang,
    components: bodyParams([
      p.amount_text || p.amount || "TZS 0",
      p.payer_name || "a payer",
      p.purpose || "your account",
      p.transaction_code || "—",
    ]),
  }),

  // #23/24 — payment_confirmation_payer (4 params)
  payment_confirmation_payer: (lang, p) => ({
    name: `nuru_payment_confirmation_payer_${lang}`,
    lang,
    components: bodyParams([
      p.payer_name || "Friend",
      p.amount_text || p.amount || "TZS 0",
      p.purpose || "your payment",
      p.transaction_code || "—",
    ]),
  }),

  // #25/26 — organiser_contribution_received (5 params)
  organiser_contribution_received: (lang, p) => ({
    name: `nuru_organiser_contribution_received_${lang}`,
    lang,
    components: bodyParams([
      p.organizer_name || "Organiser",
      p.amount_text || p.amount || "TZS 0",
      p.contributor_name || "a contributor",
      p.event_name || "an event",
      p.transaction_code || "—",
    ]),
  }),

  // #27/28 — vendor_booking_paid (8 params)
  vendor_booking_paid: (lang, p) => ({
    name: `nuru_vendor_booking_paid_${lang}`,
    lang,
    components: bodyParams([
      p.vendor_name || "Vendor",
      p.amount_text || p.amount || "TZS 0",
      p.client_name || "a client",
      p.service_title || p.service_name || "your service",
      p.service_amount_text || p.service_amount || "TZS 0",
      p.total_paid_text || p.total_paid || "TZS 0",
      p.balance_text || p.balance || "TZS 0",
      p.transaction_code || "—",
    ]),
  }),

  // #29/30 — admin_payment_alert (7 params)
  admin_payment_alert: (lang, p) => ({
    name: `nuru_admin_payment_alert_${lang}`,
    lang,
    components: bodyParams([
      p.amount_text || p.amount || "TZS 0",
      p.method || "—",
      p.purpose || "—",
      p.target_label || "",
      p.payer_name || "a payer",
      p.payer_phone || "—",
      p.transaction_code || "—",
    ]),
  }),

  // #35/36 — vendor_confirmation_receipt (5 params)
  vendor_confirmation_receipt: (lang, p) => ({
    name: `nuru_vendor_confirmation_receipt_${lang}`,
    lang,
    components: bodyParams([
      p.vendor_first_name || p.vendor_name || "Vendor",
      p.amount_text || p.amount || "TZS 0",
      p.organiser_name || "the organiser",
      p.event_name || "the event",
      p.balance_text || p.balance || "TZS 0",
    ]),
  }),

  // #37/38 — vendor_confirmation_receipt_full (4 params)
  vendor_confirmation_receipt_full: (lang, p) => ({
    name: `nuru_vendor_confirmation_receipt_full_${lang}`,
    lang,
    components: bodyParams([
      p.vendor_first_name || p.vendor_name || "Vendor",
      p.amount_text || p.amount || "TZS 0",
      p.organiser_name || "the organiser",
      p.event_name || "the event",
    ]),
  }),

  // #39/40 — organiser_committee_vendor_confirmed (6 params)
  organiser_committee_vendor_confirmed: (lang, p) => ({
    name: `nuru_organiser_committee_vendor_confirmed_${lang}`,
    lang,
    components: bodyParams([
      p.recipient_first_name || "Member",
      p.vendor_name || "the vendor",
      p.amount_text || p.amount || "TZS 0",
      p.organiser_name || "the organiser",
      p.event_name || "the event",
      p.balance_text || p.balance || "TZS 0",
    ]),
  }),

  // #41/42 — expense_recorded (5 params)
  expense_recorded: (lang, p) => ({
    name: `nuru_expense_recorded_${lang}`,
    lang,
    components: bodyParams([
      p.recipient_first_name || p.recipient_name || "Member",
      p.recorder_name || "A member",
      p.amount_text || p.amount || "TZS 0",
      p.category || "General",
      p.event_name || "an event",
    ]),
  }),

  // #42a/42b — owner_expense_summary (7 params)
  owner_expense_summary: (lang, p) => ({
    name: `nuru_owner_expense_summary_${lang}`,
    lang,
    components: bodyParams([
      p.organizer_name || p.owner_name || "Friend",
      p.event_name || "an event",
      p.expense_name || p.category || "Expense",
      p.expense_amount || p.expense_amount_text || p.amount_text || p.amount || "TZS 0",
      p.total_budget || p.total_budget_text || "TZS 0",
      p.total_expenses || p.total_expenses_text || "TZS 0",
      p.remaining_balance || p.remaining_balance_text || "TZS 0",
    ]),
  }),

  // #43/44 — service_booking_notification (4 params)
  service_booking_notification: (lang, p) => ({
    name: `nuru_service_booking_notification_${lang}`,
    lang,
    components: bodyParams([
      p.provider_name || "Provider",
      p.client_name || "a client",
      p.service_name || "your service",
      p.event_name || "an event",
    ]),
  }),

  // #45/46 — booking_accepted (4 params)
  booking_accepted: (lang, p) => ({
    name: `nuru_booking_accepted_${lang}`,
    lang,
    components: bodyParams([
      p.requester_first_name || p.client_name || "Friend",
      p.vendor_name || "The vendor",
      p.service_name || "your service",
      p.event_name || "the event",
    ]),
  }),
};

// Legacy aliases kept ONLY so backend callers that still pass an older
// action name route to the new template. No old templates are referenced
// here — every alias resolves to a builder above.
const ALIASES: Record<string, string> = {
  // legacy → catalogue
  invite: "guest_invitation",
  contribution_recorded: "contribution_recorded_with_balance",
  contribution_target: "contribution_target_set",
  thank_you_contribution: "contribution_thank_you",
  booking_notification: "service_booking_notification",
  vendor_payment_confirmed: "vendor_confirmation_receipt",
};

// ── Reminder-automation templates (kept as-is per catalogue "Skipped") ──
function buildFundraiseAttend(lang: Lang, p: any) {
  return {
    name: `nuru_fundraise_notice_${lang}`,
    lang,
    components: bodyParams([p.recipient_name || "Friend", p.body || ""]),
  };
}
function buildPledgeRemind(lang: Lang, p: any) {
  return {
    name: `nuru_pledge_remind_${lang}`,
    lang,
    components: [
      ...bodyParams([
        p.recipient_name || "Friend",
        p.event_name || "the event",
        p.event_datetime || "TBA",
        p.pledge_amount || "—",
        p.balance || "—",
      ]),
      urlButton(p.pay_token || ""),
    ],
  };
}
function buildGuestRemind(lang: Lang, p: any) {
  return {
    name: `nuru_guest_remind_${lang}`,
    lang,
    components: bodyParams([
      p.recipient_name || "Friend",
      p.event_name || "the event",
      p.event_datetime || "TBA",
      p.event_venue || "TBA",
    ]),
  };
}

// ── HTTP entrypoint ────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return json({ error: "WhatsApp not configured" }, 500);
  }

  try {
    const body = await req.json();
    const { action: rawAction, phone, params = {} } = body || {};
    if (!rawAction || !phone) return json({ error: "Missing action or phone" }, 400);

    // Resolve legacy aliases
    const action = ALIASES[rawAction] || rawAction;
    const lang = pickLang(params?.lang);

    let result: any;

    // 1) Catalogue UTILITY templates
    if (BUILDERS[action]) {
      const built = BUILDERS[action](lang, params);
      result = await sendTemplate(phone, built.name, built.components, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, built.lang);
    } else {
      // 2) Non-catalogue actions (OTP, reminder-automation, rich media, freeform)
      switch (action) {
        // AUTHENTICATION-category OTPs — code-only payload
        case "vendor_otp_claim":
        case "vendor_otp_resend": {
          const name = action === "vendor_otp_claim"
            ? `nuru_vendor_otp_claim_${lang}`
            : `nuru_vendor_otp_resend_${lang}`;
          result = await sendAuthOtpTemplate(phone, name, lang, String(params?.otp || params?.otp_code || "------"), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;
        }
        case "otp_verification":
          result = await sendOtpTemplate(phone, params, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          if (result?.not_on_whatsapp) {
            return json({ success: false, not_on_whatsapp: true, error_code: result.error_code }, 200);
          }
          break;

        // Reminder-automation templates (separate doc, kept as-is)
        case "fundraise_attend": {
          const built = buildFundraiseAttend(lang, params);
          result = await sendTemplate(phone, built.name, built.components, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, built.lang);
          break;
        }
        case "pledge_remind": {
          const built = buildPledgeRemind(lang, params);
          result = await sendTemplate(phone, built.name, built.components, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, built.lang);
          break;
        }
        case "guest_remind": {
          const built = buildGuestRemind(lang, params);
          result = await sendTemplate(phone, built.name, built.components, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, built.lang);
          break;
        }
        case "reminder":
          result = await sendTemplate(phone, "event_reminder", buildLegacyReminder(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;

        // Rich-media invitation/ticket templates (driven by whatsapp_cards.py)
        case "send_invitation_text":
          result = await sendTemplate(phone, "event_invitation_text", buildInvitationTextComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;
        case "send_invitation_card":
          result = await sendTemplate(phone, "event_invitation_card", buildInvitationCardComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;
        case "send_ticket":
          result = await sendTemplate(phone, "event_ticket_delivery", buildTicketDeliveryComponents(params), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;

        // Freeform fallbacks
        case "text":
          result = await sendTextMessage(phone, params?.message || "", WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;
        case "image":
          result = await sendImageMessage(phone, params?.image_url || "", params?.caption || "", WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;
        case "check_whatsapp":
          result = await checkWhatsAppBySending(phone, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
          break;

        default:
          return json({ error: `Unknown action: ${rawAction}` }, 400);
      }
    }

    return json({ success: true, ...result }, 200);
  } catch (error) {
    console.error("WhatsApp send error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: msg }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Senders ────────────────────────────────────────────
async function sendTemplate(
  phone: string,
  templateName: string,
  components: Array<Record<string, unknown>>,
  accessToken: string,
  phoneNumberId: string,
  langOverride?: string,
) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const languageCode = langOverride || "en";
  console.log(`[WhatsApp] Sending template "${templateName}" lang="${languageCode}" to ${phone}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: templateName, language: { code: languageCode }, components },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const errorCode = data?.error?.code;
    const errorSubCode = data?.error?.error_subcode;
    console.error(`WhatsApp template API error [${res.status}] tpl="${templateName}":`, JSON.stringify(data));
    if (errorCode === 131026 || errorSubCode === 131026 || errorCode === 131047) {
      return { sent: false, not_on_whatsapp: true, error_code: errorCode };
    }
    throw new Error(`WhatsApp template API failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return { sent: true, message_id: data.messages?.[0]?.id };
}

async function sendOtpTemplate(phone: string, params: { otp_code?: string }, accessToken: string, phoneNumberId: string) {
  const code = params.otp_code || "000000";
  const components = [
    { type: "body", parameters: [{ type: "text", text: code }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
  ];
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: "otp_verification", language: { code: "en" }, components },
    }),
  });
  const data = await res.json();
  if (res.ok) return { sent: true, message_id: data.messages?.[0]?.id };
  const errorCode = data?.error?.code;
  if (errorCode === 131026 || errorCode === 131047) return { sent: false, not_on_whatsapp: true, error_code: errorCode };
  throw new Error(`WhatsApp OTP API failed [${res.status}]: ${JSON.stringify(data)}`);
}

async function sendAuthOtpTemplate(phone: string, templateName: string, langCode: string, code: string, accessToken: string, phoneNumberId: string) {
  const components = [
    { type: "body", parameters: [{ type: "text", text: code }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
  ];
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: templateName, language: { code: langCode }, components },
    }),
  });
  const data = await res.json();
  if (res.ok) return { sent: true, message_id: data.messages?.[0]?.id };
  const errorCode = data?.error?.code;
  if (errorCode === 131026 || errorCode === 131047) return { sent: false, not_on_whatsapp: true, error_code: errorCode };
  throw new Error(`WhatsApp Auth OTP API failed [${res.status}]: ${JSON.stringify(data)}`);
}

async function sendTextMessage(phone: string, text: string, token: string, phoneId: string) {
  const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: text } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp text API failed [${res.status}]: ${JSON.stringify(data)}`);
  return { message_id: data.messages?.[0]?.id };
}

async function sendImageMessage(phone: string, imageUrl: string, caption: string, token: string, phoneId: string) {
  const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
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
  if (!res.ok) throw new Error(`WhatsApp image API failed [${res.status}]: ${JSON.stringify(data)}`);
  return { sent: true, message_id: data.messages?.[0]?.id };
}

async function checkWhatsAppBySending(phone: string, accessToken: string, phoneNumberId: string) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    }),
  });
  const data = await res.json();
  if (res.ok) return { is_whatsapp: true, wa_id: data.contacts?.[0]?.wa_id || phone };
  const errorCode = data?.error?.code;
  if (errorCode === 131026 || errorCode === 131047) return { is_whatsapp: false, wa_id: null };
  return { is_whatsapp: "unknown", wa_id: null, error: data?.error?.message };
}

// ── Legacy/Rich-media builders (kept verbatim — out of catalogue scope) ──
function buildLegacyReminder(p: any) {
  return [{
    type: "body",
    parameters: [
      T(p.guest_name || "Guest"),
      T(p.event_name || "an event"),
      T(p.event_date || "TBA"),
      T(p.event_time || "TBA"),
      T(p.location || "TBA"),
    ],
  }];
}

function toWaImageLink(rawUrl: string): string {
  if (!rawUrl) return "";
  if (rawUrl.includes("wsrv.nl")) return rawUrl;
  const stripped = rawUrl.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(stripped)}&output=jpg&q=95&we`;
}

function buildInvitationTextComponents(p: any) {
  const code = (p.rsvp_code || "").trim() || "—";
  return [
    {
      type: "body",
      parameters: [
        T(p.guest_name || "Guest"),
        T(p.event_name || "the event"),
        T(p.organizer_name || "the organizer"),
        T(p.event_date || "TBA"),
        T(p.event_time || "TBA"),
        T(p.venue || "TBA"),
        T(code),
      ],
    },
    { type: "button", sub_type: "url", index: "0", parameters: [T(code)] },
    { type: "button", sub_type: "url", index: "1", parameters: [T(code)] },
  ];
}

function buildInvitationCardComponents(p: any) {
  return [
    { type: "header", parameters: [{ type: "image", image: { link: toWaImageLink(p.image_url || "") } }] },
    {
      type: "body",
      parameters: [
        T(p.guest_name || "Guest"),
        T(p.event_name || "the event"),
        T(p.event_date || "TBD"),
        T(p.organizer_name || "Your host"),
        T(p.rsvp_code || "—"),
      ],
    },
  ];
}

function buildTicketDeliveryComponents(p: any) {
  return [
    { type: "header", parameters: [{ type: "image", image: { link: toWaImageLink(p.image_url || "") } }] },
    {
      type: "body",
      parameters: [
        T(p.guest_name || "Friend"),
        T(p.event_name || "the event"),
        T(p.event_date || "TBD"),
        T(p.ticket_class || "General"),
        T(p.ticket_code || "—"),
      ],
    },
  ];
}
