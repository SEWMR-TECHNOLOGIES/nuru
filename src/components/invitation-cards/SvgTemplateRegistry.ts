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

export type EventCategory = 'wedding' | 'birthday' | 'sendoff' | 'corporate' | 'anniversary' | 'conference' | 'graduation' | 'memorial';

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
];

/** Map event types to their best-matching template categories */
const EVENT_TYPE_CATEGORY_MAP: Record<string, EventCategory[]> = {
  wedding: ['wedding'],
  birthday: ['birthday'],
  corporate: ['corporate'],
  memorial: ['memorial', 'anniversary'],
  anniversary: ['anniversary'],
  conference: ['conference', 'corporate'],
  graduation: ['birthday', 'corporate'],
  sendoff: ['sendoff'],
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
