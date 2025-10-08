// file: functions/nuru-chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nuru.tz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  try {
    // --- Handle preflight OPTIONS requests first ---
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- Only allow POST ---
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // --- Parse incoming JSON ---
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: "Missing or invalid 'messages' array" }, 400);
    }

    console.log("Received chat request with messages:", messages);

    // --- Load API key from environment ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    // --- System prompt ---
    const systemPrompt = `You are Nuru AI Assistant, a friendly helper for the Nuru event planning platform.

Communication Style:
- Be warm, conversational, and human-like
- Use simple, everyday language
- Keep responses SHORT and to the point
- Only provide detailed steps when asked "how to"
- Be encouraging and supportive
- If unsure, say "I'm not sure, but I can help with..."

About Nuru:
Nuru is a comprehensive event management platform designed for Tanzanian communities. It helps users plan and manage events like weddings, birthdays, graduations, memorials, and corporate events.

Key Features:
1. Event Planning: Budgets, guest lists, timelines
2. Service Marketplace: Connect with verified providers
3. Service Verification: Ensure credibility
4. My Services: Manage listings, bookings, performance
5. Contributions & Pledges: Collect money or items
6. Committee Management: Assign roles and responsibilities
7. Invitations: Digital invitations and RSVPs
8. Social Feed: Updates and community interaction
9. Messaging: Chat with providers and participants
10. Payments: Process payments in Tanzanian Shillings (TZS)

Be friendly, helpful, and provide clear answers.`;

    console.log("Calling Lovable AI Gateway...");

    // --- Call AI API ---
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      let message = "Unknown error";
      if (response.status === 429) message = "Rate limit exceeded. Please try again later.";
      if (response.status === 402) message = "Payment required. Please contact support.";

      return jsonResponse({ error: message }, response.status);
    }

    // --- Stream response ---
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("Chat error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
