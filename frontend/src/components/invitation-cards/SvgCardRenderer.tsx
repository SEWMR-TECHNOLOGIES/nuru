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

  // Name fields (legacy short-id mapping)
  if (fields.nameField) {
    if (fields.nameField === 'bride' || fields.nameField === 'honoree' || fields.nameField === 'couple') {
      replacements[fields.nameField] = data.guestName || '';
    } else if (fields.nameField === 'eventTitle') {
      replacements[fields.nameField] = data.eventTitle || '';
    }
  }
  if (fields.secondNameField && data.secondName &&
      (fields.secondNameField === 'groom')) {
    replacements[fields.secondNameField] = data.secondName;
  }
  if (fields.dateField) replacements[fields.dateField] = data.date || '';
  if (fields.timeField) replacements[fields.timeField] = data.time || '';
  if (fields.venueField) replacements[fields.venueField] = data.venue || '';
  if (fields.addressField) replacements[fields.addressField] = data.address || '';

  // Explicit fieldMap (purpose-numbered templates with fully-qualified IDs).
  // Only override when the caller actually supplied a value for that key —
  // empty strings fall back to whatever default text is baked into the SVG.
  if (template.fieldMap) {
    for (const [svgId, dataKey] of Object.entries(template.fieldMap)) {
      const v = (data as any)[dataKey];
      if (v && String(v).trim()) replacements[svgId] = String(v);
    }
  }

  // Editable copy overrides — match SVG <text id="..."> placeholders.
  if (overrides) {
    if (overrides.headline) replacements.headline = overrides.headline;
    if (overrides.sub_headline) replacements.sub_headline = overrides.sub_headline;
    if (overrides.host_line) replacements.host_line = overrides.host_line;
    if (overrides.body) replacements.body = overrides.body;
    if (overrides.footer_note) replacements.footer_note = overrides.footer_note;
    if (overrides.dress_code_label) replacements.dress_code_label = overrides.dress_code_label;
    if (overrides.rsvp_label) replacements.rsvp_label = overrides.rsvp_label;
    // Arbitrary id-keyed overrides (used by purpose-numbered templates).
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim() && (template.lockedFieldIds || []).indexOf(k) === -1) {
        replacements[k] = v;
      }
    }
  }

  // Never let a user-supplied override touch a locked branding field.
  for (const lockedId of template.lockedFieldIds || []) {
    delete replacements[lockedId];
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

  // Re-center text elements that must stay horizontally centered regardless
  // of content length. Rewrites text-anchor + transform to anchor at centerX.
  const vbWidth = template.viewBox?.width ?? 480;
  for (const c of template.centeredTextIds || []) {
    const cx = c.centerX ?? vbWidth / 2;
    const re = new RegExp(`<text\\b([^>]*\\bid="${c.id}"[^>]*)>`, 'g');
    svg = svg.replace(re, (_m, attrs: string) => {
      let a = attrs.replace(/\stext-anchor="[^"]*"/g, '');
      // Replace transform translate(x y) → translate(cx y)
      a = a.replace(/transform="translate\(([-\d.]+)\s+([-\d.]+)\)"/, (_m2, _x, y) => `transform="translate(${cx} ${y})"`);
      return `<text text-anchor="middle"${a}>`;
    });
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

  const vb = template.viewBox ?? { width: 480, height: 680 };

  return (
    <div className={className} ref={containerRef}>
      <div
        className="w-full relative"
        style={{ aspectRatio: `${vb.width}/${vb.height}` }}
      >
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
        {template.hasQr && (
          <QrOverlay
            svgHtml={processedSvg}
            qrValue={data.qrValue || 'NURU-PREVIEW'}
            viewBox={vb}
            placement={template.qrPlacement}
          />
        )}

      </div>
    </div>
  );
};

/**
 * Positions a real QR code canvas over the SVG placeholder QR area.
 * Two strategies:
 *  1. Explicit `placement` from the template (preferred for purpose-numbered templates).
 *  2. Fallback: detect a rect with `opacity="0.001"` marker (legacy templates).
 */
const QrOverlay = ({
  svgHtml,
  qrValue,
  viewBox,
  placement,
}: {
  svgHtml: string;
  qrValue: string;
  viewBox: { width: number; height: number };
  placement?: { x: number; y: number; width: number; height: number };
}) => {
  const qrPos = useMemo(() => {
    if (placement) return placement;
    // Legacy: opacity="0.001" marker rect inside the SVG.
    const rectRegex = /<rect\b([^>]*\bopacity="0\.001"[^>]*)\/>/g;
    const attrNum = (attrs: string, name: string): number | null => {
      const m = new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`).exec(attrs);
      return m ? parseFloat(m[1]) : null;
    };
    let match;
    while ((match = rectRegex.exec(svgHtml)) !== null) {
      const attrs = match[1];
      const x = attrNum(attrs, 'x');
      const y = attrNum(attrs, 'y');
      const w = attrNum(attrs, 'width');
      const h = attrNum(attrs, 'height');
      if (x === null || y === null || w === null || h === null) continue;
      return { x, y, width: w, height: h };
    }
    return null;
  }, [svgHtml, placement]);

  if (!qrPos) return null;

  const left = (qrPos.x / viewBox.width) * 100;
  const top = (qrPos.y / viewBox.height) * 100;
  const width = (qrPos.width / viewBox.width) * 100;
  const height = (qrPos.height / viewBox.height) * 100;

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
        bgColor={isDark ? '#111111' : '#ffffff'}
        fgColor={isDark ? '#c8a828' : '#111111'}
        level="M"
        marginSize={0}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default SvgCardRenderer;

