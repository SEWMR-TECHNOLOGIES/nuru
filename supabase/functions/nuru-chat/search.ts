// Search functions that query the real Nuru backend API

const API_BASE = Deno.env.get("NURU_API_BASE_URL") || "";

async function apiFetch(path: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  console.log(`[RAG] Fetching: ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[RAG] API error ${res.status}: ${text}`);
    return null;
  }

  return res.json();
}

function buildQS(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ---- Tool executors ----

export async function searchServices(args: any): Promise<string> {
  const params: Record<string, any> = { limit: args.limit || 10 };
  if (args.q) params.q = args.q;
  if (args.category) params.category = args.category;
  if (args.location) params.location = args.location;

  const data = await apiFetch(`/services${buildQS(params)}`);
  if (!data) return "I could not reach the service database right now. Please try again shortly.";

  const services = data?.data?.services || data?.services || [];
  if (services.length === 0) {
    return `No services found matching your search. Try broadening your criteria or checking available categories.`;
  }

  let result = `Found ${services.length} service(s):\n\n`;
  result += "| # | Service | Category | Location | Rating | Price Range | Verified |\n";
  result += "|---|---------|----------|----------|--------|-------------|----------|\n";

  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const name = s.title || s.name || "Unnamed";
    const cat = s.category_name || s.service_category?.name || s.service_type_name || "-";
    const loc = s.location || "-";

    // Fix rating: use average_rating first, then rating, and format properly
    let rating = "-";
    const ratingValue = s.average_rating ?? s.avg_rating ?? s.rating;
    if (ratingValue != null && ratingValue > 0) {
      rating = `${Number(ratingValue).toFixed(1)} ⭐ (${s.reviews_count || s.total_reviews || 0} reviews)`;
    } else {
      rating = "No reviews yet";
    }

    const price =
      s.min_price && s.max_price
        ? `${(s.currency || "TZS")} ${Number(s.min_price).toLocaleString()} - ${Number(s.max_price).toLocaleString()}`
        : s.price_range || "-";
    const verified = s.verified || s.verification_status === "verified" ? "✅ Yes" : "No";
    result += `| ${i + 1} | ${name} | ${cat} | ${loc} | ${rating} | ${price} | ${verified} |\n`;
  }

  return result;
}

export async function searchEvents(args: any): Promise<string> {
  const params: Record<string, any> = {
    limit: args.limit || 10,
    status: "published", // Only return published events
  };
  if (args.q) params.q = args.q;

  const data = await apiFetch(`/events${buildQS(params)}`);
  if (!data) return "I could not reach the events database right now. Please try again shortly.";

  const events = data?.data?.events || data?.events || [];
  if (events.length === 0) {
    return "No published events found matching your search.";
  }

  let result = `Found ${events.length} published event(s):\n\n`;
  result += "| # | Event | Type | Date | Location |\n";
  result += "|---|-------|------|------|----------|\n";

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const name = e.title || "Untitled";
    const type = e.event_type?.name || e.event_type_name || "-";
    const date = e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "-";
    const loc = e.location || "-";
    result += `| ${i + 1} | ${name} | ${type} | ${date} | ${loc} |\n`;
  }

  return result;
}

export async function searchPeople(args: any): Promise<string> {
  const params: Record<string, any> = { limit: args.limit || 10 };
  if (args.q) params.q = args.q;

  const data = await apiFetch(`/users/search${buildQS(params)}`);
  if (!data) return "I could not reach the user database right now. Please try again shortly.";

  const people = data?.data?.items || data?.items || [];
  if (people.length === 0) {
    return "No people found matching your search.";
  }

  let result = `Found ${people.length} person(s):\n\n`;
  result += "| # | Name | Username | Verified |\n";
  result += "|---|------|----------|----------|\n";

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const name = p.full_name || "-";
    const username = p.username ? `@${p.username}` : "-";
    const verified = p.is_verified ? "✅ Yes" : "No";
    result += `| ${i + 1} | ${name} | ${username} | ${verified} |\n`;
  }

  return result;
}

export async function getServiceCategories(): Promise<string> {
  const data = await apiFetch("/services/categories");
  if (!data) return "I could not fetch service categories right now.";

  const categories = data?.data?.categories || data?.categories || data?.data || [];
  if (!Array.isArray(categories) || categories.length === 0) {
    return "No service categories found.";
  }

  let result = "Available service categories on Nuru:\n\n";
  for (const c of categories) {
    const name = typeof c === "string" ? c : c.name || c.title || JSON.stringify(c);
    result += `- ${name}\n`;
  }

  return result;
}

export async function getEventTypes(): Promise<string> {
  const data = await apiFetch("/events/types");
  if (!data) return "I could not fetch event types right now.";

  const types = data?.data?.event_types || data?.event_types || data?.data || [];
  if (!Array.isArray(types) || types.length === 0) {
    return "No event types found.";
  }

  let result = "Available event types on Nuru:\n\n";
  for (const t of types) {
    const name = typeof t === "string" ? t : t.name || t.title || JSON.stringify(t);
    result += `- ${name}\n`;
  }

  return result;
}

