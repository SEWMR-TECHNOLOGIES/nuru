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
  const qrPos = useMemo(() => {
    // Find all rect elements with stroke and opacity (QR container border rects)
    // Match rects like: <rect x="204" y="556" width="72" height="72" ... stroke ... opacity .../>
    const rectRegex = /<rect\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"[^>]*stroke[^>]*opacity[^>]*\/>/g;
    let bestMatch: { x: number; y: number; w: number; h: number } | null = null;
    let match;

    while ((match = rectRegex.exec(svgHtml)) !== null) {
      const x = parseInt(match[1]);
      const y = parseInt(match[2]);
      const w = parseInt(match[3]);
      const h = parseInt(match[4]);
      // QR containers are 60-80px wide, positioned in lower portion of the card
      if (w >= 60 && w <= 80 && h >= 50 && h <= 80 && y > 400) {
        bestMatch = { x, y, w, h };
        break;
      }
    }

    return bestMatch;
  }, [svgHtml]);

  if (!qrPos) return null;

  const svgWidth = 480;
  const svgHeight = 680;

  // Use the inner fill rect area (inset by 3px from the stroke border)
  const innerX = qrPos.x + 3;
  const innerY = qrPos.y + 3;
  const innerW = qrPos.w - 6;
  const innerH = qrPos.h - 6;

  const left = (innerX / svgWidth) * 100;
  const top = (innerY / svgHeight) * 100;
  const width = (innerW / svgWidth) * 100;
  const height = (innerH / svgHeight) * 100;

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
