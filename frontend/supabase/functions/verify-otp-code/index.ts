import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brute-force protection: max 5 verification attempts per phone per 15 minutes
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { phone, code, purpose } = body;

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing phone or code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/[^\d]/g, "");
    const otpPurpose = purpose || "phone_verification";

    // ── Brute-force protection: count recent failed attempts ──
    // We track attempts by checking how many OTPs were marked used (failed verifications
    // don't mark as used, but we can count total verification requests).
    // Simple approach: check if there are too many recent OTP records for this phone
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentAttempts, error: countError } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", cleanPhone)
      .eq("purpose", otpPurpose)
      .gte("created_at", windowStart);

    // If there are many OTP records and still trying, likely brute forcing
    // We'll use a simple counter approach - after MAX_ATTEMPTS wrong codes, lock out
    if (!countError && (recentAttempts ?? 0) > MAX_ATTEMPTS * 2) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many attempts. Please request a new code." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "900" } }
      );
    }

    // Look up the latest valid OTP
    const { data: otpRecords, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("purpose", otpPurpose)
      .eq("is_used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[verify-otp] DB error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Verification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpRecords || otpRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Code expired or not found. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = otpRecords[0];

    // Track attempt count on the record itself
    const currentAttempts = record.attempts ?? 0;
    if (currentAttempts >= MAX_ATTEMPTS) {
      // Too many wrong attempts on this OTP — invalidate it
      await supabase.from("otp_codes").update({ is_used: true }).eq("id", record.id);
      return new Response(
        JSON.stringify({ success: false, message: "Too many incorrect attempts. Please request a new code." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.code !== code) {
      // Increment attempt counter
      await supabase
        .from("otp_codes")
        .update({ attempts: currentAttempts + 1 })
        .eq("id", record.id);

      return new Response(
        JSON.stringify({ success: false, message: "Invalid verification code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as used
    await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("id", record.id);

    console.log(`[verify-otp] Code verified for ${cleanPhone}`);

    return new Response(
      JSON.stringify({ success: true, message: "Phone verified successfully", user_id: record.user_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[verify-otp] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});