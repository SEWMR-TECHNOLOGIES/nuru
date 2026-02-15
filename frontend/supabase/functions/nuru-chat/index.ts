import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatTools } from "./tools.ts";
import { executeTool } from "./search.ts";

const ALLOWED_ORIGINS = [
  "https://nuru.tz",
  "https://www.nuru.tz",
  "https://workspace.nuru.tz",
  "http://localhost:8080",
  "http://192.168.200.178:8080",
];

function getCorsHeaders(origin: string) {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/(www\.)?nuru\.tz$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://nuru.tz",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

const jsonRes = (cors: Record<string, string>, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = (firstName?: string) =>
  `You are Nuru AI Assistant, a friendly, professional, and helpful guide for the Nuru event planning platform.${firstName ? ` You are chatting with ${firstName}.` : ""}

Communication Style:
- Be warm, conversational, and human-like
- Use simple, everyday language that Tanzanian users can easily understand
- Keep responses concise but informative
- Only provide step-by-step instructions when asked "how to"
- Encourage users and be supportive
- When formatting data, use markdown tables for better readability
- Never mention technical details like "checking the database" or "running a search query". Just present the results naturally.

About Nuru:
Nuru is an all-in-one event management platform designed for Tanzanian communities. It helps users plan, manage, and execute events like weddings, birthdays, graduations, memorials, and corporate gatherings.

Key Features:
1. Event Planning: Create budgets, guest lists, and timelines.
2. Find Services: Connect with verified local providers (caterers, decorators, venues, photographers, etc.)
3. Contributions & Pledges: Collect funds or items for events smoothly.
4. Committee Management: Assign roles and responsibilities for large events.
5. Invitations: Send digital invitations, track RSVPs.
6. Social Feed: Share updates and photos.
7. Messaging: Chat securely with providers and participants.
8. Payments: Process payments safely in TZS.
9. NFC Nuru Cards: Tap-to-check-in at events.

IMPORTANT INSTRUCTIONS FOR TOOL USE:
- You have access to search tools that return REAL data from the Nuru platform.
- When users ask about service providers, pricing, or recommendations, ALWAYS use the search_services tool.
- When users ask about events, use the search_events tool.
- When users ask to find someone, use the search_people tool.
- When users want to know available categories, use get_service_categories.
- When users want to know event types, use get_event_types.
- Present search results naturally and recommend the best options.
- If no results are found, suggest alternatives or broader search terms.
- Always encourage users to compare providers, check reviews, and book early.`;

serve(async (req) => {
  const origin = (req.headers.get("origin") || "").trim();
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return jsonRes(cors, { error: "Method not allowed" }, 405);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonRes(cors, { error: "Invalid JSON body" }, 400);
    }

    const { messages, firstName } = body;
    if (!messages || !Array.isArray(messages)) {
      return jsonRes(cors, { error: "Missing or invalid 'messages' array" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonRes(cors, { error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    const aiHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };
    const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";

    // Build conversation with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT(firstName) },
      ...messages,
    ];

    // --- Step 1: Non-streaming call to detect tool calls ---
    console.log("[nuru-chat] Step 1: checking for tool calls...");
    const firstRes = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: fullMessages,
        tools: chatTools,
        stream: false,
      }),
    });

    if (!firstRes.ok) {
      const errText = await firstRes.text();
      console.error("[nuru-chat] AI error:", firstRes.status, errText);
      if (firstRes.status === 429) return jsonRes(cors, { error: "Rate limit exceeded. Please try again later." }, 429);
      if (firstRes.status === 402) return jsonRes(cors, { error: "Payment required. Please contact support." }, 402);
      return jsonRes(cors, { error: "AI service error" }, 500);
    }

    const firstData = await firstRes.json();
    const firstChoice = firstData.choices?.[0];
    const assistantMsg = firstChoice?.message;

    // --- Step 2: If tool calls, execute them and call AI again with results ---
    if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
      console.log(`[nuru-chat] Step 2: executing ${assistantMsg.tool_calls.length} tool call(s)...`);

      const toolResults: any[] = [];
      for (const tc of assistantMsg.tool_calls) {
        const fnName = tc.function?.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          fnArgs = {};
        }

        console.log(`[nuru-chat] Executing tool: ${fnName}`, fnArgs);
        const result = await executeTool(fnName, fnArgs);
        console.log(`[nuru-chat] Tool result length: ${result.length} chars`);

        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Build final messages: original + assistant tool call msg + tool results
      const finalMessages = [
        ...fullMessages,
        assistantMsg,
        ...toolResults,
      ];

      // --- Step 3: Stream the final response with tool results ---
      console.log("[nuru-chat] Step 3: streaming final response with tool results...");
      const streamRes = await fetch(aiUrl, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: finalMessages,
          stream: true,
        }),
      });

      if (!streamRes.ok) {
        const errText = await streamRes.text();
        console.error("[nuru-chat] Final stream error:", streamRes.status, errText);
        return jsonRes(cors, { error: "AI service error" }, 500);
      }

      return new Response(streamRes.body, {
        headers: { ...cors, "Content-Type": "text/event-stream" },
      });
    }

    // --- No tool calls: stream directly ---
    console.log("[nuru-chat] No tool calls, streaming direct response...");
    const streamRes = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: fullMessages,
        tools: chatTools,
        stream: true,
      }),
    });

    if (!streamRes.ok) {
      const errText = await streamRes.text();
      console.error("[nuru-chat] Stream error:", streamRes.status, errText);
      return jsonRes(cors, { error: "AI service error" }, 500);
    }

    return new Response(streamRes.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[nuru-chat] Error:", e);
    return jsonRes(cors, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
