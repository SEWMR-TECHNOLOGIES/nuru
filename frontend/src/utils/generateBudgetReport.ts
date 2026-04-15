/**
 * Generate a premium branded PDF for AI-generated event budget
 */
import nuruLogoUrl from '@/assets/nuru-logo.png';

interface BudgetReportData {
  content: string;
  eventTitle: string;
  eventType: string;
  location?: string;
  guests?: string;
}

/** Convert markdown table rows to HTML table rows */
function markdownTableToHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let headerDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) { headerDone = true; continue; }

      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (!inTable) {
        html += '<table>';
        inTable = true;
      }

      const tag = !headerDone ? 'th' : 'td';
      const isTotal = cells.some(c => c.replace(/\*/g, '').toUpperCase().includes('TOTAL'));
      html += `<tr${isTotal ? ' class="total-row"' : ''}>`;
      cells.forEach(c => {
        const clean = c.replace(/\*\*/g, '');
        html += `<${tag}>${clean}</${tag}>`;
      });
      html += '</tr>';
    } else {
      if (inTable) { html += '</table>'; inTable = false; headerDone = false; }
      // Convert markdown bold/headers to simple HTML
      if (trimmed.startsWith('##')) {
        html += `<h3>${trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</h3>`;
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        html += `<p class="bold">${trimmed.replace(/\*\*/g, '')}</p>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        html += `<p class="tip">${trimmed.slice(2)}</p>`;
      } else if (trimmed.length > 0) {
        html += `<p>${trimmed.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>')}</p>`;
      }
    }
  }
  if (inTable) html += '</table>';
  return html;
}

export const generateBudgetReportHtml = (data: BudgetReportData): string => {
  const logoUrl = new URL(nuruLogoUrl, window.location.origin).href;
  const tableHtml = markdownTableToHtml(data.content);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html><head><title>Budget Estimate - ${data.eventTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 48px; max-width: 800px; margin: 0 auto; }
  @media print {
    body { padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 32px; }
  .brand { display: flex; flex-direction: column; }
  .brand img { height: 36px; width: auto; object-fit: contain; margin-bottom: 6px; }
  .brand .tag { font-size: 10px; color: #888; letter-spacing: 1px; text-transform: uppercase; }
  .header-right { text-align: right; }
  .header-right h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .header-right .meta { font-size: 11px; color: #64748b; }
  .header-right .meta span { margin-left: 16px; }

  .info-bar { display: flex; gap: 24px; margin-bottom: 28px; padding: 14px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .info-bar .item { font-size: 12px; color: #64748b; }
  .info-bar .item strong { color: #1e293b; font-weight: 600; }

  h3 { font-size: 13px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 0.8px; margin: 24px 0 12px; }
  p { font-size: 13px; line-height: 1.6; margin-bottom: 6px; color: #475569; }
  p.bold { font-weight: 600; color: #1e293b; }
  p.tip { padding-left: 12px; border-left: 3px solid #e2e8f0; color: #64748b; font-style: italic; margin: 8px 0; }

  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  th { background: #f1f5f9; color: #1e293b; padding: 10px 14px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }
  td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .total-row td { background: #f1f5f9 !important; color: #1e293b; font-weight: 700; font-size: 13px; border-top: 2px solid #cbd5e1; }

  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .footer .left { font-size: 10px; color: #94a3b8; }
  .footer .right { font-size: 10px; color: #94a3b8; }
  .disclaimer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; font-style: italic; }
</style>
</head><body>

<div class="header">
  <div class="brand">
    <img src="${logoUrl}" alt="Nuru" />
    <span class="tag">Budget Estimate</span>
  </div>
  <div class="header-right">
    <h1>${data.eventTitle}</h1>
    <div class="meta">
      <span>${data.eventType}</span>
      ${data.location ? `<span>${data.location}</span>` : ''}
      ${data.guests ? `<span>${data.guests} guests</span>` : ''}
    </div>
  </div>
</div>

<div class="info-bar">
  <div class="item"><strong>Report Type:</strong> AI Budget Estimate</div>
  <div class="item"><strong>Generated:</strong> ${date}</div>
  <div class="item"><strong>Currency:</strong> TZS</div>
</div>

${tableHtml}

<div class="footer">
  <div class="left">Generated by Nuru AI Budget Assistant</div>
  <div class="right">nuru.tz</div>
</div>
<p class="disclaimer">This is an AI-generated estimate. Actual costs may vary based on vendor availability, season, and specific requirements.</p>
<p class="disclaimer" style="margin-top: 12px;">&copy; ${new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</p>

</body></html>`;
};
