/**
 * SVG Invitation Card Template Registry
 * Maps event types to built-in SVG card designs with dynamic field metadata.
 */

import template01 from '@/assets/card-templates/01-wedding-botanical.svg?raw';
import template02 from '@/assets/card-templates/02-birthday-constellation.svg?raw';
import template03 from '@/assets/card-templates/03-sendoff-terracotta.svg?raw';
import template04 from '@/assets/card-templates/04-wedding-darkpeony.svg?raw';
import template05 from '@/assets/card-templates/05-birthday-candle.svg?raw';
import template06 from '@/assets/card-templates/06-gala-geometric.svg?raw';
import template07 from '@/assets/card-templates/07-wedding-artnouveau.svg?raw';
import template08 from '@/assets/card-templates/08-sendoff-crane.svg?raw';
import template09 from '@/assets/card-templates/09-birthday-inkwash.svg?raw';
import template10 from '@/assets/card-templates/10-anniversary-magnolia.svg?raw';
import template11 from '@/assets/card-templates/11-corporate-monolith.svg?raw';
import template12 from '@/assets/card-templates/12-conference-summit.svg?raw';
import template13 from '@/assets/card-templates/13-graduation-laurel.svg?raw';
import template14 from '@/assets/card-templates/14-baby-balloon.svg?raw';
import template15 from '@/assets/card-templates/15-wedding-tropical.svg?raw';
import template16 from '@/assets/card-templates/16-birthday-confetti.svg?raw';
import template17 from '@/assets/card-templates/17-sendoff-twilight.svg?raw';
import template18 from '@/assets/card-templates/18-anniversary-golden.svg?raw';
import template19 from '@/assets/card-templates/19-memorial-olive.svg?raw';
import template20 from '@/assets/card-templates/20-festival-poster.svg?raw';
import template21 from '@/assets/card-templates/21-corporate-launch.svg?raw';
import template22 from '@/assets/card-templates/22-birthday-sunshine.svg?raw';
import template23 from '@/assets/card-templates/23-graduation-script.svg?raw';
import template24 from '@/assets/card-templates/24-graduation-bookstack.svg?raw';
import template25 from '@/assets/card-templates/25-baby-cloud.svg?raw';
import template26 from '@/assets/card-templates/26-baby-moon.svg?raw';
import template27 from '@/assets/card-templates/27-conference-grid.svg?raw';
import template28 from '@/assets/card-templates/28-memorial-stillwater.svg?raw';
import template29 from '@/assets/card-templates/29-anniversary-pearl.svg?raw';
import template30 from '@/assets/card-templates/30-sendoff-coast.svg?raw';

// For thumbnail display (URL imports)
import thumb01 from '@/assets/card-templates/01-wedding-botanical.svg';
import thumb02 from '@/assets/card-templates/02-birthday-constellation.svg';
import thumb03 from '@/assets/card-templates/03-sendoff-terracotta.svg';
import thumb04 from '@/assets/card-templates/04-wedding-darkpeony.svg';
import thumb05 from '@/assets/card-templates/05-birthday-candle.svg';
import thumb06 from '@/assets/card-templates/06-gala-geometric.svg';
import thumb07 from '@/assets/card-templates/07-wedding-artnouveau.svg';
import thumb08 from '@/assets/card-templates/08-sendoff-crane.svg';
import thumb09 from '@/assets/card-templates/09-birthday-inkwash.svg';
import thumb10 from '@/assets/card-templates/10-anniversary-magnolia.svg';
import thumb11 from '@/assets/card-templates/11-corporate-monolith.svg';
import thumb12 from '@/assets/card-templates/12-conference-summit.svg';
import thumb13 from '@/assets/card-templates/13-graduation-laurel.svg';
import thumb14 from '@/assets/card-templates/14-baby-balloon.svg';
import thumb15 from '@/assets/card-templates/15-wedding-tropical.svg';
import thumb16 from '@/assets/card-templates/16-birthday-confetti.svg';
import thumb17 from '@/assets/card-templates/17-sendoff-twilight.svg';
import thumb18 from '@/assets/card-templates/18-anniversary-golden.svg';
import thumb19 from '@/assets/card-templates/19-memorial-olive.svg';
import thumb20 from '@/assets/card-templates/20-festival-poster.svg';
import thumb21 from '@/assets/card-templates/21-corporate-launch.svg';
import thumb22 from '@/assets/card-templates/22-birthday-sunshine.svg';
import thumb23 from '@/assets/card-templates/23-graduation-script.svg';
import thumb24 from '@/assets/card-templates/24-graduation-bookstack.svg';
import thumb25 from '@/assets/card-templates/25-baby-cloud.svg';
import thumb26 from '@/assets/card-templates/26-baby-moon.svg';
import thumb27 from '@/assets/card-templates/27-conference-grid.svg';
import thumb28 from '@/assets/card-templates/28-memorial-stillwater.svg';
import thumb29 from '@/assets/card-templates/29-anniversary-pearl.svg';
import thumb30 from '@/assets/card-templates/30-sendoff-coast.svg';

