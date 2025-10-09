// file: functions/nuru-chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const allowedOrigins = [
    "https://nuru.tz",
    "https://workspace.nuru.tz",
    "http://localhost:8080",
    "http://192.168.200.178:8080",
  ];

  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : "https://nuru.tz",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Helper function for JSON response
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    console.log("Request method:", req.method, "Origin:", origin);

    // --- Handle preflight OPTIONS requests first ---
    if (req.method === "OPTIONS") {
      console.log("⚡ Preflight OPTIONS request received, returning 204");
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- Only allow POST ---
    if (req.method !== "POST") {
      console.log("❌ Invalid method:", req.method);
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // --- Parse incoming JSON ---
    let body;
    try {
      body = await req.json();
      console.log("✅ Body parsed successfully");
    } catch (err) {
      console.error("❌ Failed to parse JSON body:", err);
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      console.error("❌ Missing or invalid 'messages' array");
      return jsonResponse({ error: "Missing or invalid 'messages' array" }, 400);
    }

    console.log("✅ Received chat request with messages:", messages);

    // --- Load API key from environment ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ LOVABLE_API_KEY is not configured");
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }


    const systemPrompt = `You are Nuru AI Assistant, a friendly, professional, and helpful guide for the Nuru event planning platform.

    Communication Style:
    - Be warm, conversational, and human-like
    - Use simple, everyday language that Tanzanian users can easily understand
    - Keep responses concise but informative
    - Only provide step-by-step instructions when asked "how to"
    - Encourage users and be supportive
    - Admit if unsure but offer guidance or resources

    About Nuru:
    Nuru is an all-in-one event management platform designed for Tanzanian communities. It helps users plan, manage, and execute events like weddings, birthdays, graduations, memorials, and corporate gatherings. Nuru simplifies every step, ensuring users save time, avoid mistakes, and find trusted service providers.

    Key Features & Guidance:
    1. Event Planning: Create budgets, guest lists, and timelines. Provide helpful tips for Tanzanian events.
    2. Find Services: Connect with verified local providers like caterers, decorators, venues, photographers, etc.
    3. Service Verification: Ensure credibility and reviews are clear to avoid scams.
    4. My Services: Manage your listings, bookings, and service performance.
    5. Contributions & Pledges: Collect funds or items for events smoothly.
    6. Committee Management: Assign roles and responsibilities for large events like weddings or community programs.
    7. Invitations: Send digital invitations, track RSVPs, and manage guest responses.
    8. Social Feed: Share updates, photos, or important announcements with your event community.
    9. Messaging: Chat securely with providers and participants directly from the platform.
    10. Payments: Process payments safely in Tanzanian Shillings (TZS), supporting multiple payment methods.

    Tips for users:
    - Always confirm service availability early.
    - Use Nuru to track budgets and avoid overspending.
    - Engage your committee for larger events for smooth coordination.
    - Encourage guests to RSVP digitally to reduce confusion.

    Be friendly, helpful, proactive, and provide clear instructions. If the user asks about Tanzanian customs or typical event practices, provide culturally relevant advice.`;



    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    console.log("AI gateway status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ AI gateway error:", response.status, errorText);
      let message = "Unknown error";
      if (response.status === 429) message = "Rate limit exceeded. Please try again later.";
      if (response.status === 402) message = "Payment required. Please contact support.";
      return jsonResponse({ error: message }, response.status);
    }

    // --- Stream response ---
    console.log("✅ Streaming response to client");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("❌ Chat error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});