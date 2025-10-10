// file: functions/nuru-chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

serve(async (req) => {
  const allowedOrigins = [
    "https://nuru.tz",
    "https://www.nuru.tz",
    "https://workspace.nuru.tz",
    "http://localhost:8080",
    "http://192.168.200.178:8080",
  ];

  const origin = (req.headers.get("origin") || "").trim();
  const isAllowedOrigin =
    allowedOrigins.includes(origin) ||
    /^https:\/\/(www\.)?nuru\.tz$/.test(origin) ||
    origin === "https://workspace.nuru.tz" ||
    origin === "http://localhost:8080" ||
    origin === "http://192.168.200.178:8080";

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "https://nuru.tz",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
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

    const { messages, firstName } = body;
    if (!messages || !Array.isArray(messages)) {
      console.error("❌ Missing or invalid 'messages' array");
      return jsonResponse({ error: "Missing or invalid 'messages' array" }, 400);
    }

    console.log("✅ Received chat request with messages:", messages);
    console.log("✅ User first name:", firstName);

    // --- Load API key from environment ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ LOVABLE_API_KEY is not configured");
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    // Initialize Supabase client for database queries
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);


    const systemPrompt = `You are Nuru AI Assistant, a friendly, professional, and helpful guide for the Nuru event planning platform.${firstName ? ` You are chatting with ${firstName}.` : ''}

    Communication Style:
    - Be warm, conversational, and human-like
    - Use simple, everyday language that Tanzanian users can easily understand
    - Keep responses concise but informative
    - Only provide step-by-step instructions when asked "how to"
    - Encourage users and be supportive
    - Admit if unsure but offer guidance or resources
    - When formatting data, use markdown tables for better readability

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

    Service Provider Recommendations:
    IMPORTANT: You have access to a tool called "search_service_providers" that lets you search the actual Nuru database for real service providers.
    
    When users ask about service providers, pricing, or recommendations:
    - Use the search_service_providers tool to look up actual providers based on category, location, or other criteria
    - Present the real provider names, ratings, locations, and price ranges from the database
    - Display results in a clear markdown table format
    - Recommend the top-rated and verified providers first
    - Suggest filtering by category (venues, catering, photography, videography, decorations, entertainment, etc.), location, and budget
    - Recommend comparing multiple providers and reading reviews before booking
    - Advise reaching out to providers directly through Nuru's messaging for quotes and availability
    - Always encourage booking early for better availability and prices
    - If no exact match is found, suggest similar categories or nearby locations

    Tips for users:
    - Always confirm service availability early.
    - Use Nuru to track budgets and avoid overspending.
    - Engage your committee for larger events for smooth coordination.
    - Encourage guests to RSVP digitally to reduce confusion.
    - Compare at least 3 service providers before making final decisions.
    - Check provider ratings and reviews on Nuru before booking.

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
        tools: [
          {
            type: "function",
            function: {
              name: "search_service_providers",
              description: "Search for service providers in the Nuru database. Returns real providers with their ratings, locations, and price ranges.",
              parameters: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "Service category (e.g., Photography, Catering, Venue, Decoration, Audio/Visual, Entertainment, Transportation, Flowers)",
                  },
                  location: {
                    type: "string",
                    description: "Location/city (e.g., Dar es Salaam, Arusha, Mwanza, Dodoma)",
                  },
                  min_rating: {
                    type: "number",
                    description: "Minimum rating filter (0-5)",
                  },
                  verified_only: {
                    type: "boolean",
                    description: "Show only verified providers",
                  },
                },
              },
            },
          },
        ],
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

    // --- Handle streaming with tool calls ---
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let toolCalls: any[] = [];
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Check for tool calls
                  if (parsed.choices?.[0]?.delta?.tool_calls) {
                    const calls = parsed.choices[0].delta.tool_calls;
                    for (const call of calls) {
                      if (call.function?.name === 'search_service_providers') {
                        const args = JSON.parse(call.function.arguments || '{}');
                        console.log('🔍 Searching service providers:', args);
                        
                        // Build query
                        let query = supabase.from('service_providers').select('*');
                        
                        if (args.category) {
                          query = query.ilike('category', `%${args.category}%`);
                        }
                        if (args.location) {
                          query = query.ilike('location', `%${args.location}%`);
                        }
                        if (args.min_rating) {
                          query = query.gte('rating', args.min_rating);
                        }
                        if (args.verified_only) {
                          query = query.eq('verified', true);
                        }
                        
                        query = query.order('rating', { ascending: false }).limit(10);
                        
                        const { data: providers, error } = await query;
                        
                        if (error) {
                          console.error('❌ Database error:', error);
                        } else {
                          console.log(`✅ Found ${providers?.length || 0} providers`);
                          
                          // Format results as markdown table
                          let result = '\n\nHere are the service providers I found:\n\n';
                          result += '| Name | Category | Location | Rating | Reviews | Price Range | Verified |\n';
                          result += '|------|----------|----------|--------|---------|-------------|----------|\n';
                          
                          for (const p of providers || []) {
                            result += `| ${p.name} | ${p.category} | ${p.location} | ${p.rating} ⭐ | ${p.reviews_count} | ${p.price_range} | ${p.verified ? '✓' : '-'} |\n`;
                          }
                          
                          result += '\n';
                          
                          // Send the result back as content
                          const contentChunk = {
                            choices: [{
                              delta: { content: result },
                              index: 0,
                            }]
                          };
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
                          continue;
                        }
                      }
                    }
                  }
                  
                  // Forward other data
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (e) {
                  // Invalid JSON, skip
                }
              }
            }
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.error(err);
        }
      },
    });

    console.log("✅ Streaming response with tool support to client");
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("❌ Chat error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});