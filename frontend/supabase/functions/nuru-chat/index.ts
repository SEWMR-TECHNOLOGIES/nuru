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
    /^https:\/\/(www\.)?nuru\.tz$/.test(origin) ||
    origin.includes("lovable.app");
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
  `You are Nuru AI Assistant — a concise, friendly guide for Nuru, Tanzania's event planning workspace.${firstName ? ` Chatting with ${firstName}.` : ""}

RESPONSE RULES (CRITICAL):
- Keep answers SHORT: 2-4 sentences for simple questions, max 6 for complex ones.
- Use bullet points only when listing 3+ items. Never use numbered lists for simple answers.
- Answer any Nuru-related question. That includes anything tied to the signed-in user (their events, tickets, contributions, pledges, payments, invitations, committees, saved vendors, profile, settings, notifications, support history) AND any public Nuru content (events, service providers, categories, people, platform guidance). Only refuse if the request is clearly unrelated to Nuru, then say you can only help with Nuru.
- Be proactive: if a user asks something broad like "what do I have on Nuru", "show me my stuff", "anything for me today", call the relevant my_* tools (get_my_events, get_my_tickets, get_my_contribution_progress) and summarise. Never tell the user to be more specific when a tool can fetch their data directly.
- Do NOT over-explain. Answer the question directly, then stop.
- Do NOT repeat what the user said back to them.
- Do NOT add unnecessary pleasantries or filler phrases like "Great question!" or "I'd be happy to help!"
- When showing tool results, preserve any nuru-card blocks exactly. Do not rewrite them as markdown tables.
- Never mention technical details like "checking the database" or "running a search query".
- NEVER say "let me search" or "give me a moment". Present results directly.

About Nuru:
All-in-one event management for Tanzania — planning, budgets, guest lists, contributions, committees, invitations, RSVPs, service providers, messaging, payments (TZS), NFC cards, and social feed.

TOOL USE:
- Service provider questions (vendor name, contact, phone, email, where they are, pricing) → search_services tool. Public vendor contact details (phone, email, location) ARE allowed to be shared because providers publish them on their profile. Quote them directly when asked.
- Broad service provider questions like "service providers", "vendors", "find vendors" → search_services with an empty q so Nuru returns verified providers instead of requiring an exact category.
- Event questions → search_events tool
- "My events", "remind me my events", "upcoming events I have", "events I organise", "events I joined", "committee events" → get_my_events tool
- People search → search_people tool
- Categories → get_service_categories
- Event types → get_event_types
- Budget/cost estimation → create_event_budget tool (ask for event type, guest count, and budget tier if not provided)
- "My contributions / how much have I paid / my pledge" → get_my_contribution_progress
- "My tickets / show my tickets" → get_my_tickets
- "My profile / my email / my phone / my account / who am I" → get_my_profile (own data only)
- General Nuru info ("how do I contact Nuru", "where is Nuru available", "how do payments work", "what is Nuru") → get_platform_info
- When you need ONE value before answering → request_user_input.
- When you need 2 OR MORE values (e.g. budget setup needs event_type + guest_count + tier; scheduling needs date + time + recipient_count) → ALWAYS call request_user_inputs with all fields at once instead of asking in plain text. Use input_type "choice" + options for short pickers (e.g. tier: low/medium/high).
- Before any irreversible action, call request_confirmation.
- Prefer Nuru rich cards from tools over markdown tables. Only call render_table for small structured comparisons that do not already have a dedicated Nuru card.
- Present results naturally. If none found, suggest alternatives briefly.

PRIVACY: Never expose another user's private phone, email, or address unless it appears in a public service-provider profile (search_services results) or in get_platform_info. Only share own-profile data via get_my_profile.`;

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

    const { messages, firstName, skipTools } = body;
    const incomingAuth = req.headers.get("authorization") || undefined;
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

    // Build conversation with system prompt (skip for budget assistant which provides its own)
    const fullMessages = skipTools
      ? [...messages]
      : [
          { role: "system", content: SYSTEM_PROMPT(firstName) },
          ...messages,
        ];

    // Use a custom SSE stream that shows tool-call progress inline
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const sendDelta = (content: string) => {
          sendSSE(JSON.stringify({
            choices: [{ delta: { content } }],
          }));
        };

        try {
          if (skipTools) {
            // Direct streaming without tool detection (used by Budget Assistant)
            console.log("[nuru-chat] skipTools mode: streaming directly...");
            const streamRes = await fetch(aiUrl, {
              method: "POST",
              headers: aiHeaders,
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: fullMessages,
                stream: true,
              }),
            });

            if (!streamRes.ok) {
              const errText = await streamRes.text();
              console.error("[nuru-chat] Stream error:", streamRes.status, errText);
              sendDelta("Sorry, I'm having trouble right now. Please try again.");
              sendSSE("[DONE]");
              controller.close();
              return;
            }

            const reader = streamRes.body!.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } else {
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
            sendDelta("I'm having trouble right now. Please try again in a moment.");
            sendSSE("[DONE]");
            controller.close();
            return;
          }

          const firstData = await firstRes.json();
          const firstChoice = firstData.choices?.[0];
          const assistantMsg = firstChoice?.message;

          // --- Step 2: If tool calls, show indicator, execute, then stream result ---
          if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
            console.log(`[nuru-chat] Step 2: executing ${assistantMsg.tool_calls.length} tool call(s)...`);

            // Send a searching indicator to the client
            sendSSE(JSON.stringify({
              choices: [{ delta: { content: "" } }],
              tool_status: "searching",
              tool_names: assistantMsg.tool_calls.map((tc: any) => tc.function?.name),
            }));

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
              const result = await executeTool(fnName, fnArgs, incomingAuth);
              console.log(`[nuru-chat] Tool result length: ${result.length} chars`);

              toolResults.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              });
            }

            // Signal that searching is complete
            sendSSE(JSON.stringify({
              choices: [{ delta: { content: "" } }],
              tool_status: "complete",
            }));

            // Build final messages
            const finalMessages = [
              ...fullMessages,
              assistantMsg,
              ...toolResults,
            ];

            // Stream the final response
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
              sendDelta("Sorry, I encountered an error processing the results. Please try again.");
              sendSSE("[DONE]");
              controller.close();
              return;
            }

            // Pipe the stream through
            const reader = streamRes.body!.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } else {
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
              sendDelta("Sorry, I'm having trouble right now. Please try again.");
              sendSSE("[DONE]");
              controller.close();
              return;
            }

            // Pipe the stream through
            const reader = streamRes.body!.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          }
        } catch (e) {
          console.error("[nuru-chat] Stream error:", e);
          sendDelta("Something went wrong. Please try again.");
          sendSSE("[DONE]");
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[nuru-chat] Error:", e);
    return jsonRes(cors, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
