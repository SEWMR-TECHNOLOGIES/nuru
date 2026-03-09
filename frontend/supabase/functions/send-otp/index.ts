import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

function generateOtp(length = 6): string {
  const digits = "0123456789";
  let otp = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    otp += digits[arr[i] % 10];
  }
  return otp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(
      JSON.stringify({ success: false, error: "WhatsApp not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { phone, user_id, purpose } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/[^\d]/g, "");
    const otpPurpose = purpose || "phone_verification";

    // Invalidate any previous unused codes for this phone + purpose
    await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("phone", cleanPhone)
      .eq("purpose", otpPurpose)
      .eq("is_used", false);

    // Generate new OTP
    const code = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Store in database
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: cleanPhone,
      code,
      user_id: user_id || null,
      purpose: otpPurpose,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[send-otp] DB insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to store OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if TZ number
    const isTanzanian = cleanPhone.startsWith("255");

    // Send via WhatsApp (all numbers)
    const whatsappResult = await sendWhatsAppOtp(
      cleanPhone,
      code,
      WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID
    );

    const channels: string[] = [];

    if (whatsappResult.sent) {
      channels.push("whatsapp");
      console.log(`[send-otp] WhatsApp OTP sent to ${cleanPhone}`);
    } else {
      console.log(`[send-otp] WhatsApp failed for ${cleanPhone}:`, whatsappResult.error || "not on whatsapp");
    }

    // For TZ numbers: also send via SMS through backend (call the Nuru API)
    if (isTanzanian && user_id) {
      try {
        const NURU_API = Deno.env.get("NURU_API_BASE_URL") || "https://api.nuru.tz/api/v1";
        const smsRes = await fetch(`${NURU_API}/users/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            verification_type: otpPurpose === "password_reset" ? "phone" : "phone",
          }),
        });
        const smsData = await smsRes.json();
        if (smsData.success) {
          channels.push("sms");
          console.log(`[send-otp] Backend SMS triggered for ${cleanPhone}`);
        }
      } catch (e) {
        console.error("[send-otp] Backend SMS error:", e);
      }
    }

    const channelMsg = channels.length > 0
      ? `Code sent via ${channels.join(" and ")}`
      : "Code generated but delivery pending";

    return new Response(
      JSON.stringify({
        success: true,
        message: channelMsg,
        channels,
        whatsapp_sent: whatsappResult.sent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-otp] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Send OTP via WhatsApp template
async function sendWhatsAppOtp(
  phone: string,
  code: string,
  accessToken: string,
  phoneNumberId: string
): Promise<{ sent: boolean; error?: string; not_on_whatsapp?: boolean }> {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;

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

  try {
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
      return { sent: true };
    }

    const errorCode = data?.error?.code;
    if (errorCode === 131026 || errorCode === 131047) {
      return { sent: false, not_on_whatsapp: true, error: `Error ${errorCode}` };
    }

    return { sent: false, error: `API error ${res.status}: ${data?.error?.message || "unknown"}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
