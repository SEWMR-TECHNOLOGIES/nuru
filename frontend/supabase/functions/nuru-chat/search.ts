// Search functions that query the real Nuru backend API

const API_BASE = Deno.env.get("NURU_API_BASE_URL") || "";

async function apiFetch(path: string, authHeader?: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  console.log(`[RAG] Fetching: ${url}`);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;

  const res = await fetch(url, {
    method: "GET",
    headers,
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
  const rawQ = String(args.q || "").trim();
  const broadProviderQuery = /^(service providers?|providers?|vendors?|services?|find vendors?|find service providers?|show vendors?|show service providers?)$/i.test(rawQ);
  if (rawQ && !broadProviderQuery) params.q = rawQ;
  if (args.category) params.category = args.category;
  if (args.location) params.location = args.location;

  const data = await apiFetch(`/services${buildQS(params)}`);
  if (!data) return "I could not reach the service database right now. Please try again shortly.";

  const services = data?.data?.services || data?.services || [];
  if (services.length === 0) {
    return `No services found matching your search. Try broadening your criteria or checking available categories.`;
  }

  const items = services.map((s: any) => {
    const ratingValue = s.average_rating ?? s.avg_rating ?? s.rating;
    const rating = ratingValue != null && Number(ratingValue) > 0
      ? `${Number(ratingValue).toFixed(1)} rating, ${s.reviews_count || s.total_reviews || s.review_count || 0} reviews`
      : "No reviews yet";
    const price = s.min_price && s.max_price
      ? `${s.currency || "TZS"} ${Number(s.min_price).toLocaleString()} to ${Number(s.max_price).toLocaleString()}`
      : s.price_range || "Price on request";
    return {
      title: s.title || s.name || "Service provider",
      subtitle: s.category_name || s.service_category?.name || s.service_type?.name || s.service_type_name || "Service",
      meta: [s.location, rating, price].filter(Boolean).join(" • "),
      badge: s.verified || s.verification_status === "verified" ? "Verified" : null,
    };
  });
  return `Found ${items.length} Nuru service provider${items.length === 1 ? "" : "s"}:` +
    cardBlock("results_list", { title: "Service providers", icon: "service", items });
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

  const items = events.map((e: any) => ({
    title: e.title || e.name || "Event",
    subtitle: e.event_type?.name || e.event_type_name || "Public event",
    meta: [e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : null, e.location].filter(Boolean).join(" • "),
    badge: e.status || null,
  }));
  return `Found ${items.length} public Nuru event${items.length === 1 ? "" : "s"}:` +
    cardBlock("results_list", { title: "Public events", icon: "event", items });
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

  const items = people.map((p: any) => ({
    title: p.full_name || p.name || "Nuru user",
    subtitle: p.username ? `@${p.username}` : "Nuru profile",
    meta: p.is_verified ? "Verified account" : "Profile",
    badge: p.is_verified ? "Verified" : null,
  }));
  return `Found ${items.length} Nuru profile${items.length === 1 ? "" : "s"}:` +
    cardBlock("results_list", { title: "People", icon: "person", items });
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
export async function executeTool(
  name: string,
  args: any,
  authHeader?: string,
): Promise<string> {
  switch (name) {
    case "search_services":
      return searchServices(args);
    case "search_events":
      return searchEvents(args);
    case "get_my_events":
      return getMyEvents(args, authHeader);
    case "search_people":
      return searchPeople(args);
    case "get_service_categories":
      return getServiceCategories();
    case "get_event_types":
      return getEventTypes();
    case "create_event_budget":
      return createEventBudget(args);
    case "get_my_contribution_progress":
      return getMyContributionProgress(args, authHeader);
    case "get_my_tickets":
      return getMyTickets(args, authHeader);
    case "request_user_input":
      return renderUserInputCard(args);
    case "request_confirmation":
      return renderConfirmCard(args);
    case "render_table":
      return renderTableCard(args);
    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── New handlers ──────────────────────────────────────────────

function fmtTzs(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!isFinite(v)) return "TZS 0";
  return `TZS ${v.toLocaleString()}`;
}

function cardBlock(kind: string, payload: unknown): string {
  // Mobile/web clients parse fenced ```nuru-card:<kind>\n<json>\n``` blocks
  // out of the assistant's text and render them as rich UI cards.
  return "\n\n```nuru-card:" + kind + "\n" + JSON.stringify(payload) + "\n```\n";
}

function eventName(e: any): string {
  return e?.title || e?.name || e?.event_name || e?.event?.title || e?.event?.name || "Event";
}

function eventDate(e: any): string | null {
  return e?.start_date || e?.event_date || e?.event?.start_date || null;
}

function eventLocation(e: any): string | null {
  return e?.location || e?.venue || e?.event?.location || e?.event?.venue || null;
}

function normalizeEvent(raw: any, role: string): Record<string, unknown> {
  const e = raw?.event && typeof raw.event === "object" ? raw.event : raw;
  return {
    id: String(raw?.event_id || e?.id || raw?.id || ""),
    title: eventName(e),
    role,
    start_date: eventDate(e),
    start_time: e?.start_time || raw?.start_time || null,
    location: eventLocation(e),
    status: e?.status || raw?.status || null,
    type: e?.event_type?.name || raw?.event_type?.name || raw?.event_type_name || null,
  };
}

function extractList(data: any, ...keys: string[]): any[] {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], data);
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export async function getMyEvents(args: any, authHeader?: string): Promise<string> {
  if (!authHeader) {
    return "I need you to be signed in to look up your Nuru events. Please sign in and try again.";
  }
  const limit = Math.max(1, Math.min(Number(args?.limit || 8), 20));
  const scope = String(args?.scope || "all").toLowerCase();
  const requests: Array<{ key: string; role: string; path: string }> = [];
  if (scope === "all" || scope === "organising" || scope === "organizing") {
    requests.push({ key: "organising", role: "Organiser", path: `/user-events?page=1&limit=${limit}&sort_by=start_date&sort_order=asc` });
  }
  if (scope === "all" || scope === "invited") {
    requests.push({ key: "invited", role: "Invited", path: `/user-events/invited?page=1&limit=${limit}` });
  }
  if (scope === "all" || scope === "committee") {
    requests.push({ key: "committee", role: "Committee", path: `/user-events/committee?page=1&limit=${limit}` });
  }
  if (scope === "all" || scope === "contributions") {
    requests.push({ key: "contributions", role: "Contributor", path: `/user-contributors/my-contributions` });
  }
  if (scope === "all" || scope === "tickets") {
    requests.push({ key: "tickets", role: "Ticket holder", path: `/ticketing/my-tickets?limit=${limit}` });
  }

  const results = await Promise.all(requests.map(async (r) => ({ ...r, data: await apiFetch(r.path, authHeader) })));
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of results) {
    if (!r.data) continue;
    const rows = extractList(r.data, "data.events", "events", "data.tickets", "tickets", "data.items", "items");
    for (const raw of rows) {
      const item = normalizeEvent(raw, r.role);
      const id = String(item.id || `${item.title}-${item.start_date}-${r.key}`);
      const existing = byId.get(id);
      if (existing) {
        const roles = new Set(String(existing.role || "").split(", ").filter(Boolean));
        roles.add(r.role);
        existing.role = Array.from(roles).join(", ");
      } else {
        byId.set(id, item);
      }
    }
  }

  const items = Array.from(byId.values()).sort((a, b) => {
    const ad = a.start_date ? Date.parse(String(a.start_date)) : Number.MAX_SAFE_INTEGER;
    const bd = b.start_date ? Date.parse(String(b.start_date)) : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  }).slice(0, limit);

  if (items.length === 0) {
    return "I could not find Nuru events linked to your account yet. Try checking tickets, invitations, contributions, or events you organise.";
  }
  return `Here ${items.length === 1 ? "is" : "are"} your Nuru event${items.length === 1 ? "" : "s"}:` + cardBlock("events_list", { items });
}

export async function getMyContributionProgress(args: any, authHeader?: string): Promise<string> {
  if (!authHeader) {
    return "I need you to be signed in to look up your contributions. Please sign in and try again.";
  }
  const data = await apiFetch(`/user-contributors/my-contributions`, authHeader);
  if (!data) return "I could not load your contributions right now. Please try again shortly.";

  // Backend returns { events: [...], count, summary }
  const items: any[] = data?.data?.events || data?.events || data?.data?.items || data?.items || [];
  let list = Array.isArray(items) ? items : [];
  if (args?.event_id) {
    list = list.filter((r: any) => String(r.event_id || r.event?.id) === String(args.event_id));
  }
  if (list.length === 0) {
    return "You don't have any contribution records yet.";
  }

  let text = `Here ${list.length === 1 ? "is your" : "are your"} contribution${list.length === 1 ? "" : "s"}:\n`;
  for (const row of list.slice(0, 6)) {
    const pledged = Number(row.pledge_amount ?? row.pledged_amount ?? row.amount_pledged ?? 0);
    const paid = Number(row.total_paid ?? row.paid_amount ?? row.amount_paid ?? 0);
    const pct = pledged > 0 ? Math.min(100, Math.round((paid / pledged) * 100)) : 0;
    const eventName = row.event_name || row.event_title || row.event?.name || row.event?.title || "Event";
    text += cardBlock("contribution_progress", {
      event_id: row.event_id || row.event?.id || null,
      event_name: eventName,
      paid,
      pledged,
      percent: pct,
      currency: row.currency || "TZS",
    });
  }
  return text;
}

export async function getMyTickets(args: any, authHeader?: string): Promise<string> {
  if (!authHeader) {
    return "I need you to be signed in to look up your tickets. Please sign in and try again.";
  }
  const limit = args?.limit || 10;
  const data = await apiFetch(`/ticketing/my-tickets?limit=${limit}`, authHeader);
  if (!data) return "I could not load your tickets right now. Please try again shortly.";

  const tickets: any[] =
    data?.data?.tickets || data?.tickets ||
    data?.data?.items || data?.items ||
    (Array.isArray(data?.data) ? data.data : []);
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return "You don't have any tickets yet.";
  }

  // Group by event
  const grouped: Record<string, { event_id: string; event_name: string; date: string | null; count: number }> = {};
  for (const t of tickets) {
    const ev = t.event || {};
    const eid = String(t.event_id || ev.id || "");
    const name = ev.name || t.event_title || ev.title || t.event_name || "Event";
    const date = ev.start_date || t.event_date || t.start_date || null;
    if (!grouped[eid]) {
      grouped[eid] = { event_id: eid, event_name: name, date, count: 0 };
    }
    grouped[eid].count += Number(t.quantity || 1);
  }

  const items = Object.values(grouped);
  let text = `Here are your recent tickets:\n`;
  text += cardBlock("tickets_list", { items });
  return text;
}

export function renderUserInputCard(args: any): string {
  return cardBlock("input_prompt", {
    field: String(args?.field || "value"),
    label: String(args?.label || "Please provide a value"),
    input_type: String(args?.input_type || "text"),
    placeholder: args?.placeholder ? String(args.placeholder) : null,
  });
}

export function renderConfirmCard(args: any): string {
  return cardBlock("confirm_action", {
    question: String(args?.question || "Are you sure?"),
    action_id: args?.action_id ? String(args.action_id) : null,
  });
}

export function renderTableCard(args: any): string {
  const headers = Array.isArray(args?.headers) ? args.headers.map(String) : [];
  const rows = Array.isArray(args?.rows) ? args.rows.map((r: any[]) => (Array.isArray(r) ? r.map(String) : [])) : [];
  return cardBlock("table", {
    title: args?.title ? String(args.title) : null,
    headers,
    rows,
  });
}
