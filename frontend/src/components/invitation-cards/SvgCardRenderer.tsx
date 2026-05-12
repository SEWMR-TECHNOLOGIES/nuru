/**
 * SvgCardRenderer
 * Takes an SVG template string and injects dynamic event/guest data
 * by replacing text content of elements with matching IDs.
 * QR code is rendered as a foreignObject replacing the placeholder QR group.
 */

import { useRef, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { SvgCardTemplate, InvitationContent } from './SvgTemplateRegistry';

export interface SvgCardData {
  guestName: string;
  /** Second name for weddings (groom), or empty */
  secondName?: string;
  eventTitle: string;
  date: string;
  time: string;
  venue: string;
  address?: string;
  dressCode?: string;
  qrValue?: string;
}

interface SvgCardRendererProps {
  template: SvgCardTemplate;
  data: SvgCardData;
  /** Optional editable copy overrides loaded from events.invitation_content */
  contentOverrides?: InvitationContent | null;
  className?: string;
}

/**
 * Replace text content of SVG elements by their id attribute.
 * This modifies the raw SVG string before rendering.
 */
function injectDynamicData(
  svgRaw: string,
  template: SvgCardTemplate,
  data: SvgCardData,
  overrides?: InvitationContent | null,
): string {
  let svg = svgRaw;

  const replacements: Record<string, string> = {};
  const { fields } = template;

  // Name fields
  if (fields.nameField) {
    if (fields.nameField === 'bride' || fields.nameField === 'honoree' || fields.nameField === 'couple') {
      replacements[fields.nameField] = data.guestName || '';
    } else if (fields.nameField === 'eventTitle') {
      replacements[fields.nameField] = data.eventTitle || '';
    }
  }
  if (fields.secondNameField && data.secondName) {
    replacements[fields.secondNameField] = data.secondName;
  }
  if (fields.dateField) replacements[fields.dateField] = data.date || '';
  if (fields.timeField) replacements[fields.timeField] = data.time || '';
  if (fields.venueField) replacements[fields.venueField] = data.venue || '';
  if (fields.addressField) replacements[fields.addressField] = data.address || '';

  // Editable copy overrides — match SVG <text id="..."> placeholders.
  // Overrides win over template defaults so organisers can rewrite headline,
  // sub-headline, host line, footer note, dress code and rsvp label per event.
  if (overrides) {
    if (overrides.headline) replacements.headline = overrides.headline;
    if (overrides.sub_headline) replacements.sub_headline = overrides.sub_headline;
    if (overrides.host_line) replacements.host_line = overrides.host_line;
    if (overrides.body) replacements.body = overrides.body;
    if (overrides.footer_note) replacements.footer_note = overrides.footer_note;
    if (overrides.dress_code_label) replacements.dress_code_label = overrides.dress_code_label;
    if (overrides.rsvp_label) replacements.rsvp_label = overrides.rsvp_label;
  }

  // Replace text content by id
  for (const [id, value] of Object.entries(replacements)) {
    if (!value) continue;
    const regex = new RegExp(
      `(<text[^>]*\\bid="${id}"[^>]*>)([^<]*)(</text>)`,
      'g'
    );
    svg = svg.replace(regex, `$1${escapeXml(value)}$3`);
  }

  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const SvgCardRenderer = ({ template, data, contentOverrides, className }: SvgCardRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const processedSvg = useMemo(
    () => injectDynamicData(template.svgRaw, template, data, contentOverrides),
    [template, data, contentOverrides]
  );

  return (
    <div className={className} ref={containerRef}>
      <div
        className="w-full relative"
        style={{ aspectRatio: '480/680' }}
      >
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
        {data.qrValue && template.hasQr && (
          <QrOverlay svgHtml={processedSvg} qrValue={data.qrValue} />
        )}
      </div>
    </div>
  );
};

/**
 * Positions a real QR code canvas over the SVG placeholder QR area.
 * The placeholder QR in the SVGs starts with a rect around x=204, y varies.
 * We find the QR placeholder rect position from the SVG and overlay our canvas.
 */
const QrOverlay = ({ svgHtml, qrValue }: { svgHtml: string; qrValue: string }) => {
  const qrPos = useMemo(() => {
    // QR placeholders are uniquely marked with opacity="0.001".
    // Match any rect with that exact marker, regardless of attribute order.
    const rectRegex = /<rect\b([^>]*\bopacity="0\.001"[^>]*)\/>/g;
    const attrNum = (attrs: string, name: string): number | null => {
      const m = new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`).exec(attrs);
      return m ? parseFloat(m[1]) : null;
    };
    let bestMatch: { x: number; y: number; w: number; h: number } | null = null;
    let match;
    while ((match = rectRegex.exec(svgHtml)) !== null) {
      const attrs = match[1];
      const x = attrNum(attrs, 'x');
      const y = attrNum(attrs, 'y');
      const w = attrNum(attrs, 'width');
      const h = attrNum(attrs, 'height');
      if (x === null || y === null || w === null || h === null) continue;
      bestMatch = { x, y, w, h };
      break;
    }
    return bestMatch;
  }, [svgHtml]);

  if (!qrPos) return null;

  const svgWidth = 480;
  const svgHeight = 680;

  // Fill the placeholder square edge-to-edge — no inset, no quiet zone.
  const left = (qrPos.x / svgWidth) * 100;
  const top = (qrPos.y / svgHeight) * 100;
  const width = (qrPos.w / svgWidth) * 100;
  const height = (qrPos.h / svgHeight) * 100;

  const isDark = svgHtml.includes('stop-color="#08') || svgHtml.includes('stop-color="#0d') ||
    svgHtml.includes('stop-color="#0e') || svgHtml.includes('stop-color="#0a') ||
    svgHtml.includes('stop-color="#1a') || svgHtml.includes('stop-color="#14');

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      <QRCodeCanvas
        value={qrValue}
        size={256}
        bgColor={isDark ? '#111111' : '#f5f0e8'}
        fgColor={isDark ? '#c8a828' : '#3a2a18'}
        level="M"
        marginSize={0}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default SvgCardRenderer;
