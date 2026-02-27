// Tool definitions for the Nuru chatbot RAG system
// These tools let the AI search real data from the Nuru backend

export const chatTools = [
  {
    type: "function" as const,
    function: {
      name: "search_services",
      description:
        "Search for service providers on the Nuru platform. Use this when users ask about vendors, service providers, caterers, photographers, venues, decorators, DJs, or any event service. Returns real providers with ratings, pricing, and verification status.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "Search query text (e.g., 'photographer in Dar es Salaam', 'wedding venue', 'caterer')",
          },
          category: {
            type: "string",
            description:
              "Service category filter (e.g., Photography, Catering, Venue, Decoration, Audio/Visual, Entertainment, Transportation, Flowers, MC, Planning)",
          },
          location: {
            type: "string",
            description:
              "Location/city filter (e.g., Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar)",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_events",
      description:
        "Search for public events on the Nuru platform. Use this when users ask about upcoming events, conferences, weddings, birthdays, or any gatherings happening in Tanzania.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Search query for events (e.g., 'wedding in Dar', 'birthday party')",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_people",
      description:
        "Search for people/users on the Nuru platform. Use this when users ask to find someone, look up a person, or ask about a specific user on the platform.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Name, username, or keyword to search for",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_service_categories",
      description:
        "Get all available service categories on Nuru. Use when users ask what types of services are available, or want to browse categories.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_event_types",
      description:
        "Get all available event types on Nuru. Use when users ask what kinds of events they can create or plan.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_event_budget",
      description:
        "Generate a detailed event budget/cost estimate for the user. Use this when users ask to create a budget, estimate costs, or plan expenses for their event. Returns a structured budget breakdown with categories, items, and estimated costs in TZS.",
      parameters: {
        type: "object",
        properties: {
          event_type: {
            type: "string",
            description: "Type of event (e.g., 'wedding', 'birthday', 'corporate', 'graduation', 'conference')",
          },
          guest_count: {
            type: "number",
            description: "Expected number of guests (default 100)",
          },
          budget_range: {
            type: "string",
            description: "Budget tier: 'low' (budget-friendly), 'medium' (standard), 'high' (premium/luxury). Default: medium",
          },
          location: {
            type: "string",
            description: "City/location for pricing context (e.g., 'Dar es Salaam', 'Arusha'). Default: Dar es Salaam",
          },
        },
        required: ["event_type"],
      },
    },
  },
];
