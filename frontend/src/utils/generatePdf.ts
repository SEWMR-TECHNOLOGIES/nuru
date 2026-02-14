/**
 * PDF generation using browser print
 * Generates a branded contribution report with Nuru logo
 */

import nuruLogoUrl from '@/assets/nuru-logo.png';

interface ContributorRow {
  name: string;
  pledged: number;
  paid: number;
  balance: number;
}

export const generateContributionReportHtml = (
  eventTitle: string,
  contributors: ContributorRow[],
  summary: { total_amount: number; target_amount?: number; currency?: string; budget?: number }
): string => {
  const currency = summary.currency || 'TZS';
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

  // Sort contributors alphabetically
  const sorted = [...contributors].sort((a, b) => a.name.localeCompare(b.name));

  const totalPledged = sorted.reduce((s, c) => s + c.pledged, 0);
  const totalPaid = sorted.reduce((s, c) => s + c.paid, 0);
  const totalBalance = sorted.reduce((s, c) => s + c.balance, 0);

  const logoAbsoluteUrl = new URL(nuruLogoUrl, window.location.origin).href;

  const rows = sorted.map((c, i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${c.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.pledged)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.paid)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${c.balance > 0 ? '#dc2626' : '#16a34a'}">${fmt(c.balance)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html><head><title>Contribution Report - ${eventTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
      .brand { display: flex; flex-direction: column; align-items: flex-start; }
      .brand img { height: 40px; margin-bottom: 6px; }
      .brand .slogan { font-size: 11px; color: #888; font-style: italic; }
      .header-right { text-align: right; }
      .header-right h1 { font-size: 20px; margin: 0 0 4px 0; }
      .header-right h2 { font-size: 13px; color: #666; margin: 0; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f8f8f8; padding: 10px 8px; text-align: left; border-bottom: 2px solid #ddd; font-size: 13px; }
      td { font-size: 13px; }
      .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
      .summary-card { background: #f9fafb; border-radius: 8px; padding: 14px 18px; flex:1; min-width: 120px; }
      .summary-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
      .summary-card .value { font-size: 17px; font-weight: bold; margin-top: 4px; }
      tfoot td { font-weight: bold; border-top: 2px solid #333; padding: 10px 8px; }
      .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
      @media print { body { padding: 20px; } }
    </style></head>
    <body>
      <div class="header">
        <div class="brand">
          <img src="${logoAbsoluteUrl}" alt="Nuru" />
          <span class="slogan">Plan Smarter</span>
        </div>
        <div class="header-right">
          <h1>Contribution Report</h1>
          <h2>${eventTitle} — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        </div>
      </div>
      
      <div class="summary">
        ${summary.budget ? `<div class="summary-card"><div class="label">Event Budget</div><div class="value">${fmt(summary.budget)}</div></div>` : ''}
        <div class="summary-card"><div class="label">Total Raised</div><div class="value" style="color:#16a34a">${fmt(totalPaid)}</div></div>
        <div class="summary-card"><div class="label">Total Pledged</div><div class="value" style="color:#ca8a04">${fmt(totalPledged)}</div></div>
        <div class="summary-card"><div class="label">Pledge Shortfall</div><div class="value" style="color:#ea580c">${fmt(Math.max(0, totalPledged - totalPaid))}</div></div>
        <div class="summary-card"><div class="label">Outstanding Balance</div><div class="value" style="color:#dc2626">${fmt(totalBalance)}</div></div>
      </div>

      ${summary.budget ? `<p style="font-size:12px;color:#666;margin-bottom:16px">Budget coverage: <strong>${((totalPaid / summary.budget) * 100).toFixed(1)}%</strong> of event budget raised so far.</p>` : ''}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Contributor</th>
            <th style="text-align:right">Pledged</th>
            <th style="text-align:right">Paid</th>
            <th style="text-align:right">Balance</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total (${sorted.length} contributors)</td>
            <td style="text-align:right">${fmt(totalPledged)}</td>
            <td style="text-align:right">${fmt(totalPaid)}</td>
            <td style="text-align:right">${fmt(totalBalance)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">Generated by Nuru Events Workspace · © ${new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</div>
    </body></html>
  `;
};

/** @deprecated Use generateContributionReportHtml + ReportPreviewDialog instead */
export const generateContributionReport = (
  eventTitle: string,
  contributors: ContributorRow[],
  summary: { total_amount: number; target_amount?: number; currency?: string; budget?: number }
) => {
  const html = generateContributionReportHtml(eventTitle, contributors, summary);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
};
