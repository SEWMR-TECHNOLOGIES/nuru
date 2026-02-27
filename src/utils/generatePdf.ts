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
  summary: { total_amount: number; target_amount?: number; currency?: string; budget?: number },
  dateRangeLabel?: string,
  fullSummary?: { total_paid: number; total_pledged: number; total_balance: number },
  eventEndDate?: string
): string => {
  const currency = summary.currency || 'TZS';
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

  // Sort contributors alphabetically
  const sorted = [...contributors].sort((a, b) => a.name.localeCompare(b.name));

  const totalPledged = sorted.reduce((s, c) => s + c.pledged, 0);
  const totalPaid = sorted.reduce((s, c) => s + c.paid, 0);
  const totalBalance = sorted.reduce((s, c) => s + c.balance, 0);

  // Use full summary for header cards if provided, otherwise fall back to table totals
  const summaryPledged = fullSummary?.total_pledged ?? totalPledged;
  const summaryPaid = fullSummary?.total_paid ?? totalPaid;

  // Outstanding pledge = what's promised but not yet collected
  const outstandingPledge = Math.max(0, summaryPledged - summaryPaid);

  const logoAbsoluteUrl = new URL(nuruLogoUrl, window.location.origin).href;

  const isFiltered = !!dateRangeLabel;

  // Countdown text based on event START date (only on unfiltered full reports, only if event hasn't started yet)
  let countdownHtml = '';
  if (eventEndDate && !isFiltered) {
    const startDate = new Date(eventEndDate); // param is actually start_date now
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      const weeks = Math.floor(diffDays / 7);
      const days = diffDays % 7;
      let countdownText = '';
      if (weeks > 0 && days > 0) {
        countdownText = `${weeks} week${weeks !== 1 ? 's' : ''} and ${days} day${days !== 1 ? 's' : ''} remaining`;
      } else if (weeks > 0) {
        countdownText = `${weeks} week${weeks !== 1 ? 's' : ''} remaining`;
      } else {
        countdownText = `${days} day${days !== 1 ? 's' : ''} remaining`;
      }
      countdownHtml = `<div style="display:inline-flex;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:6px 14px;margin-bottom:20px"><span style="font-size:13px;font-weight:600;color:#1d4ed8">${countdownText}</span></div>`;
    } else if (diffDays === 0) {
      countdownHtml = `<div style="display:inline-flex;align-items:center;background:#fefce8;border:1px solid #fde047;border-radius:20px;padding:6px 14px;margin-bottom:20px"><span style="font-size:13px;font-weight:600;color:#854d0e">Event is Today!</span></div>`;
    }
    // If diffDays < 0, event has already started — show no countdown
  }

  const rows = sorted.map((c, i) => isFiltered ? `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${c.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.paid)}</td>
    </tr>
  ` : `
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
      .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
      .summary-card { background: #f9fafb; border-radius: 8px; padding: 14px 18px; }
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
          <h2>${eventTitle} &mdash; ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h2>
          ${dateRangeLabel ? `<h2 style="color:#ca8a04;margin-top:4px">Period: ${dateRangeLabel}</h2>` : ''}
        </div>
      </div>

      ${countdownHtml}
      
      <div class="summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${summary.budget ? `<div class="summary-card"><div class="label">Event Budget</div><div class="value">${fmt(summary.budget)}</div></div>` : ''}
        <div class="summary-card"><div class="label">Total Pledged</div><div class="value" style="color:#7c3aed">${fmt(summaryPledged)}</div></div>
        <div class="summary-card"><div class="label">Total Raised</div><div class="value" style="color:#16a34a">${fmt(summaryPaid)}</div></div>
        <div class="summary-card"><div class="label">Outstanding Pledge</div><div class="value" style="color:#ca8a04">${fmt(outstandingPledge)}</div></div>
        ${summary.budget ? `<div class="summary-card" style="background:#fef2f2"><div class="label" style="color:#991b1b">Budget Shortfall</div><div class="value" style="color:${Math.max(0, summary.budget - summaryPledged) > 0 ? '#dc2626' : '#16a34a'}">${fmt(Math.max(0, summary.budget - summaryPledged))}</div></div>` : ''}
      </div>

      ${summary.budget ? `<p style="font-size:12px;color:#666;margin-bottom:16px">Budget coverage: <strong>${((summaryPaid / summary.budget) * 100).toFixed(1)}%</strong> of event budget raised so far.${summary.budget ? `<span style="float:right">Pledge coverage: <strong style="color:#7c3aed">${((summaryPledged / summary.budget) * 100).toFixed(1)}%</strong> of event budget.</span>` : ''}</p>` : ''}
      ${dateRangeLabel ? `<p style="font-size:11px;color:#7c3aed;margin-bottom:16px;font-style:italic">The table below shows payments recorded within the selected period (${dateRangeLabel}). Summary cards above reflect all-time totals.</p>` : ''}

      <table>
        <thead>
          <tr>
            <th>S/N</th>
            <th>Contributor</th>
            ${isFiltered ? `
            <th style="text-align:right">Raised</th>
            ` : `
            <th style="text-align:right">Pledged</th>
            <th style="text-align:right">Paid</th>
            <th style="text-align:right">Balance</th>
            `}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total (${sorted.length} contributors)</td>
            ${isFiltered ? `
            <td style="text-align:right">${fmt(totalPaid)}</td>
            ` : `
            <td style="text-align:right">${fmt(totalPledged)}</td>
            <td style="text-align:right">${fmt(totalPaid)}</td>
            <td style="text-align:right">${fmt(totalBalance)}</td>
            `}
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">Generated by Nuru Events Workspace &middot; &copy; ${new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</div>
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

/**
 * Expense Report HTML
 */
interface ExpenseRow {
  category: string;
  description: string;
  amount: number;
  vendor_name?: string;
  expense_date: string;
  recorded_by_name?: string;
}

export const generateExpenseReportHtml = (
  eventTitle: string,
  expenses: ExpenseRow[],
  summary: { total_expenses: number; category_breakdown: Array<{ category: string; total: number; count: number }>; currency?: string; budget?: number; total_raised?: number },
  dateRangeLabel?: string
): string => {
  const currency = summary.currency || 'TZS';
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

  const sorted = [...expenses].sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());

  const totalExpenses = sorted.reduce((s, e) => s + e.amount, 0);

  const logoAbsoluteUrl = new URL(nuruLogoUrl, window.location.origin).href;

  const rows = sorted.map((e, i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${e.expense_date ? new Date(e.expense_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '&mdash;'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${e.vendor_name || '&mdash;'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${e.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${e.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(e.amount)}</td>
    </tr>
  `).join('');

  const categoryRows = (summary.category_breakdown || []).map(c => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${c.category}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${c.count}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.total)}</td>
    </tr>
  `).join('');

  const remaining = (summary.total_raised || 0) - summary.total_expenses;

  const budgetCard = summary.budget
    ? `<div class="summary-card"><div class="label">Event Budget</div><div class="value">${fmt(summary.budget)}</div></div>`
    : '';

  const dateHeader = dateRangeLabel
    ? `<h2 style="color:#ca8a04;margin-top:4px">Period: ${dateRangeLabel}</h2>`
    : '';

  const catSection = categoryRows
    ? `<h3 style="font-size:14px;margin-bottom:8px">Category Summary</h3>
      <table style="margin-bottom:24px">
        <thead><tr><th>Category</th><th style="text-align:center">Items</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${categoryRows}</tbody>
      </table>`
    : '';

  const balColor = remaining >= 0 ? '#16a34a' : '#dc2626';

  return `
    <!DOCTYPE html>
    <html><head><title>Expense Report - ${eventTitle}</title>
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
          <h1>Expense Report</h1>
          <h2>${eventTitle} &mdash; ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h2>
          ${dateHeader}
        </div>
      </div>
      
      <div class="summary">
        ${budgetCard}
        <div class="summary-card"><div class="label">Total Raised</div><div class="value" style="color:#16a34a">${fmt(summary.total_raised || 0)}</div></div>
        <div class="summary-card"><div class="label">Total Expenses</div><div class="value" style="color:#dc2626">${fmt(summary.total_expenses)}</div></div>
        <div class="summary-card"><div class="label">Remaining Balance</div><div class="value" style="color:${balColor}">${fmt(remaining)}</div></div>
      </div>

      ${catSection}

      <h3 style="font-size:14px;margin-bottom:8px">Expense Details</h3>
      <table>
        <thead>
          <tr>
            <th>S/N</th>
            <th>Date</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Description</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">Total (${sorted.length} expenses)</td>
            <td style="text-align:right">${fmt(totalExpenses)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">Generated by Nuru Events Workspace &middot; &copy; ${new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</div>
    </body></html>
  `;
};