// Budget generation logic
export function createEventBudget(args: any): string {
  const eventType = (args.event_type || "event").toLowerCase();
  const guests = args.guest_count || 100;
  const tier = (args.budget_range || "medium").toLowerCase();
  const location = args.location || "Dar es Salaam";

  // Price multipliers by tier
  const multiplier = tier === "low" ? 0.6 : tier === "high" ? 1.8 : 1;

  // Base budget templates per event type (medium tier, 100 guests, in TZS)
  const templates: Record<string, { category: string; item: string; base: number; perGuest: boolean }[]> = {
    wedding: [
      { category: "Venue", item: "Reception Hall", base: 2000000, perGuest: false },
      { category: "Venue", item: "Ceremony Venue", base: 800000, perGuest: false },
      { category: "Catering", item: "Food & Beverages", base: 25000, perGuest: true },
      { category: "Catering", item: "Wedding Cake", base: 500000, perGuest: false },
      { category: "Photography", item: "Photo & Video Package", base: 1500000, perGuest: false },
      { category: "Decoration", item: "Flowers & Decor", base: 1200000, perGuest: false },
      { category: "Entertainment", item: "DJ / Band", base: 800000, perGuest: false },
      { category: "Attire", item: "Bride & Groom Outfits", base: 2000000, perGuest: false },
      { category: "Transportation", item: "Bridal Car & Transport", base: 600000, perGuest: false },
      { category: "MC", item: "Master of Ceremonies", base: 500000, perGuest: false },
      { category: "Stationery", item: "Invitations & Programs", base: 3000, perGuest: true },
      { category: "Miscellaneous", item: "Gifts & Favors", base: 5000, perGuest: true },
    ],
    birthday: [
      { category: "Venue", item: "Party Venue", base: 800000, perGuest: false },
      { category: "Catering", item: "Food & Drinks", base: 15000, perGuest: true },
      { category: "Catering", item: "Birthday Cake", base: 200000, perGuest: false },
      { category: "Decoration", item: "Balloons & Decor", base: 300000, perGuest: false },
      { category: "Entertainment", item: "DJ / Music", base: 400000, perGuest: false },
      { category: "Photography", item: "Photographer", base: 500000, perGuest: false },
      { category: "Miscellaneous", item: "Party Favors", base: 3000, perGuest: true },
    ],
    corporate: [
      { category: "Venue", item: "Conference Hall", base: 3000000, perGuest: false },
      { category: "Catering", item: "Meals & Refreshments", base: 20000, perGuest: true },
      { category: "Audio/Visual", item: "AV Equipment & Setup", base: 1500000, perGuest: false },
      { category: "Decoration", item: "Branding & Signage", base: 800000, perGuest: false },
      { category: "Stationery", item: "Printed Materials", base: 5000, perGuest: true },
      { category: "Entertainment", item: "Guest Speaker / MC", base: 1000000, perGuest: false },
      { category: "Photography", item: "Event Coverage", base: 800000, perGuest: false },
      { category: "Transportation", item: "Shuttle Service", base: 500000, perGuest: false },
    ],
    graduation: [
      { category: "Venue", item: "Celebration Venue", base: 1000000, perGuest: false },
      { category: "Catering", item: "Food & Drinks", base: 18000, perGuest: true },
      { category: "Decoration", item: "Decor & Setup", base: 500000, perGuest: false },
      { category: "Photography", item: "Photo & Video", base: 700000, perGuest: false },
      { category: "Entertainment", item: "DJ / Music", base: 400000, perGuest: false },
      { category: "Stationery", item: "Invitations", base: 2000, perGuest: true },
    ],
  };

  // Fall back to a generic template
  const generic = [
    { category: "Venue", item: "Event Venue", base: 1500000, perGuest: false },
    { category: "Catering", item: "Food & Beverages", base: 20000, perGuest: true },
    { category: "Decoration", item: "Decor & Setup", base: 600000, perGuest: false },
    { category: "Entertainment", item: "Entertainment", base: 500000, perGuest: false },
    { category: "Photography", item: "Photography", base: 600000, perGuest: false },
    { category: "Miscellaneous", item: "Other Costs", base: 300000, perGuest: false },
  ];

  const items = templates[eventType] || generic;

  let result = `## 💰 ${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Budget Estimate\n`;
  result += `📍 ${location} · 👥 ${guests} guests · ${tier === "low" ? "💚 Budget" : tier === "high" ? "💎 Premium" : "⭐ Standard"}\n\n`;
  result += "| Category | Item | Estimated Cost (TZS) |\n";
  result += "|----------|------|---------------------:|\n";

  let total = 0;
  for (const item of items) {
    const cost = Math.round((item.perGuest ? item.base * guests : item.base) * multiplier);
    total += cost;
    result += `| ${item.category} | ${item.item} | ${cost.toLocaleString()} |\n`;
  }

  // Add contingency (10%)
  const contingency = Math.round(total * 0.1);
  total += contingency;
  result += `| **Contingency** | **10% buffer** | **${contingency.toLocaleString()}** |\n`;
  result += `| | **TOTAL** | **${total.toLocaleString()}** |\n\n`;

  result += `> 💡 This is an estimate based on ${location} market rates. Actual costs may vary. Use Nuru's budget tracking to manage your real expenses!`;

  return result;
}

// Execute a tool call by name
export async function executeTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "search_services":
      return searchServices(args);
    case "search_events":
      return searchEvents(args);
    case "search_people":
      return searchPeople(args);
    case "get_service_categories":
      return getServiceCategories();
    case "get_event_types":
      return getEventTypes();
    case "create_event_budget":
      return createEventBudget(args);
    default:
      return `Unknown tool: ${name}`;
  }
}
