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
      name: "get_my_events",
      description:
        "Get the signed-in user's Nuru events across organiser, invited guest, committee member, contributor, and ticket-holder contexts. Use this for 'my events', 'remind me my events', 'events I am part of', 'upcoming events', or event-related reminders.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            description:
              "Optional scope: all, organising, invited, committee, contributions, tickets. Default all.",
          },
          limit: {
            type: "number",
            description: "Max events to return per source (default 8)",
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
  {
    type: "function" as const,
    function: {
      name: "get_my_contribution_progress",
      description:
        "Get the signed-in user's contribution progress for events they have been listed as a contributor on. Use when the user asks 'how much have I paid', 'my pledge', 'my contribution progress', or wants a status of what they owe vs paid.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "Optional event UUID to filter to one event. Omit to return all events the user contributes to.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_my_tickets",
      description:
        "Get the signed-in user's purchased / claimed event tickets. Use when the user asks 'my tickets', 'show my tickets', 'recent tickets', or wants to find a ticket they own.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max tickets (default 10)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_user_input",
      description:
        "Ask the user for a single piece of information BEFORE you can answer (e.g. which event, which date, an amount, a phone number). Use only when you genuinely need the value to proceed; never use it as a greeting. The UI renders an inline input the user can fill and submit.",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", description: "Logical field id, e.g. 'event_id', 'amount', 'phone'." },
          label: { type: "string", description: "Short human prompt shown above the input." },
          input_type: {
            type: "string",
            description: "One of: text, number, phone, email, date.",
          },
          placeholder: { type: "string", description: "Optional placeholder hint." },
        },
        required: ["field", "label"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_user_inputs",
      description:
        "Ask the user for MULTIPLE pieces of information at once in a single inline form (like a Lovable-style choice popup). Use this whenever you need 2+ values before you can answer — for example budget setup (event_type + guest_count + tier), reminder scheduling, or event creation. Each option entry can be either a free-text input or a multiple-choice picker. The UI renders a single card with all fields; on submit the values are sent back as a labelled message.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short header above the form." },
          fields: {
            type: "array",
            description: "Array of input fields to render in the form.",
            items: {
              type: "object",
              properties: {
                field: { type: "string", description: "Logical id, e.g. 'event_type', 'guest_count', 'tier'." },
                label: { type: "string", description: "Human label shown next to/above the input." },
                input_type: {
                  type: "string",
                  description: "One of: text, number, phone, email, date, choice.",
                },
                placeholder: { type: "string" },
                options: {
                  type: "array",
                  description: "Required when input_type is 'choice'. Each option is a short label.",
                  items: { type: "string" },
                },
                default: { type: "string", description: "Optional default value." },
                required: { type: "boolean" },
              },
              required: ["field", "label"],
            },
          },
          submit_label: { type: "string", description: "Optional CTA label. Default: 'Continue'." },
        },
        required: ["fields"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_confirmation",
      description:
        "Ask the user to confirm Yes/No before performing an irreversible or sensitive action (e.g. 'Send reminder to 12 contributors?', 'Cancel ticket?'). The UI renders inline Yes/No buttons.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The Yes/No question to display." },
          action_id: { type: "string", description: "Logical action identifier you'll branch on after confirmation." },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "render_table",
      description:
        "Render arbitrary tabular data the user asked for as a clean table card (NOT inline markdown). Prefer this over markdown tables when you have ≥3 rows of structured data.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Table title shown above the grid." },
          headers: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            description: "Array of row arrays; each row length must equal headers length.",
            items: { type: "array", items: { type: "string" } },
          },
        },
        required: ["headers", "rows"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_my_profile",
      description:
        "Get the signed-in user's own Nuru profile: name, username, email, phone, location, verification status, member-since date. Use when the user asks about themselves ('my profile', 'my account', 'my email', 'my phone', 'who am I').",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_platform_info",
      description:
        "Return general public information about the Nuru platform itself — how it works, where it operates, support/contact channels, payments, vendor coverage, privacy. Use for questions like 'how do I contact Nuru', 'where is Nuru available', 'what does Nuru do', 'how do payments work'.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "One of: general, contact, support, payments, vendors, privacy, location. Default: general.",
          },
        },
      },
    },
  },
];