export type EventCategory = 'wedding' | 'birthday' | 'sendoff' | 'corporate' | 'anniversary' | 'conference' | 'graduation' | 'memorial' | 'baby_shower';

export interface SvgCardTemplate {
  id: string;
  name: string;
  description: string;
  category: EventCategory[];
  svgRaw: string;
  thumbnailUrl: string;
  hasQr: boolean;
  /** Which text element IDs this template uses for dynamic fields */
  fields: {
    /** For wedding: bride name. For others: guest/honoree name */
    nameField: string;
    /** Second name field for weddings (groom) */
    secondNameField?: string;
    dateField?: string;
    timeField?: string;
    venueField?: string;
    addressField?: string;
  };
}

export const SVG_TEMPLATES: SvgCardTemplate[] = [
  {
    id: 'wedding-botanical',
    name: 'Botanical Garden',
    description: 'Elegant eucalyptus watercolour with gold accents on warm cream',
    category: ['wedding'],
    svgRaw: template01,
    thumbnailUrl: thumb01,
    hasQr: true,
    fields: { nameField: 'bride', secondNameField: 'groom', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'birthday-constellation',
    name: 'Constellation Night',
    description: 'Deep midnight sky with silver star constellations',
    category: ['birthday'],
    svgRaw: template02,
    thumbnailUrl: thumb02,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'sendoff-terracotta',
    name: 'Terracotta Arch',
    description: 'Warm terracotta arch with olive branch details',
    category: ['sendoff'],
    svgRaw: template03,
    thumbnailUrl: thumb03,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'wedding-darkpeony',
    name: 'Dark Peony',
    description: 'Dramatic moody florals with blush peonies on noir background',
    category: ['wedding'],
    svgRaw: template04,
    thumbnailUrl: thumb04,
    hasQr: true,
    fields: { nameField: 'bride', secondNameField: 'groom', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'memorial-candle',
    name: 'Candlelight Glow',
    description: 'Single elegant candle flame on deep forest green',
    category: ['memorial'],
    svgRaw: template05,
    thumbnailUrl: thumb05,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'gala-geometric',
    name: 'Geometric Diamond',
    description: 'Art deco geometric diamond on pure black with gold lines',
    category: ['corporate', 'conference'],
    svgRaw: template06,
    thumbnailUrl: thumb06,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'wedding-artnouveau',
    name: 'Art Nouveau Rose',
    description: 'Art Nouveau vine corners with rose buds on linen texture',
    category: ['wedding'],
    svgRaw: template07,
    thumbnailUrl: thumb07,
    hasQr: true,
    fields: { nameField: 'bride', secondNameField: 'groom', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'sendoff-crane',
    name: 'Origami Crane',
    description: 'Minimalist origami crane in gold on charcoal, Japanese inspired',
    category: ['sendoff'],
    svgRaw: template08,
    thumbnailUrl: thumb08,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue' },
  },
  {
    id: 'birthday-inkwash',
    name: 'Ink Wash Editorial',
    description: 'Abstract watercolour ink blots with editorial asymmetric layout',
    category: ['birthday'],
    svgRaw: template09,
    thumbnailUrl: thumb09,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'anniversary-magnolia',
    name: 'Magnolia Bloom',
    description: 'Luminous magnolia on deep teal with gold and ivory accents',
    category: ['anniversary'],
    svgRaw: template10,
    thumbnailUrl: thumb10,
    hasQr: true,
    fields: { nameField: 'couple', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'corporate-monolith',
    name: 'Monolith Black Tie',
    description: 'Architectural monolith on midnight navy with brushed-gold edge',
    category: ['corporate'],
    svgRaw: template11,
    thumbnailUrl: thumb11,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'conference-summit',
    name: 'Summit Editorial',
    description: 'Bold numeral statement on warm linen with deep forest accents',
    category: ['conference', 'corporate'],
    svgRaw: template12,
    thumbnailUrl: thumb12,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'graduation-laurel',
    name: 'Laurel & Cap',
    description: 'Classical laurel wreath with mortarboard on plum velvet',
    category: ['graduation'],
    svgRaw: template13,
    thumbnailUrl: thumb13,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'baby-balloon',
    name: 'Pastel Balloon',
    description: 'Hot-air balloon drifting through blush pastel skies',
    category: ['baby_shower'],
    svgRaw: template14,
    thumbnailUrl: thumb14,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'wedding-tropical',
    name: 'Tropical Coast',
    description: 'Hand-drawn palm canopy on warm sand for a coastal wedding',
    category: ['wedding'],
    svgRaw: template15,
    thumbnailUrl: thumb15,
    hasQr: true,
    fields: { nameField: 'bride', secondNameField: 'groom', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'birthday-confetti',
    name: 'Confetti Cake',
    description: 'Tiered cake with playful confetti on a soft blush blush ground',
    category: ['birthday'],
    svgRaw: template16,
    thumbnailUrl: thumb16,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'sendoff-twilight',
    name: 'Twilight Mountain',
    description: 'Moonrise over silhouetted ridges for a quiet farewell',
    category: ['sendoff'],
    svgRaw: template17,
    thumbnailUrl: thumb17,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'anniversary-golden',
    name: 'Golden Roman L',
    description: 'Roman numeral L with a heart for a fiftieth anniversary',
    category: ['anniversary'],
    svgRaw: template18,
    thumbnailUrl: thumb18,
    hasQr: true,
    fields: { nameField: 'couple', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'memorial-olive',
    name: 'Olive Wreath',
    description: 'Olive wreath on linen with quiet typographic dignity',
    category: ['memorial'],
    svgRaw: template19,
    thumbnailUrl: thumb19,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'festival-poster',
    name: 'Festival Poster',
    description: 'Editorial sun poster with hand-drawn frame for festivals',
    category: ['corporate'],
    svgRaw: template20,
    thumbnailUrl: thumb20,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'corporate-launch',
    name: 'Wireframe Launch',
    description: 'Wireframe sphere on deep emerald for product unveilings',
    category: ['corporate'],
    svgRaw: template21,
    thumbnailUrl: thumb21,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'birthday-sunshine',
    name: 'Sunshine Number',
    description: 'Big age numeral inside a sun for cheerful childrens birthdays',
    category: ['birthday'],
    svgRaw: template22,
    thumbnailUrl: thumb22,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'graduation-script',
    name: 'Script Honours',
    description: 'Navy and gold script honouring a new graduate',
    category: ['graduation'],
    svgRaw: template23,
    thumbnailUrl: thumb23,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'graduation-bookstack',
    name: 'Library Stack',
    description: 'Stacked books on linen for a scholarly send-off',
    category: ['graduation'],
    svgRaw: template24,
    thumbnailUrl: thumb24,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'baby-cloud',
    name: 'Soft Clouds',
    description: 'Drifting clouds in warm peach for a tender baby shower',
    category: ['baby_shower'],
    svgRaw: template25,
    thumbnailUrl: thumb25,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'baby-moon',
    name: 'Moon &amp; Stars',
    description: 'Gentle moon and stars for an evening baby celebration',
    category: ['baby_shower'],
    svgRaw: template26,
    thumbnailUrl: thumb26,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'conference-grid',
    name: 'Editorial Grid',
    description: 'Newsprint grid layout for serious conferences and summits',
    category: ['conference', 'corporate'],
    svgRaw: template27,
    thumbnailUrl: thumb27,
    hasQr: true,
    fields: { nameField: 'eventTitle', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'memorial-stillwater',
    name: 'Still Water',
    description: 'Single light over still water for a quiet remembrance',
    category: ['memorial'],
    svgRaw: template28,
    thumbnailUrl: thumb28,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'anniversary-pearl',
    name: 'Pearl Strand',
    description: 'Pearl strand and gold border for milestone anniversaries',
    category: ['anniversary'],
    svgRaw: template29,
    thumbnailUrl: thumb29,
    hasQr: true,
    fields: { nameField: 'couple', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
  {
    id: 'sendoff-coast',
    name: 'Sunset Coast',
    description: 'Warm sunset and sailboat for a coastal farewell',
    category: ['sendoff'],
    svgRaw: template30,
    thumbnailUrl: thumb30,
    hasQr: true,
    fields: { nameField: 'honoree', dateField: 'date', timeField: 'time', venueField: 'venue', addressField: 'address' },
  },
];

/** Editable copy fields persisted in events.invitation_content (JSONB).
 * Each maps to an SVG <text id="..."> placeholder in the template. */
export interface InvitationContent {
  headline?: string;
  sub_headline?: string;
  host_line?: string;
  body?: string;
  footer_note?: string;
  dress_code_label?: string;
  rsvp_label?: string;
}

/** Map event types to their best-matching template categories */
const EVENT_TYPE_CATEGORY_MAP: Record<string, EventCategory[]> = {
  wedding: ['wedding'],
  birthday: ['birthday'],
  corporate: ['corporate', 'conference'],
  memorial: ['memorial', 'anniversary'],
  anniversary: ['anniversary'],
  conference: ['conference', 'corporate'],
  graduation: ['graduation'],
  sendoff: ['sendoff'],
  babyshower: ['baby_shower'],
  productlaunch: ['corporate'],
  festival: ['corporate'],
  exhibition: ['corporate'],
  burial: ['memorial'],
};

/** Get templates matching an event type */
export function getTemplatesForEventType(eventType: string): SvgCardTemplate[] {
  const normalized = eventType.toLowerCase().replace(/[\s_-]+/g, '');
  const categories = EVENT_TYPE_CATEGORY_MAP[normalized] || ['wedding'];
  return SVG_TEMPLATES.filter(t => t.category.some(c => categories.includes(c)));
}

/** Pick a random template for a given event type */
export function getRandomTemplateForEvent(eventType: string): SvgCardTemplate {
  const matching = getTemplatesForEventType(eventType);
  if (matching.length === 0) return SVG_TEMPLATES[0];
  return matching[Math.floor(Math.random() * matching.length)];
}

/** Get a specific template by ID */
export function getTemplateById(id: string): SvgCardTemplate | undefined {
  return SVG_TEMPLATES.find(t => t.id === id);
}
