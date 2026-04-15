import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Rate limit: max 3 OTP requests per phone per hour
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  // ── Server-secret gate: only the backend may call this function ──
  const OTP_SERVICE_SECRET = Deno.env.get("OTP_SERVICE_SECRET");
  if (OTP_SERVICE_SECRET) {
    const incomingSecret = req.headers.get("x-otp-service-secret");
    if (incomingSecret !== OTP_SERVICE_SECRET) {
      console.log("[send-otp] Rejected: missing or invalid x-otp-service-secret header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { phone, user_id, purpose, verified_by_backend } = body;

    // ── Require the backend to confirm the phone belongs to a real user ──
    if (!verified_by_backend) {
      console.log("[send-otp] Rejected: request not verified by backend (phone not confirmed in DB)");
      return new Response(
        JSON.stringify({ success: false, error: "Phone number must be verified by backend before sending OTP" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/[^\d]/g, "");
    const otpPurpose = purpose || "phone_verification";

    // ── Rate limiting: check recent OTP requests for this phone ──
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", cleanPhone)
      .gte("created_at", windowStart);

    if (!countError && (recentCount ?? 0) >= RATE_LIMIT_MAX) {
      console.log(`[send-otp] Rate limited: ${cleanPhone} has ${recentCount} requests in the last hour`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please wait before trying again.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } }
      );
    }

    // Invalidate previous unused codes for this phone + purpose
    await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("phone", cleanPhone)
      .eq("purpose", otpPurpose)
      .eq("is_used", false);

    // Generate new OTP
    const code = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
        JSON.stringify({ success: false, error: "We couldn't store the code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channels: string[] = [];

    // ── Send via WhatsApp using the whatsapp-send edge function ──
    try {
      const waRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "otp_verification",
          phone: cleanPhone,
          params: { otp_code: code },
        }),
      });

      const waData = await waRes.json();
      console.log("[send-otp] whatsapp-send response:", JSON.stringify(waData));

      if (waData.success && !waData.not_on_whatsapp) {
        channels.push("whatsapp");
        console.log(`[send-otp] WhatsApp OTP sent to ${cleanPhone}`);
      } else if (waData.not_on_whatsapp) {
        console.log(`[send-otp] ${cleanPhone} not on WhatsApp`);
      } else {
        console.log(`[send-otp] WhatsApp failed for ${cleanPhone}:`, waData.error || "unknown");
      }
    } catch (e) {
      console.error("[send-otp] WhatsApp send error:", e);
    }

    // For TZ numbers: also trigger SMS via backend API
    const isTanzanian = cleanPhone.startsWith("255");
    if (isTanzanian && user_id) {
      try {
        const NURU_API = Deno.env.get("NURU_API_BASE_URL") || "https://api.nuru.tz/api/v1";
        const smsRes = await fetch(`${NURU_API}/users/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            verification_type: "phone",
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
        whatsapp_sent: channels.includes("whatsapp"),
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