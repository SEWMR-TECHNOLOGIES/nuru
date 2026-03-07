/**
 * SvgCardRenderer
 * Takes an SVG template string and injects dynamic event/guest data
 * by replacing text content of elements with matching IDs.
 * QR code is rendered as a foreignObject replacing the placeholder QR group.
 */

import { useRef, useMemo, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { SvgCardTemplate } from './SvgTemplateRegistry';

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
  className?: string;
}

/**
 * Replace text content of SVG elements by their id attribute.
 * This modifies the raw SVG string before rendering.
 */
function injectDynamicData(svgRaw: string, template: SvgCardTemplate, data: SvgCardData): string {
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

  // Replace text content by id
  for (const [id, value] of Object.entries(replacements)) {
    if (!value) continue;
    // Match: <text ... id="<id>" ...>PLACEHOLDER</text>
    // Also match <text ... id="<id>">PLACEHOLDER</text> across multiple lines
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

const SvgCardRenderer = ({ template, data, className }: SvgCardRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const processedSvg = useMemo(
    () => injectDynamicData(template.svgRaw, template, data),
    [template, data]
  );

  return (
    <div className={className} ref={containerRef}>
      <div
        className="w-full"
        style={{ aspectRatio: '480/680' }}
        dangerouslySetInnerHTML={{ __html: processedSvg }}
      />
      {/* Overlay real QR code on top of the placeholder */}
      {data.qrValue && template.hasQr && (
        <QrOverlay svgHtml={processedSvg} qrValue={data.qrValue} />
      )}
    </div>
  );
};

/**
 * Positions a real QR code canvas over the SVG placeholder QR area.
 * The placeholder QR in the SVGs starts with a rect around x=204, y varies.
 * We find the QR placeholder rect position from the SVG and overlay our canvas.
 */
const QrOverlay = ({ svgHtml, qrValue }: { svgHtml: string; qrValue: string }) => {
  // Parse the QR placeholder rect position from the SVG
  // Look for the "SCAN" text to find QR area, or find the QR placeholder rect
  const qrPos = useMemo(() => {
    // Find the QR placeholder rect - typically: <rect x="204" y="556" width="72" height="72"
    // or similar positioned rect near the bottom of the SVG near "SCAN" text
    const rectRegex = /<rect\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"[^>]*(?:stroke[^>]*opacity[^>]*)\/>/g;
    let bestMatch: { x: number; y: number; w: number; h: number } | null = null;
    let match;

    // Find rect elements that look like QR containers (60-80px wide, positioned in lower half)
    while ((match = rectRegex.exec(svgHtml)) !== null) {
      const x = parseInt(match[1]);
      const y = parseInt(match[2]);
      const w = parseInt(match[3]);
      const h = parseInt(match[4]);
      if (w >= 60 && w <= 80 && h >= 50 && h <= 80 && y > 400) {
        bestMatch = { x, y, w, h };
        break;
      }
    }

    return bestMatch;
  }, [svgHtml]);

  if (!qrPos) return null;

  // Convert SVG coordinates to percentage positions
  const svgWidth = 480;
  const svgHeight = 680;
  const left = ((qrPos.x + 3) / svgWidth) * 100;
  const top = ((qrPos.y + 3) / svgHeight) * 100;
  const width = ((qrPos.w - 6) / svgWidth) * 100;
  const height = ((qrPos.h - 6) / svgHeight) * 100;

  // Determine background color from SVG (dark or light template)
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
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default SvgCardRenderer;
